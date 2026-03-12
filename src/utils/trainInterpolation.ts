import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { estimateSimProgress, type TrainSnapshot } from "@/utils/trainLocalCache";

/** 두 값 사이의 선형 보간 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

interface NextStationInfo {
	nextStationId: string;
	nextX: number;
	nextY: number;
	trackAngle: number;
}

/** 인접 역 정보로 다음 역 좌표와 트랙 각도를 계산한다 */
function resolveNextStation(
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
	stationCoord: ScreenCoord,
): NextStationInfo {
	const fallback: NextStationInfo = {
		nextStationId: train.stationId,
		nextX: stationCoord.x,
		nextY: stationCoord.y,
		trackAngle: 0,
	};
	const adj = adjacencyMap.get(train.stationId);
	if (adj === undefined) return fallback;
	const nextId = train.direction === "상행" ? adj.prevs[0] : adj.nexts[0];
	if (nextId === undefined) return fallback;
	const nextCoord = stationScreenMap.get(nextId);
	if (nextCoord === undefined) return fallback;
	return {
		nextStationId: nextId,
		nextX: nextCoord.x,
		nextY: nextCoord.y,
		trackAngle: Math.atan2(nextCoord.y - stationCoord.y, nextCoord.x - stationCoord.x),
	};
}

/**
 * 열차의 현재 역 좌표(stationX/Y)와 다음 역 좌표(nextX/Y), trackAngle을 계산한다.
 * status는 TrainPosition에서 그대로 전달하여 TrainAnimator가 직접 사용한다.
 * - "출발": TrainAnimator가 stationX/Y → nextX/Y 10초 이동
 * - "도착"/"진입": TrainAnimator가 stationX/Y에서 대기
 *
 * @param snapshot 이전 세션 스냅샷 (페이지 리로드·복귀 열차의 simProgress 복원용)
 */
export function interpolateTrainPosition(
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap?: Map<string, AdjacencyInfo>,
	snapshot?: TrainSnapshot,
): InterpolatedTrain | null {
	const station = stationScreenMap.get(train.stationId);
	if (station === undefined) return null;

	const { nextStationId, nextX, nextY, trackAngle } =
		adjacencyMap !== undefined
			? resolveNextStation(train, stationScreenMap, adjacencyMap, station)
			: { nextStationId: train.stationId, nextX: station.x, nextY: station.y, trackAngle: 0 };

	// "출발" 상태 + 유효 스냅샷이 있으면 경과 시간으로 simProgress 역산
	// → 페이지 리로드 직후 열차가 역 좌표에서 순간이동하는 현상 방지
	const simProgress =
		train.status === "출발" && snapshot !== undefined
			? estimateSimProgress(train.stationId, snapshot)
			: undefined;

	return {
		trainNo: train.trainNo,
		line: train.line,
		direction: train.direction,
		status: train.status,
		stationId: train.stationId,
		stationX: station.x,
		stationY: station.y,
		nextStationId,
		nextX,
		nextY,
		trackAngle,
		...(simProgress !== undefined ? { simProgress } : {}),
	};
}
