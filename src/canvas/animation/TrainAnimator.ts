import type { Container, Graphics } from "pixi.js";
import { TRAIN_ANIMATION_DURATION_MS, TRAIN_FADEOUT_MS } from "@/constants/mapConfig";
import { useMapStore } from "@/stores/useMapStore";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { AnimatedTrainState, InterpolatedTrain, PathPoint } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { drawAnimatedTrains } from "../objects/TrainParticle";

/** 두 역이 인접(직접 연결)한지 판정한다 */
function isAdjacentStation(a: string, b: string, map: Map<string, AdjacencyInfo>): boolean {
	if (a === b) return true;
	const adj = map.get(a);
	if (adj === undefined) return false;
	return adj.nexts.includes(b) || adj.prevs.includes(b);
}

/** 기존 열차의 애니메이션 상태를 새 목표로 갱신한다 */
function updateExistingTrain(
	existing: AnimatedTrainState,
	train: InterpolatedTrain,
	now: number,
	animDuration: number,
	adjacencyMap?: Map<string, AdjacencyInfo>,
	continuousMode = false,
): void {
	if (continuousMode) {
		// 시뮬레이션 모드: 항상 현재 시각 위치에서 부드럽게 연속
		// stationX/Y 리셋 금지 — 순간이동의 원인
		existing.startX = existing.currentX;
		existing.startY = existing.currentY;
	} else {
		// 실시간 모드: 스테일 데이터 필터링 + 타겟 변경 여부로 시작점 결정
		const stationChanged = existing.fromStationId !== train.fromStationId;
		const hasNewDestination = train.x !== train.stationX || train.y !== train.stationY;
		const targetChanged = existing.targetX !== train.x || existing.targetY !== train.y;

		if (!hasNewDestination && targetChanged && !stationChanged) {
			// 같은 역에서 도착/진입 상태인데 타겟이 다름 → 스테일 데이터, 기존 애니메이션 유지
			return;
		}

		if (targetChanged) {
			// 새 목적지(출발 상태) → 역 물리 좌표에서 재시작 (노선 이탈 방지)
			existing.startX = train.stationX;
			existing.startY = train.stationY;
		} else {
			// 타겟 동일 → 현재 위치에서 부드럽게 계속
			existing.startX = existing.currentX;
			existing.startY = existing.currentY;
		}
	}
	existing.targetX = train.x;
	existing.targetY = train.y;
	existing.startTime = now;
	existing.direction = train.direction;
	existing.linear = true;

	const dx = existing.targetX - existing.startX;
	const dy = existing.targetY - existing.startY;
	const dist2 = dx * dx + dy * dy;

	if (dist2 < 0.1) {
		// 같은 좌표 → 정지
		existing.duration = 0;
	} else if (
		adjacencyMap !== undefined &&
		existing.toStationId !== "" &&
		!isAdjacentStation(existing.toStationId, train.toStationId, adjacencyMap)
	) {
		// 비인접 역 → 텔레포트 (1분 애니메이션 없이 즉시 배치)
		existing.duration = 0;
	} else {
		// 인접 역 → 등속 직선 이동
		existing.duration = animDuration;
	}

	// 경로는 항상 2점 (시작→끝)
	const path: PathPoint[] = [
		{ x: existing.startX, y: existing.startY },
		{ x: existing.targetX, y: existing.targetY },
	];
	existing.path = path;
	existing.pathCumulativeDist = [0, Math.sqrt(dist2)];

	// 이동 방향으로 trackAngle 설정
	if (dist2 > 0.01) {
		existing.trackAngle = Math.atan2(dy, dx);
	} else {
		existing.trackAngle = train.trackAngle;
	}

	existing.fromStationId = train.fromStationId;
	existing.toStationId = train.toStationId;
}

/** 신규 열차의 애니메이션 상태를 생성한다 */
function createNewTrainState(
	train: InterpolatedTrain,
	now: number,
	continuousMode = false,
): AnimatedTrainState {
	// 시뮬레이션: train.x/y = 이미 보간된 실제 위치
	// 실시간: train.stationX/Y = 역 물리 좌표 (라인 이탈 방지)
	const initX = continuousMode ? train.x : train.stationX;
	const initY = continuousMode ? train.y : train.stationY;
	const path: PathPoint[] = [
		{ x: initX, y: initY },
		{ x: initX, y: initY },
	];
	return {
		trainNo: train.trainNo,
		line: train.line,
		direction: train.direction,
		startX: initX,
		startY: initY,
		targetX: initX,
		targetY: initY,
		currentX: initX,
		currentY: initY,
		startTime: now,
		duration: 0,
		fromStationId: train.fromStationId,
		toStationId: train.toStationId,
		path,
		pathCumulativeDist: [0, 0],
		linear: true,
		trackAngle: train.trackAngle,
		createdAt: now,
	};
}

/** 단일 열차의 프레임별 위치를 보간한다 (항상 2점 직선 선형 보간) */
function advanceTrainState(state: AnimatedTrainState, now: number): void {
	if (state.duration <= 0) {
		state.currentX = state.targetX;
		state.currentY = state.targetY;
		return;
	}
	const elapsed = now - state.startTime;
	const t = Math.min(elapsed / state.duration, 1);

	state.currentX = state.startX + (state.targetX - state.startX) * t;
	state.currentY = state.startY + (state.targetY - state.startY) * t;
}

/**
 * 열차 애니메이션 엔진.
 * PixiJS ticker에서 매 프레임 update()를 호출하여 열차 위치를 보간한다.
 * React 외부에서 동작하며, 폴링으로 새 데이터가 도착하면 setTargets()로 갱신한다.
 */
export class TrainAnimator {
	private states: Map<string, AnimatedTrainState> = new Map();
	private trainsLayer: Container | null = null;
	private trainLabelsLayer: Container | null = null;
	private graphicsPool: Map<string, Graphics> = new Map();
	private onTrainTap: ((trainNo: string) => void) | null = null;

	/** 렌더링 대상 레이어를 설정한다 */
	setLayer(layer: Container): void {
		this.trainsLayer = layer;
	}

	/** 열차 번호 레이블 레이어를 설정한다 */
	setTrainLabelsLayer(layer: Container): void {
		this.trainLabelsLayer = layer;
	}

	/** 열차 클릭 콜백을 등록한다 */
	setOnTrainTap(callback: (trainNo: string) => void): void {
		this.onTrainTap = callback;
	}

	/** 특정 열차의 현재 애니메이션 상태를 반환한다 */
	getTrainState(trainNo: string): AnimatedTrainState | undefined {
		return this.states.get(trainNo);
	}

	/**
	 * 새 폴링 데이터가 도착하면 호출한다.
	 * 기존 열차는 현재 위치 → 새 목표로 애니메이션을 시작한다.
	 * 신규 열차는 목표 위치에 즉시 배치한다.
	 * 사라진 열차는 제거한다.
	 */
	setTargets(
		interpolated: InterpolatedTrain[],
		duration?: number,
		adjacencyMap?: Map<string, AdjacencyInfo>,
	): void {
		const now = performance.now();
		const animDuration = duration ?? TRAIN_ANIMATION_DURATION_MS;
		// duration이 명시적으로 전달되면 시뮬레이션 모드 (연속 보간)
		const continuousMode = duration !== undefined;
		const newKeys = new Set<string>();

		for (const train of interpolated) {
			newKeys.add(train.trainNo);
			this.upsertTrain(train, now, animDuration, adjacencyMap, continuousMode);
		}

		this.markStaleForFadeOut(newKeys);
	}

	/** 단일 열차의 상태를 갱신하거나 신규 생성한다 */
	private upsertTrain(
		train: InterpolatedTrain,
		now: number,
		animDuration: number,
		adjacencyMap: Map<string, AdjacencyInfo> | undefined,
		continuousMode: boolean,
	): void {
		const existing = this.states.get(train.trainNo);
		if (existing !== undefined) {
			// fade-out 중 복귀 → fade-out 취소
			if (existing.fadeOutStartedAt !== undefined) {
				existing.fadeOutStartedAt = undefined;
			}
			updateExistingTrain(existing, train, now, animDuration, adjacencyMap, continuousMode);
		} else {
			this.states.set(train.trainNo, createNewTrainState(train, now, continuousMode));
		}
	}

	/** 새 데이터에 없는 열차를 fade-out 상태로 전환한다 */
	private markStaleForFadeOut(newKeys: Set<string>): void {
		const now = performance.now();
		for (const [key, state] of this.states) {
			if (!newKeys.has(key) && state.fadeOutStartedAt === undefined) {
				state.fadeOutStartedAt = now;
			}
		}
	}

	/** fade-out이 완료된 열차를 실제 삭제한다 */
	private removeCompletedFadeOuts(now: number): void {
		for (const [key, state] of this.states) {
			if (state.fadeOutStartedAt === undefined) continue;
			const elapsed = now - state.fadeOutStartedAt;
			if (elapsed >= TRAIN_FADEOUT_MS) {
				this.states.delete(key);
				const gfx = this.graphicsPool.get(key);
				if (gfx !== undefined && this.trainsLayer !== null) {
					this.trainsLayer.removeChild(gfx);
				}
				this.graphicsPool.delete(key);
			}
		}
	}

	/**
	 * 매 프레임 호출 — 등속 직선 보간으로 열차 위치를 갱신하고 렌더링한다.
	 * PixiJS ticker의 콜백으로 등록한다.
	 */
	update(): void {
		if (this.trainsLayer === null) return;

		const now = performance.now();

		// fade-out 완료된 열차 제거
		this.removeCompletedFadeOuts(now);

		const trainList: AnimatedTrainState[] = [];

		for (const state of this.states.values()) {
			advanceTrainState(state, now);
			trainList.push(state);
		}

		const selectedTrainNo = useTrainStore.getState().selectedTrainNo;
		const selectedStation = useStationStore.getState().selectedStation;
		const activeLines = useMapStore.getState().activeLines;

		drawAnimatedTrains(
			this.trainsLayer,
			trainList,
			this.graphicsPool,
			selectedTrainNo,
			selectedStation?.id ?? null,
			this.onTrainTap ?? ((_no: string) => {}),
			activeLines,
			this.trainLabelsLayer,
		);
	}

	/** 전체 상태를 초기화한다 */
	clear(): void {
		this.states.clear();
		this.graphicsPool.clear();
		if (this.trainsLayer !== null) {
			this.trainsLayer.removeChildren();
		}
	}

	/** 현재 애니메이션 중인 열차 수 */
	get count(): number {
		return this.states.size;
	}

	/** 현재 애니메이션 상태 배열을 반환한다 */
	getTrainList(): AnimatedTrainState[] {
		return Array.from(this.states.values());
	}

	/** Graphics 풀 크기를 반환한다 */
	get poolSize(): number {
		return this.graphicsPool.size;
	}
}
