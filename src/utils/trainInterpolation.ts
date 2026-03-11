import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";

/** 두 값 사이의 선형 보간 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * 상행/하행 방향에 따라 다음 역을 향하는 각도를 계산한다.
 * - 상행: prevs 방향 (역번호 감소 방향)
 * - 하행: nexts 방향 (역번호 증가 방향)
 */
function computeDirectionAngle(
	currentCoord: ScreenCoord,
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
): number {
	const adj = adjacencyMap.get(train.stationId);
	if (adj === undefined) return 0;

	const nextStationId = train.direction === "상행" ? adj.prevs[0] : adj.nexts[0];
	if (nextStationId === undefined) return 0;

	const nextCoord = stationScreenMap.get(nextStationId);
	if (nextCoord === undefined) return 0;

	return Math.atan2(nextCoord.y - currentCoord.y, nextCoord.x - currentCoord.x);
}

/**
 * 열차의 현재 역 좌표를 반환한다.
 * trackAngle은 상행/하행에 따라 다음 역 방향을 향한다.
 * toStationId는 진행 방향의 다음 역으로 설정하여 혼잡도 히트맵이 올바른 구간에 표시되도록 한다.
 * "출발" 상태이면 다음 역 좌표를 타겟으로 설정하여 TrainAnimator가 9초 이동을 수행하도록 한다.
 * 다음 폴에서 역이 변경되면 TrainAnimator가 9초 등속 직선 이동을 수행한다.
 */
export function interpolateTrainPosition(
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap?: Map<string, AdjacencyInfo>,
): InterpolatedTrain | null {
	const currentCoord = stationScreenMap.get(train.stationId);
	if (currentCoord === undefined) return null;

	let trackAngle = 0;
	let toStationId = train.stationId;
	let targetCoord = currentCoord; // 기본: 현재 역 좌표

	if (adjacencyMap !== undefined) {
		trackAngle = computeDirectionAngle(currentCoord, train, stationScreenMap, adjacencyMap);

		// 진행 방향의 다음 역을 toStationId로 설정 — 히트맵이 실제 구간에 표시되도록 한다
		const adj = adjacencyMap.get(train.stationId);
		if (adj !== undefined) {
			const nextId = train.direction === "상행" ? adj.prevs[0] : adj.nexts[0];
			if (nextId !== undefined) {
				toStationId = nextId;

				// "출발" 상태이면 다음 역 좌표로 타겟 변경 → TrainAnimator가 현재→다음역 이동 수행
				if (train.status === "출발") {
					const nextCoord = stationScreenMap.get(nextId);
					if (nextCoord !== undefined) {
						targetCoord = nextCoord;
					}
				}
			}
		}
	}

	return {
		trainNo: train.trainNo,
		line: train.line,
		x: targetCoord.x,
		y: targetCoord.y,
		direction: train.direction,
		progress: 0,
		fromStationId: train.stationId,
		toStationId,
		trackAngle,
	};
}
