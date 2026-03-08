import { describe, expect, it } from "vitest";
import {
	buildAdjacencyMap,
	buildStationNameMap,
	resolveStationId,
} from "@/utils/stationNameResolver";
import type { Station, StationLink } from "@/types/station";

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
		expect(seoul?.prev).toBeNull();
		expect(seoul?.next).toBe("L1S09");

		const city = adj.get("L1S09");
		expect(city?.prev).toBe("L1S08");
		expect(city?.next).toBe("L1S10");

		const jonggak = adj.get("L1S10");
		expect(jonggak?.prev).toBe("L1S09");
		expect(jonggak?.next).toBeNull();
	});
});
