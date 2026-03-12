import type { Container, Graphics } from "pixi.js";
import { SEGMENT_TRAVEL_MS, TRAIN_FADEOUT_MS } from "@/constants/mapConfig";
import { useMapStore } from "@/stores/useMapStore";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { AnimatedTrainState, InterpolatedTrain } from "@/types/train";
import { drawAnimatedTrains } from "../objects/TrainParticle";

/** ease-in-out 보간: 출발·도착 시 부드럽게 가감속 */
function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

/**
 * 단일 열차의 진행률을 delta(ms) 만큼 전진하고 현재 좌표를 갱신한다.
 * isMoving=true이고 progress < 1일 때만 전진한다.
 * progress는 절대 감소하지 않는다.
 */
function advanceTrainState(state: AnimatedTrainState, delta: number): void {
	if (state.isMoving && state.progress < 1) {
		state.progress = Math.min(1, state.progress + (delta * state.speedFactor) / SEGMENT_TRAVEL_MS);
	}
	const t = easeInOut(state.progress);
	state.currentX = state.fromX + (state.toX - state.fromX) * t;
	state.currentY = state.fromY + (state.toY - state.fromY) * t;

	// Waypoint 자동 전환: B역 도달(progress=1) 후 pending C역으로 즉시 전환
	if (state.progress >= 1 && state.pendingToX !== undefined) {
		state.fromX = state.toX;
		state.fromY = state.toY;
		state.toX = state.pendingToX;
		state.toY = state.pendingToY!;
		state.stationId = state.pendingStationId!;
		state.toStationId = state.pendingToStationId!;
		state.progress = 0;
		state.isMoving = true;
		state.trailDirty = true;
		state.pendingToX = undefined;
		state.pendingToY = undefined;
		state.pendingStationId = undefined;
		state.pendingToStationId = undefined;
	}
}

/**
 * 열차 애니메이션 엔진.
 * PixiJS ticker에서 매 프레임 update()를 호출하여 열차 위치를 보간한다.
 * React 외부에서 동작하며, 폴링으로 새 데이터가 도착하면 setTargets()로 갱신한다.
 *
 * 4가지 규칙:
 * 1. API stationName 역에 배치
 * 2. direction 기반 다음 역 방향으로 trackAngle 설정
 * 3. "출발" → 다음 역으로 이동, "도착"/"진입" → 현재 역 대기
 * 4. 폴 데이터 수신 시 열차 위치 순간이동 없음 (진행률 기반 연속 이동)
 */
export class TrainAnimator {
	private states: Map<string, AnimatedTrainState> = new Map();
	private trainsLayer: Container | null = null;
	private trainLabelsLayer: Container | null = null;
	private graphicsPool: Map<string, Graphics> = new Map();
	private onTrainTap: ((trainNo: string) => void) | null = null;
	/** 직전 프레임 시각 — delta 계산용 */
	private lastTickAt = 0;

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
	 * 기존 열차는 구간·진행률을 유지한 채 갱신하고, 사라진 열차는 fade-out 처리한다.
	 */
	setTargets(interpolated: InterpolatedTrain[]): void {
		const now = performance.now();
		const newKeys = new Set<string>();

		for (const train of interpolated) {
			newKeys.add(train.trainNo);
			this.upsertTrain(train, now);
		}

		this.markStaleForFadeOut(newKeys);
	}

	/** 단일 열차의 상태를 갱신하거나 신규 생성한다 */
	private upsertTrain(train: InterpolatedTrain, now: number): void {
		const existing = this.states.get(train.trainNo);

		if (existing === undefined) {
			// 신규 열차: simProgress 기반 초기 위치 설정 (시뮬레이션 텔레포트 방지)
			const isDepart = train.status === "출발";
			const simP = isDepart ? (train.simProgress ?? 0) : 0;
			const t = easeInOut(simP);
			const initX = isDepart ? train.stationX + (train.nextX - train.stationX) * t : train.stationX;
			const initY = isDepart ? train.stationY + (train.nextY - train.stationY) * t : train.stationY;
			this.states.set(train.trainNo, {
				trainNo: train.trainNo,
				line: train.line,
				direction: train.direction,
				currentX: initX,
				currentY: initY,
				stationId: train.stationId,
				toStationId: train.nextStationId,
				fromX: train.stationX,
				fromY: train.stationY,
				toX: isDepart ? train.nextX : train.stationX,
				toY: isDepart ? train.nextY : train.stationY,
				progress: simP,
				isMoving: isDepart,
				trackAngle: train.trackAngle,
				createdAt: now,
				lastPollAt: now,
				speedFactor: train.speedFactor ?? 1.0,
			});
			return;
		}

		// fade-out 중 복귀 → fade-out 취소
		existing.fadeOutStartedAt = undefined;
		existing.lastPollAt = now;

		// 공통 갱신 (항상 실행)
		existing.direction = train.direction;
		existing.trackAngle = train.trackAngle;

		const isDepart = train.status === "출발";

		// 구간 분류: 같은 구간 / 다음 구간으로 진행 / 예상 밖 변경
		const segmentSame =
			existing.stationId === train.stationId && existing.toStationId === train.nextStationId;
		const trainAdvanced = existing.toStationId === train.stationId;

		if (segmentSame) {
			// ── 같은 구간 ──────────────────────────────────────────────────────
			if (isDepart) {
				// 출발: 목표 좌표 동기화 후 이동 계속 (progress 유지 — 역방향 점프 방지)
				existing.toX = train.nextX;
				existing.toY = train.nextY;
				existing.isMoving = true;
			}
			// 도착/진입 + 같은 구간: 현재 이동 상태 유지
			//   이동 중이면 → 비정상 데이터(스테일) 무시, 계속 이동
			//   이미 정차 중이면 → 정차 유지
		} else if (trainAdvanced) {
			// ── 다음 구간으로 정상 진행 ────────────────────────────────────────
			if (isDepart) {
				// API에서 B역 출발 확인 → 진행률에 관계없이 즉시 B로 스냅 후 C로 이동
				// progress < 1: 폴링 지연으로 아직 B 미도달 → B로 즉시 정렬 (A에서 출발하는 버그 수정)
				// progress >= 1: currentX ≈ B이므로 기존과 동일한 효과
				existing.stationId = train.stationId;
				existing.toStationId = train.nextStationId;
				existing.fromX = train.stationX; // B 좌표
				existing.fromY = train.stationY;
				existing.toX = train.nextX; // C 좌표
				existing.toY = train.nextY;
				existing.currentX = train.stationX; // B로 스냅
				existing.currentY = train.stationY;
				existing.progress = 0;
				existing.speedFactor = train.speedFactor ?? 1.0;
				existing.isMoving = true;
				existing.trailDirty = true;
				existing.pendingToX = undefined;
				existing.pendingToY = undefined;
				existing.pendingStationId = undefined;
				existing.pendingToStationId = undefined;
			} else {
				// 도착/진입: 전진 방향 스냅 (열차가 실제로 역에 도착한 상태)
				existing.stationId = train.stationId;
				existing.toStationId = train.nextStationId;
				existing.fromX = train.stationX;
				existing.fromY = train.stationY;
				existing.toX = train.stationX;
				existing.toY = train.stationY;
				existing.currentX = train.stationX;
				existing.currentY = train.stationY;
				existing.progress = 0;
				existing.isMoving = false;
				existing.trailDirty = true;
				existing.pendingToX = undefined;
				existing.pendingToY = undefined;
				existing.pendingStationId = undefined;
				existing.pendingToStationId = undefined;
			}
		} else {
			// ── 예상 밖 구간 변경 (API 이상, 2+ 역 점프 등) ──────────────────
			existing.unexpectedSnapAt = now;        // 경고 마커 트리거
			existing.unexpectedSnapX = existing.currentX; // 텔레포트 직전 위치 저장
			existing.unexpectedSnapY = existing.currentY;
			existing.stationId = train.stationId;
			existing.toStationId = train.nextStationId;
			existing.fromX = train.stationX;
			existing.fromY = train.stationY;
			existing.toX = isDepart ? train.nextX : train.stationX;
			existing.toY = isDepart ? train.nextY : train.stationY;
			existing.currentX = train.stationX;
			existing.currentY = train.stationY;
			existing.progress = 0;
			existing.speedFactor = train.speedFactor ?? 1.0;
			existing.isMoving = isDepart;
			existing.trailDirty = true;
			existing.pendingToX = undefined;
			existing.pendingToY = undefined;
			existing.pendingStationId = undefined;
			existing.pendingToStationId = undefined;
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
	 * 매 프레임 호출 — 진행률 기반으로 열차 위치를 갱신하고 렌더링한다.
	 * PixiJS ticker의 콜백으로 등록한다.
	 */
	update(): void {
		if (this.trainsLayer === null) return;

		const now = performance.now();
		const delta = this.lastTickAt === 0 ? 0 : now - this.lastTickAt;
		this.lastTickAt = now;

		// fade-out 완료된 열차 제거
		this.removeCompletedFadeOuts(now);

		const trainList: AnimatedTrainState[] = [];

		for (const state of this.states.values()) {
			advanceTrainState(state, delta);
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
		this.lastTickAt = 0;
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
