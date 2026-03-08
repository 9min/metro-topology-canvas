import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";

/** 두 값 사이의 선형 보간 */
export function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

/**
 * 열차의 상태(진입/도착/출발)에 따라 보간된 화면 좌표를 계산한다.
 *
 * - 진입: 이전역 → 현재역 80% 지점
 * - 도착: 현재역 위치
 * - 출발: 현재역 → 다음역 20% 지점
 */
export function interpolateTrainPosition(
	train: TrainPosition,
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
): InterpolatedTrain | null {
	const currentCoord = stationScreenMap.get(train.stationId);
	if (currentCoord === undefined) return null;

	const adj = adjacencyMap.get(train.stationId);

	if (train.status === "도착") {
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: 1,
			fromStationId: train.stationId,
			toStationId: train.stationId,
		};
	}

	if (train.status === "진입") {
		// 이전역에서 현재역으로 80% 지점
		const prevId = adj?.prev ?? null;
		if (prevId === null) {
			return {
				trainNo: train.trainNo,
				line: train.line,
				x: currentCoord.x,
				y: currentCoord.y,
				direction: train.direction,
				progress: 0.8,
				fromStationId: train.stationId,
				toStationId: train.stationId,
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
				progress: 0.8,
				fromStationId: prevId,
				toStationId: train.stationId,
			};
		}
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: lerp(prevCoord.x, currentCoord.x, 0.8),
			y: lerp(prevCoord.y, currentCoord.y, 0.8),
			direction: train.direction,
			progress: 0.8,
			fromStationId: prevId,
			toStationId: train.stationId,
		};
	}

	// 출발: 현재역에서 다음역으로 20% 지점
	const nextId = adj?.next ?? null;
	if (nextId === null) {
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: 0.2,
			fromStationId: train.stationId,
			toStationId: train.stationId,
		};
	}
	const nextCoord = stationScreenMap.get(nextId);
	if (nextCoord === undefined) {
		return {
			trainNo: train.trainNo,
			line: train.line,
			x: currentCoord.x,
			y: currentCoord.y,
			direction: train.direction,
			progress: 0.2,
			fromStationId: train.stationId,
			toStationId: nextId,
		};
	}
	return {
		trainNo: train.trainNo,
		line: train.line,
		x: lerp(currentCoord.x, nextCoord.x, 0.2),
		y: lerp(currentCoord.y, nextCoord.y, 0.2),
		direction: train.direction,
		progress: 0.2,
		fromStationId: train.stationId,
		toStationId: nextId,
	};
}
