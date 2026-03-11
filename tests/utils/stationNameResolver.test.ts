import { describe, expect, it } from "vitest";
import type { Station, StationLink } from "@/types/station";
import {
	buildAdjacencyMap,
	buildStationNameMap,
	resolveStationId,
} from "@/utils/stationNameResolver";

const MOCK_STATIONS: Station[] = [
	{ id: "L1S08", name: "서울역", line: 1, x: 126.973, y: 37.555 },
	{ id: "L1S09", name: "시청", line: 1, x: 126.978, y: 37.566 },
	{ id: "L2S01", name: "시청", line: 2, x: 126.978, y: 37.566 },
	{ id: "L1S10", name: "종각", line: 1, x: 126.983, y: 37.57 },
];

const MOCK_LINKS: StationLink[] = [
	{ source: "L1S08", target: "L1S09", line: 1 },
	{ source: "L1S09", target: "L1S10", line: 1 },
];

describe("buildStationNameMap", () => {
	it("호선:역명 복합 키로 매핑한다", () => {
		const nameMap = buildStationNameMap(MOCK_STATIONS);
		expect(nameMap.get("1:서울역")).toBe("L1S08");
		expect(nameMap.get("1:시청")).toBe("L1S09");
	});

	it("중복 역명을 호선으로 구분한다", () => {
		const nameMap = buildStationNameMap(MOCK_STATIONS);
		expect(nameMap.get("1:시청")).toBe("L1S09");
		expect(nameMap.get("2:시청")).toBe("L2S01");
	});
});

describe("resolveStationId", () => {
	it("존재하는 역의 ID를 반환한다", () => {
		const nameMap = buildStationNameMap(MOCK_STATIONS);
		expect(resolveStationId(nameMap, 1, "서울역")).toBe("L1S08");
	});

	it("존재하지 않는 역은 undefined를 반환한다", () => {
		const nameMap = buildStationNameMap(MOCK_STATIONS);
		expect(resolveStationId(nameMap, 1, "없는역")).toBeUndefined();
	});
});

describe("buildAdjacencyMap", () => {
	it("인접 역을 올바르게 연결한다", () => {
		const adj = buildAdjacencyMap(MOCK_LINKS);

		const seoul = adj.get("L1S08");
		expect(seoul?.prevs).toEqual([]);
		expect(seoul?.nexts).toEqual(["L1S09"]);

		const city = adj.get("L1S09");
		expect(city?.prevs).toEqual(["L1S08"]);
		expect(city?.nexts).toEqual(["L1S10"]);

		const jonggak = adj.get("L1S10");
		expect(jonggak?.prevs).toEqual(["L1S09"]);
		expect(jonggak?.nexts).toEqual([]);
	});

	it("분기점에서 다중 nexts를 저장한다", () => {
		const branchLinks: StationLink[] = [
			{ source: "A", target: "B", line: 1 },
			{ source: "A", target: "C", line: 1 },
			{ source: "A", target: "D", line: 1 },
		];
		const adj = buildAdjacencyMap(branchLinks);
		const a = adj.get("A");
		expect(a?.nexts).toEqual(["B", "C", "D"]);
		expect(a?.prevs).toEqual([]);
		// B, C, D 모두 A를 prev로 가짐
		expect(adj.get("B")?.prevs).toEqual(["A"]);
		expect(adj.get("C")?.prevs).toEqual(["A"]);
		expect(adj.get("D")?.prevs).toEqual(["A"]);
	});

	it("중복 링크를 무시한다", () => {
		const dupLinks: StationLink[] = [
			{ source: "A", target: "B", line: 1 },
			{ source: "A", target: "B", line: 1 },
		];
		const adj = buildAdjacencyMap(dupLinks);
		expect(adj.get("A")?.nexts).toEqual(["B"]);
		expect(adj.get("B")?.prevs).toEqual(["A"]);
	});
});
