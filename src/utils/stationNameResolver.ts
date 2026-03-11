import type { Station, StationLink } from "@/types/station";

/** "호선:역명" 복합 키 → station ID 매핑을 생성한다 */
export function buildStationNameMap(stations: Station[]): Map<string, string> {
	const nameMap = new Map<string, string>();
	for (const station of stations) {
		const key = `${station.line}:${station.name}`;
		nameMap.set(key, station.id);
	}
	return nameMap;
}

/** 호선 번호와 역명으로 station ID를 조회한다 */
export function resolveStationId(
	nameMap: Map<string, string>,
	line: number,
	stationName: string,
): string | undefined {
	return nameMap.get(`${line}:${stationName}`);
}

export interface AdjacencyInfo {
	prevs: string[];
	nexts: string[];
}

/**
 * links 데이터를 기반으로 역별 인접 역 정보를 생성한다.
 * source→target 방향을 상행으로 간주한다.
 * 역의 prev = 이전 역(source 방향), next = 다음 역(target 방향)
 */
export function buildAdjacencyMap(links: StationLink[]): Map<string, AdjacencyInfo> {
	const adjacencyMap = new Map<string, AdjacencyInfo>();

	const getOrCreate = (id: string): AdjacencyInfo => {
		const existing = adjacencyMap.get(id);
		if (existing !== undefined) return existing;
		const info: AdjacencyInfo = { prevs: [], nexts: [] };
		adjacencyMap.set(id, info);
		return info;
	};

	for (const link of links) {
		const sourceInfo = getOrCreate(link.source);
		const targetInfo = getOrCreate(link.target);

		// source → target: source의 nexts에 target 추가, target의 prevs에 source 추가
		if (!sourceInfo.nexts.includes(link.target)) {
			sourceInfo.nexts.push(link.target);
		}
		if (!targetInfo.prevs.includes(link.source)) {
			targetInfo.prevs.push(link.source);
		}
	}

	return adjacencyMap;
}
