/**
 * 공유 테스트 인프라 + 재생 헬퍼.
 * directionReversal.test.ts와 trainMovementDiagnostics.test.ts에서 공통 사용.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ScreenCoord } from "@/types/map";
import type { Station, StationLink } from "@/types/station";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import { gpsToScreen } from "@/utils/coordTransform";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import {
	buildAdjacencyMap,
	buildStationNameMap,
	resolveStationId,
} from "@/utils/stationNameResolver";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";

// --- 타입 ---

export interface SmssTrainRaw {
	trainNo: string;
	stationName: string;
	line: number;
	direction: "상행" | "하행";
	status: "진입" | "도착" | "출발";
}

export interface PrevPollEntry {
	/** 연속 누락 폴 횟수 */
	missedCount: number;
}

export interface PollResult {
	pollIndex: number;
	timestamp: string;
	interpolated: InterpolatedTrain[];
	positions: TrainPosition[];
}

export interface Infra {
	stations: Station[];
	links: StationLink[];
	stationScreenMap: Map<string, ScreenCoord>;
	stationNameMap: Map<string, string>;
	adjacencyMap: Map<string, AdjacencyInfo>;
}

// --- 인프라 구축 ---

const MAP_BOUNDS = { minLon: 126.6, maxLon: 127.25, minLat: 37.25, maxLat: 37.96 };
const CANVAS_WIDTH = 3000;
const CANVAS_HEIGHT = 2000;
const CANVAS_PADDING = 100;

const transformParams = {
	bounds: MAP_BOUNDS,
	canvasWidth: CANVAS_WIDTH,
	canvasHeight: CANVAS_HEIGHT,
	padding: CANVAS_PADDING,
};

/** 정적 데이터를 로드하고 인프라 객체를 구축한다 */
export function loadInfra(): Infra {
	const stationsPath = resolve(__dirname, "../../../src/data/stations.json");
	const linksPath = resolve(__dirname, "../../../src/data/links.json");

	const stations: Station[] = JSON.parse(readFileSync(stationsPath, "utf-8"));
	const links: StationLink[] = JSON.parse(readFileSync(linksPath, "utf-8"));

	const stationScreenMap = new Map<string, ScreenCoord>();
	for (const station of stations) {
		stationScreenMap.set(station.id, gpsToScreen(station.x, station.y, transformParams));
	}

	const stationNameMap = buildStationNameMap(stations);
	const adjacencyMap = buildAdjacencyMap(links);

	return { stations, links, stationScreenMap, stationNameMap, adjacencyMap };
}

/** SMSS 원시 열차 데이터를 TrainPosition 배열로 변환한다 */
export function resolveSmssTrains(
	rawTrains: SmssTrainRaw[],
	stationNameMap: Map<string, string>,
): TrainPosition[] {
	const resolved: TrainPosition[] = [];
	for (const raw of rawTrains) {
		const stationId = resolveStationId(stationNameMap, raw.line, raw.stationName);
		if (stationId !== undefined) {
			resolved.push({
				trainNo: raw.trainNo,
				stationId,
				stationName: raw.stationName,
				line: raw.line,
				direction: raw.direction,
				status: raw.status,
			});
		}
	}
	return resolved;
}

/** fixture 파일을 로드하여 전체 폴링을 재생한다 (역 좌표 배치 + 방향 각도) */
export function replayPolling(fixturePath: string, infra: Infra): PollResult[] {
	const apiData = JSON.parse(readFileSync(fixturePath, "utf-8"));
	const results: PollResult[] = [];

	for (const snapshot of apiData.snapshots) {
		if (snapshot.smss === null || !Array.isArray(snapshot.smss.trains)) continue;

		const positions = resolveSmssTrains(snapshot.smss.trains, infra.stationNameMap);
		const interpolated: InterpolatedTrain[] = [];

		for (const train of positions) {
			const result = interpolateTrainPosition(train, infra.stationScreenMap, infra.adjacencyMap);
			if (result !== null) {
				interpolated.push(result);
			}
		}

		results.push({
			pollIndex: snapshot.pollIndex,
			timestamp: snapshot.timestamp,
			interpolated,
			positions,
		});
	}

	return results;
}
