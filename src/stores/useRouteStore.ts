import { create } from "zustand";
import type { Station, StationLink } from "@/types/station";
import { buildStationGraph, findStationPath } from "@/utils/pathFinder";
import { buildTransferLinks, buildTransferMap } from "@/utils/transferStation";

export interface TransferDetail {
	stationName: string;
	fromLine: number;
	toLine: number;
}

/** 경로에서 호선이 바뀌는 지점의 환승 상세 정보를 반환한다 */
export function getTransferDetails(
	path: string[],
	stationMap: Map<string, Station>,
): TransferDetail[] {
	if (path.length <= 1) return [];
	const details: TransferDetail[] = [];
	let currentLine = -1;
	for (const stationId of path) {
		const station = stationMap.get(stationId);
		if (station === undefined) continue;
		if (currentLine !== -1 && station.line !== currentLine) {
			details.push({
				stationName: station.name,
				fromLine: currentLine,
				toLine: station.line,
			});
		}
		currentLine = station.line;
	}
	return details;
}

interface RouteState {
	fromStation: Station | null;
	toStation: Station | null;
	route: string[] | null;
	transferCount: number;
	estimatedMinutes: number;
	transferDetails: TransferDetail[];
	isRouteMode: boolean;
	setFromStation: (station: Station | null) => void;
	setToStation: (
		station: Station | null,
		stations: Station[],
		links: StationLink[],
		stationMap: Map<string, Station>,
	) => void;
	clearRoute: () => void;
	toggleRouteMode: () => void;
}

/** 경로 내 환승 횟수를 계산한다 */
export function countTransfers(path: string[], stationMap: Map<string, Station>): number {
	if (path.length <= 1) return 0;
	let transfers = 0;
	let currentLine = -1;
	for (const stationId of path) {
		const station = stationMap.get(stationId);
		if (station === undefined) continue;
		if (currentLine !== -1 && station.line !== currentLine) {
			transfers++;
		}
		currentLine = station.line;
	}
	return transfers;
}

/** 역 간 2분 + 환승 3분 기준 예상 소요시간(분) */
export function estimateTime(path: string[], stationMap: Map<string, Station>): number {
	if (path.length <= 1) return 0;
	const stationTime = (path.length - 1) * 2;
	const transferTime = countTransfers(path, stationMap) * 3;
	return stationTime + transferTime;
}

export const useRouteStore = create<RouteState>((set) => ({
	fromStation: null,
	toStation: null,
	route: null,
	transferCount: 0,
	estimatedMinutes: 0,
	transferDetails: [],
	isRouteMode: false,

	setFromStation: (station) =>
		set({
			fromStation: station,
			toStation: null,
			route: null,
			transferCount: 0,
			estimatedMinutes: 0,
			transferDetails: [],
		}),

	setToStation: (station, stations, links, stationMap) => {
		if (station === null) {
			set({
				toStation: null,
				route: null,
				transferCount: 0,
				estimatedMinutes: 0,
				transferDetails: [],
			});
			return;
		}

		// 환승 링크를 포함한 그래프 구축
		const transferMap = buildTransferMap(stations);
		const transferLinks = buildTransferLinks(transferMap);
		const allLinks = [...links, ...transferLinks];
		const graph = buildStationGraph(allLinks);

		set((state) => {
			if (state.fromStation === null) return { toStation: station };

			const route = findStationPath(graph, state.fromStation.id, station.id);
			if (route.length === 0) {
				return {
					toStation: station,
					route: null,
					transferCount: 0,
					estimatedMinutes: 0,
					transferDetails: [],
				};
			}

			return {
				toStation: station,
				route,
				transferCount: countTransfers(route, stationMap),
				estimatedMinutes: estimateTime(route, stationMap),
				transferDetails: getTransferDetails(route, stationMap),
			};
		});
	},

	clearRoute: () =>
		set({
			fromStation: null,
			toStation: null,
			route: null,
			transferCount: 0,
			estimatedMinutes: 0,
			transferDetails: [],
			isRouteMode: false,
		}),

	toggleRouteMode: () =>
		set((state) => {
			if (state.isRouteMode) {
				// 모드 해제 시 경로도 초기화
				return {
					isRouteMode: false,
					fromStation: null,
					toStation: null,
					route: null,
					transferCount: 0,
					estimatedMinutes: 0,
					transferDetails: [],
				};
			}
			return { isRouteMode: true };
		}),
}));
