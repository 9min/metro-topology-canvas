import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPollHistory, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";

/** 두 값 사이의 선형 보간 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/** 두 좌표 간의 방향 각도(라디안)를 계산한다 */
function computeAngle(fromX: number, fromY: number, toX: number, toY: number): number {
	return Math.atan2(toY - fromY, toX - fromX);
}

/**
 * 두 후보 인접역 중 하나로 트랙 방향을 추론한다.
 * primaryId(진행 방향: current→primary)를 우선 시도하고,
 * 실패 시 fallbackId(도래 방향: fallback→current)를 사용한다.
 */
function inferTrackAngle(
	currentCoord: ScreenCoord,
	primaryId: string | null,
	fallbackId: string | null,
	stationScreenMap: Map<string, ScreenCoord>,
): number {
	if (primaryId !== null) {
		const coord = stationScreenMap.get(primaryId);
		if (coord !== undefined) {
			return computeAngle(currentCoord.x, currentCoord.y, coord.x, coord.y);
		}
	}
	if (fallbackId !== null) {
		const coord = stationScreenMap.get(fallbackId);
		if (coord !== undefined) {
			return computeAngle(coord.x, coord.y, currentCoord.x, currentCoord.y);
		}
	}
	return 0;
}

/**
 * 예측 보간 진행률.
 * API는 진입/도착/출발 3개 이산 상태만 제공하므로, 다음 폴링까지 예상 이동량을
 * 반영한 "예측 위치"를 반환한다. 이를 통해 30초 애니메이션 동안 열차가
 * 진행 방향으로 자연스럽게 이동한다.
 *
 * - 진입: 거의 역에 도착 → 100% (이전역→현재역)
 * - 도착: 곧 출발 예상 → 35% (현재역→다음역)
 * - 출발: 역간 이동 중 → 70% (현재역→다음역)
 */
const PREDICT_ARRIVAL = 1.0;
const PREDICT_DEPARTED = 0.35;
const PREDICT_ENROUTE = 0.7;

/** 동적 예측 진행률 상한 */
const DYNAMIC_PROGRESS_CAP = 0.95;

/**
 * 동일 (stationId + status)가 연속 반복될 때 예측 진행률을 점진적으로 높인다.
 * - 진입: 항상 1.0 (반복과 무관)
 * - 도착: base=0.35, step=0.20 → repeat 1/2/3 = 0.35/0.55/0.75
 * - 출발: base=0.70, step=0.125 → repeat 1/2/3 = 0.70/0.825/0.95
 */
export function computeDynamicProgress(
	status: "진입" | "도착" | "출발",
	repeatCount: number,
): number {
	if (status === "진입") return PREDICT_ARRIVAL;

	const base = status === "도착" ? PREDICT_DEPARTED : PREDICT_ENROUTE;
	const step = status === "도착" ? 0.2 : 0.125;
	const raw = base + step * (repeatCount - 1);
	return Math.min(raw, DYNAMIC_PROGRESS_CAP);
}

/** 진입 상태 보간: 이전역→현재역 구간을 거의 완료 (예측: 역에 도착) */
function interpolateApproaching(
	train: TrainPosition,
	currentCoord: ScreenCoord,
	prevId: string | null,
	nextId: string | null,
	stationScreenMap: Map<string, ScreenCoord>,
): InterpolatedTrain {
	if (prevId === null) {
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: PREDICT_ARRIVAL,
			fromStationId: train.stationId,
			toStationId: train.stationId,
			trackAngle: inferTrackAngle(currentCoord, nextId, null, stationScreenMap),
		};
	}
	const prevCoord = stationScreenMap.get(prevId);
	if (prevCoord === undefined) {
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: PREDICT_ARRIVAL,
			fromStationId: prevId,
			toStationId: train.stationId,
			trackAngle: inferTrackAngle(currentCoord, nextId, null, stationScreenMap),
		};
	}
	return {
		trainNo: train.trainNo,
		line: train.line,
		x: lerp(prevCoord.x, currentCoord.x, PREDICT_ARRIVAL),
		y: lerp(prevCoord.y, currentCoord.y, PREDICT_ARRIVAL),
		direction: train.direction,
		progress: PREDICT_ARRIVAL,
		fromStationId: prevId,
		toStationId: train.stationId,
		trackAngle: computeAngle(prevCoord.x, prevCoord.y, currentCoord.x, currentCoord.y),
	};
}

/** 도착/출발 상태의 예측 진행률을 결정한다 */
function resolvePredictT(
	status: "진입" | "도착" | "출발",
	pollHistory: TrainPollHistory | undefined,
): number {
	if (pollHistory !== undefined) {
		return computeDynamicProgress(status, pollHistory.repeatCount);
	}
	return status === "도착" ? PREDICT_DEPARTED : PREDICT_ENROUTE;
}

/**
 * 열차의 상태(진입/도착/출발)에 따라 예측 보간된 화면 좌표를 계산한다.
 * 다음 폴링 주기까지의 이동을 예측하여 목표 좌표를 앞당긴다.
 *
 * pollHistory가 제공되면 동적 예측률을 사용하고, 없으면 고정값을 사용한다.
 */
export function interpolateTrainPosition(
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
	pollHistory?: TrainPollHistory,
): InterpolatedTrain | null {
	const currentCoord = stationScreenMap.get(train.stationId);
	if (currentCoord === undefined) return null;

	const adj = adjacencyMap.get(train.stationId);

	// 하행 열차는 진행 방향이 반대이므로 prev/next를 스왑한다
	const prevId = train.direction === "하행" ? (adj?.next ?? null) : (adj?.prev ?? null);
	const nextId = train.direction === "하행" ? (adj?.prev ?? null) : (adj?.next ?? null);

	if (train.status === "진입") {
		return interpolateApproaching(train, currentCoord, prevId, nextId, stationScreenMap);
	}

	// 도착/출발 상태: 다음역 방향으로 예측 이동
	const predictT = resolvePredictT(train.status, pollHistory);

	if (nextId === null) {
		// 종착역: 이동 예측 불가, 현재역에 정지
		const trackAngle = inferTrackAngle(currentCoord, null, prevId, stationScreenMap);
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: predictT,
			fromStationId: train.stationId,
			toStationId: train.stationId,
			trackAngle,
		};
	}
	const nextCoord = stationScreenMap.get(nextId);
	if (nextCoord === undefined) {
		const trackAngle = inferTrackAngle(currentCoord, nextId, prevId, stationScreenMap);
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: predictT,
			fromStationId: train.stationId,
			toStationId: nextId,
			trackAngle,
		};
	}
	return {
		trainNo: train.trainNo,
		line: train.line,
		x: lerp(currentCoord.x, nextCoord.x, predictT),
		y: lerp(currentCoord.y, nextCoord.y, predictT),
		direction: train.direction,
		progress: predictT,
		fromStationId: train.stationId,
		toStationId: nextId,
		trackAngle: computeAngle(currentCoord.x, currentCoord.y, nextCoord.x, nextCoord.y),
	};
}
