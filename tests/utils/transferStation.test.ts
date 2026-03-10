import { describe, expect, it } from "vitest";
import type { Station } from "@/types/station";
import {
	buildTransferLinks,
	buildTransferMap,
	getTransferLinesForStation,
} from "@/utils/transferStation";

const MOCK_STATIONS: Station[] = [
	{ id: "L1S10", name: "종로3가", line: 1, x: 126.99, y: 37.57 },
	{ id: "L3S20", name: "종로3가", line: 3, x: 126.99, y: 37.57 },
	{ id: "L5S17", name: "종로3가", line: 5, x: 126.99, y: 37.57 },
	{ id: "L1S09", name: "시청", line: 1, x: 126.978, y: 37.566 },
	{ id: "L2S01", name: "시청", line: 2, x: 126.978, y: 37.566 },
	{ id: "L1S01", name: "서울역", line: 1, x: 126.972, y: 37.555 },
];

describe("buildTransferMap", () => {
	it("같은 이름 다른 호선 역을 그룹핑한다", () => {
		const map = buildTransferMap(MOCK_STATIONS);
		expect(map.has("종로3가")).toBe(true);
		expect(map.has("시청")).toBe(true);
		expect(map.get("종로3가")).toHaveLength(3);
		expect(map.get("시청")).toHaveLength(2);
	});

	it("단일 호선 역은 제외된다", () => {
		const map = buildTransferMap(MOCK_STATIONS);
		expect(map.has("서울역")).toBe(false);
	});
});

describe("getTransferLinesForStation", () => {
	it("종로3가는 3개 호선을 반환한다", () => {
		const map = buildTransferMap(MOCK_STATIONS);
		const lines = getTransferLinesForStation(map, "종로3가");
		expect(lines).toEqual(expect.arrayContaining([1, 3, 5]));
		expect(lines).toHaveLength(3);
	});

	it("비환승역은 빈 배열을 반환한다", () => {
		const map = buildTransferMap(MOCK_STATIONS);
		const lines = getTransferLinesForStation(map, "서울역");
		expect(lines).toEqual([]);
	});
});

describe("buildTransferLinks", () => {
	it("환승 링크를 올바르게 생성한다", () => {
		const map = buildTransferMap(MOCK_STATIONS);
		const links = buildTransferLinks(map);

		// 종로3가: 3개 역 → C(3,2) = 3쌍, 시청: 2개 역 → 1쌍 = 총 4개
		expect(links).toHaveLength(4);

		// 모든 링크의 line은 0 (환승 표시용)
		for (const link of links) {
			expect(link.line).toBe(0);
		}

		// 시청 환승 링크 존재 확인
		const cityHallLink = links.find(
			(l) =>
				(l.source === "L1S09" && l.target === "L2S01") ||
				(l.source === "L2S01" && l.target === "L1S09"),
		);
		expect(cityHallLink).toBeDefined();
	});
});
