import type { Container, Graphics } from "pixi.js";
import { MAX_TRAIN_ANIM_DIST, TRAIN_ANIMATION_DURATION_MS } from "@/constants/mapConfig";
import { useMapStore } from "@/stores/useMapStore";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { AnimatedTrainState, InterpolatedTrain, PathPoint } from "@/types/train";
import { easeInOutCubic } from "@/utils/easing";
import type { StationGraph } from "@/utils/pathFinder";
import { findStationPath } from "@/utils/pathFinder";
import { drawAnimatedTrains } from "../objects/TrainParticle";

/** path의 누적 거리 배열을 계산한다 */
function computeCumulativeDist(path: PathPoint[]): number[] {
	const dist = [0];
	for (let i = 1; i < path.length; i++) {
		const prev = path[i - 1] as PathPoint;
		const curr = path[i] as PathPoint;
		const dx = curr.x - prev.x;
		const dy = curr.y - prev.y;
		dist.push((dist[i - 1] as number) + Math.sqrt(dx * dx + dy * dy));
	}
	return dist;
}

/** 이전 위치→새 목표 사이 다점 경로를 구성한다 */
function buildMultiPointPath(
	existing: AnimatedTrainState,
	train: InterpolatedTrain,
	stationScreenMap?: Map<string, ScreenCoord>,
	stationGraph?: StationGraph,
): PathPoint[] {
	const startPoint: PathPoint = { x: existing.currentX, y: existing.currentY };
	const endPoint: PathPoint = { x: train.x, y: train.y };

	// 그래프 또는 좌표맵이 없으면 직선
	if (stationGraph === undefined || stationScreenMap === undefined) {
		return [startPoint, endPoint];
	}

	// 이전 목표역(toStationId)에서 새 출발역(fromStationId)까지 BFS 탐색
	const prevToStation = existing.toStationId;
	const newFromStation = train.fromStationId;

	// 같은 역이면 직선으로 충분
	if (prevToStation === newFromStation || prevToStation === train.toStationId) {
		return [startPoint, endPoint];
	}

	const stationPath = findStationPath(stationGraph, prevToStation, newFromStation);

	// 경로를 못 찾거나 너무 짧으면 직선
	if (stationPath.length < 2 || stationPath.length > 4) {
		return [startPoint, endPoint];
	}

	// BFS 경로 방향 검증: 경로 벡터와 실제 이동 벡터의 내적이 음수면 역방향 → 직선 fallback
	const firstCoord = stationScreenMap.get(stationPath[0] as string);
	const lastCoord = stationScreenMap.get(stationPath[stationPath.length - 1] as string);
	if (firstCoord !== undefined && lastCoord !== undefined) {
		const pathDx = lastCoord.x - firstCoord.x;
		const pathDy = lastCoord.y - firstCoord.y;
		const moveDx = endPoint.x - startPoint.x;
		const moveDy = endPoint.y - startPoint.y;
		if (pathDx * moveDx + pathDy * moveDy < 0) {
			return [startPoint, endPoint];
		}
	}

	// 경유역 좌표를 경로에 추가 (BFS 첫/끝 역은 시작점/끝점과 중복되므로 중간역만 삽입)
	const path: PathPoint[] = [startPoint];
	for (let i = 1; i < stationPath.length - 1; i++) {
		const coord = stationScreenMap.get(stationPath[i] as string);
		if (coord !== undefined) {
			path.push({ x: coord.x, y: coord.y });
		}
	}
	path.push(endPoint);

	return path;
}

/** 기존 열차의 애니메이션 상태를 새 목표로 갱신한다 */
function updateExistingTrain(
	existing: AnimatedTrainState,
	train: InterpolatedTrain,
	now: number,
	animDuration: number,
	linear: boolean,
	stationScreenMap?: Map<string, ScreenCoord>,
	stationGraph?: StationGraph,
): void {
	existing.startX = existing.currentX;
	existing.startY = existing.currentY;
	existing.targetX = train.x;
	existing.targetY = train.y;
	existing.startTime = now;
	existing.direction = train.direction;
	existing.linear = linear;

	const dx = train.x - existing.currentX;
	const dy = train.y - existing.currentY;
	existing.trackAngle =
		Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01 ? Math.atan2(dy, dx) : train.trackAngle;

	// path를 먼저 구성한 후 polyline 총거리로 텔레포트 여부를 판단한다
	const path = buildMultiPointPath(existing, train, stationScreenMap, stationGraph);
	existing.path = path;
	existing.pathCumulativeDist = computeCumulativeDist(path);
	const totalDist = existing.pathCumulativeDist[existing.pathCumulativeDist.length - 1] as number;
	existing.duration = totalDist > MAX_TRAIN_ANIM_DIST ? 0 : animDuration;
	existing.fromStationId = train.fromStationId;
	existing.toStationId = train.toStationId;
}

/** 신규 열차의 애니메이션 상태를 생성한다 */
function createNewTrainState(
	train: InterpolatedTrain,
	now: number,
	linear: boolean,
	animDuration: number,
	stationScreenMap?: Map<string, ScreenCoord>,
): AnimatedTrainState {
	// fromStationId 좌표를 시작점으로 사용
	let startX = train.x;
	let startY = train.y;
	let duration = 0;

	if (stationScreenMap !== undefined) {
		const fromCoord = stationScreenMap.get(train.fromStationId);
		if (fromCoord !== undefined) {
			const dx = train.x - fromCoord.x;
			const dy = train.y - fromCoord.y;
			// 거리가 충분하면 애니메이션 적용 (3px 이하 미세 이동 방지)
			if (dx * dx + dy * dy > 9) {
				startX = fromCoord.x;
				startY = fromCoord.y;
				duration = animDuration;
			}
		}
	}

	const path: PathPoint[] = [
		{ x: startX, y: startY },
		{ x: train.x, y: train.y },
	];
	return {
		trainNo: train.trainNo,
		line: train.line,
		direction: train.direction,
		startX,
		startY,
		targetX: train.x,
		targetY: train.y,
		currentX: startX,
		currentY: startY,
		startTime: now,
		duration,
		fromStationId: train.fromStationId,
		toStationId: train.toStationId,
		path,
		pathCumulativeDist: computeCumulativeDist(path),
		linear,
		trackAngle: train.trackAngle,
	};
}

/** 누적 거리 기반으로 t(0~1)를 path 세그먼트에 매핑하여 보간한다 */
function interpolateAlongPath(path: PathPoint[], cumulativeDist: number[], t: number): PathPoint {
	const totalDist = cumulativeDist[cumulativeDist.length - 1] as number;

	// 총 거리가 0이면 첫 점 반환
	if (totalDist <= 0) {
		return path[0] as PathPoint;
	}

	const targetDist = t * totalDist;

	// 해당 거리에 속하는 세그먼트 찾기
	for (let i = 1; i < cumulativeDist.length; i++) {
		const prevDist = cumulativeDist[i - 1] as number;
		const currDist = cumulativeDist[i] as number;

		if (targetDist <= currDist) {
			const segmentLen = currDist - prevDist;
			const segT = segmentLen > 0 ? (targetDist - prevDist) / segmentLen : 0;
			const p0 = path[i - 1] as PathPoint;
			const p1 = path[i] as PathPoint;
			return {
				x: p0.x + (p1.x - p0.x) * segT,
				y: p0.y + (p1.y - p0.y) * segT,
			};
		}
	}

	// fallback: 마지막 점
	return path[path.length - 1] as PathPoint;
}

/** 단일 열차의 프레임별 위치를 보간한다 */
function advanceTrainState(state: AnimatedTrainState, now: number): void {
	const prevX = state.currentX;
	const prevY = state.currentY;

	if (state.duration <= 0) {
		state.currentX = state.targetX;
		state.currentY = state.targetY;
	} else {
		const elapsed = now - state.startTime;
		const rawT = Math.min(elapsed / state.duration, 1);
		const t = state.linear ? rawT : easeInOutCubic(rawT);

		if (state.path.length <= 2) {
			state.currentX = state.startX + (state.targetX - state.startX) * t;
			state.currentY = state.startY + (state.targetY - state.startY) * t;
		} else {
			const pos = interpolateAlongPath(state.path, state.pathCumulativeDist, t);
			state.currentX = pos.x;
			state.currentY = pos.y;
		}
	}

	const frameDx = state.currentX - prevX;
	const frameDy = state.currentY - prevY;
	if (Math.abs(frameDx) > 0.1 || Math.abs(frameDy) > 0.1) {
		state.trackAngle = Math.atan2(frameDy, frameDx);
	}
}

/**
 * 열차 애니메이션 엔진.
 * PixiJS ticker에서 매 프레임 update()를 호출하여 열차 위치를 보간한다.
 * React 외부에서 동작하며, 폴링으로 새 데이터가 도착하면 setTargets()로 갱신한다.
 */
export class TrainAnimator {
	private states: Map<string, AnimatedTrainState> = new Map();
	private trainsLayer: Container | null = null;
	private graphicsPool: Map<string, Graphics> = new Map();
	private onTrainTap: ((trainNo: string) => void) | null = null;

	/** 렌더링 대상 레이어를 설정한다 */
	setLayer(layer: Container): void {
		this.trainsLayer = layer;
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
		linear?: boolean,
		stationScreenMap?: Map<string, ScreenCoord>,
		stationGraph?: StationGraph,
	): void {
		const now = performance.now();
		const animDuration = duration ?? TRAIN_ANIMATION_DURATION_MS;
		const newKeys = new Set<string>();
		const isLinear = linear ?? false;

		for (const train of interpolated) {
			newKeys.add(train.trainNo);
			this.upsertTrain(train, now, animDuration, isLinear, stationScreenMap, stationGraph);
		}

		this.removeStaleTrain(newKeys);
	}

	/** 단일 열차의 상태를 갱신하거나 신규 생성한다 */
	private upsertTrain(
		train: InterpolatedTrain,
		now: number,
		animDuration: number,
		isLinear: boolean,
		stationScreenMap?: Map<string, ScreenCoord>,
		stationGraph?: StationGraph,
	): void {
		const existing = this.states.get(train.trainNo);
		if (existing !== undefined && existing.direction === train.direction) {
			updateExistingTrain(
				existing,
				train,
				now,
				animDuration,
				isLinear,
				stationScreenMap,
				stationGraph,
			);
		} else {
			this.states.set(
				train.trainNo,
				createNewTrainState(train, now, isLinear, animDuration, stationScreenMap),
			);
		}
	}

	/** 새 데이터에 없는 열차를 제거한다 */
	private removeStaleTrain(newKeys: Set<string>): void {
		for (const key of this.states.keys()) {
			if (!newKeys.has(key)) {
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
	 * 매 프레임 호출 — 이징으로 열차 위치를 보간하고 렌더링한다.
	 * PixiJS ticker의 콜백으로 등록한다.
	 */
	update(): void {
		if (this.trainsLayer === null) return;

		const now = performance.now();
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
