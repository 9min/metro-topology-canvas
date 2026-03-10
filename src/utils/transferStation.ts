import type { Station, StationLink } from "@/types/station";

/** 역 이름 → 같은 이름의 역(다른 호선) 배열. size ≥ 2인 것만 포함 */
export type TransferMap = Map<string, Station[]>;

/** stations 배열에서 환승역(이름이 같은 역이 2개 이상)을 그룹핑한다 */
export function buildTransferMap(stations: Station[]): TransferMap {
	const grouped = new Map<string, Station[]>();
	for (const station of stations) {
		const existing = grouped.get(station.name);
		if (existing !== undefined) {
			existing.push(station);
		} else {
			grouped.set(station.name, [station]);
		}
	}

	// size < 2인 항목 제거
	const result: TransferMap = new Map();
	for (const [name, group] of grouped) {
		if (group.length >= 2) {
			result.set(name, group);
		}
	}
	return result;
}

/** 환승역 이름에 해당하는 호선 번호 배열을 반환한다 */
export function getTransferLinesForStation(
	transferMap: TransferMap,
	stationName: string,
): number[] {
	const group = transferMap.get(stationName);
	if (group === undefined) return [];
	return group.map((s) => s.line);
}

/** 같은 이름 역들 사이에 환승 링크(line: 0)를 양방향으로 생성한다 */
export function buildTransferLinks(transferMap: TransferMap): StationLink[] {
	const links: StationLink[] = [];
	for (const group of transferMap.values()) {
		// 그룹 내 모든 쌍을 양방향 연결
		for (let i = 0; i < group.length; i++) {
			for (let j = i + 1; j < group.length; j++) {
				const a = group[i];
				const b = group[j];
				if (a === undefined || b === undefined) continue;
				links.push({ source: a.id, target: b.id, line: 0 });
			}
		}
	}
	return links;
}
