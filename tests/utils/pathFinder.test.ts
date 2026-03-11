import { describe, expect, it } from "vitest";
import type { Station, StationLink } from "@/types/station";
import { buildLineGraphMap, buildStationGraph, findStationPath } from "@/utils/pathFinder";
import { buildTransferLinks, buildTransferMap } from "@/utils/transferStation";

const TEST_LINKS: StationLink[] = [
	{ source: "A", target: "B", line: 1 },
	{ source: "B", target: "C", line: 1 },
	{ source: "C", target: "D", line: 1 },
	{ source: "D", target: "E", line: 1 },
	// 분기역: C에서 2호선 분기
	{ source: "C", target: "F", line: 2 },
	{ source: "F", target: "G", line: 2 },
];

describe("buildStationGraph", () => {
	it("무방향 그래프를 정확히 구축한다", () => {
		const graph = buildStationGraph(TEST_LINKS);
		expect(graph.get("A")).toEqual(["B"]);
		expect(graph.get("B")).toEqual(expect.arrayContaining(["A", "C"]));
	});

	it("분기역의 이웃이 모든 노선을 포함한다", () => {
		const graph = buildStationGraph(TEST_LINKS);
		const cNeighbors = graph.get("C");
		expect(cNeighbors).toEqual(expect.arrayContaining(["B", "D", "F"]));
		expect(cNeighbors).toHaveLength(3);
	});

	it("중복 간선을 방지한다", () => {
		const duplicatedLinks: StationLink[] = [
			{ source: "A", target: "B", line: 1 },
			{ source: "A", target: "B", line: 1 },
		];
		const graph = buildStationGraph(duplicatedLinks);
		expect(graph.get("A")).toEqual(["B"]);
		expect(graph.get("B")).toEqual(["A"]);
	});
});

describe("findStationPath", () => {
	const graph = buildStationGraph(TEST_LINKS);

	it("인접역 경로를 반환한다 (2개)", () => {
		const path = findStationPath(graph, "A", "B");
		expect(path).toEqual(["A", "B"]);
	});

	it("3역 거리 경로를 반환한다", () => {
		const path = findStationPath(graph, "A", "D");
		expect(path).toEqual(["A", "B", "C", "D"]);
	});

	it("동일역이면 단일 원소 배열을 반환한다", () => {
		const path = findStationPath(graph, "A", "A");
		expect(path).toEqual(["A"]);
	});

	it("연결되지 않은 역은 빈 배열을 반환한다", () => {
		const path = findStationPath(graph, "A", "UNKNOWN");
		expect(path).toEqual([]);
	});

	it("분기역을 통과하는 경로를 탐색한다", () => {
		const path = findStationPath(graph, "A", "G");
		expect(path).toEqual(["A", "B", "C", "F", "G"]);
	});
});

describe("buildLineGraphMap", () => {
	it("호선별로 분리된 그래프를 구축한다", () => {
		const lineMap = buildLineGraphMap(TEST_LINKS);
		expect(lineMap.size).toBe(2);
		// 1호선: A-B-C-D-E
		const line1 = lineMap.get(1);
		expect(line1).toBeDefined();
		expect(line1?.get("A")).toEqual(["B"]);
		expect(line1?.get("C")).toEqual(expect.arrayContaining(["B", "D"]));
		expect(line1?.get("C")).not.toContain("F"); // F는 2호선
		// 2호선: C-F-G
		const line2 = lineMap.get(2);
		expect(line2).toBeDefined();
		expect(line2?.get("C")).toEqual(["F"]);
		expect(line2?.get("F")).toEqual(expect.arrayContaining(["C", "G"]));
	});

	it("호선 내 BFS는 다른 호선을 경유하지 않는다", () => {
		const lineMap = buildLineGraphMap(TEST_LINKS);
		const line1 = lineMap.get(1);
		// 1호선 그래프에서 F, G는 도달 불가
		const path = findStationPath(line1!, "A", "F");
		expect(path).toEqual([]);
	});
});

describe("환승 링크를 포함한 크로스라인 경로 탐색", () => {
	const CROSS_STATIONS: Station[] = [
		{ id: "L1S01", name: "서울역", line: 1, x: 0, y: 0 },
		{ id: "L1S02", name: "시청", line: 1, x: 0, y: 0 },
		{ id: "L2S01", name: "시청", line: 2, x: 0, y: 0 },
		{ id: "L2S02", name: "을지로입구", line: 2, x: 0, y: 0 },
	];

	const CROSS_LINKS: StationLink[] = [
		{ source: "L1S01", target: "L1S02", line: 1 },
		{ source: "L2S01", target: "L2S02", line: 2 },
	];

	it("환승을 포함한 크로스라인 경로를 찾는다", () => {
		const transferMap = buildTransferMap(CROSS_STATIONS);
		const transferLinks = buildTransferLinks(transferMap);
		const allLinks = [...CROSS_LINKS, ...transferLinks];
		const graph = buildStationGraph(allLinks);

		const path = findStationPath(graph, "L1S01", "L2S02");
		expect(path).toEqual(["L1S01", "L1S02", "L2S01", "L2S02"]);
	});

	it("환승 링크 없이는 다른 노선 역에 도달할 수 없다", () => {
		const graph = buildStationGraph(CROSS_LINKS);
		const path = findStationPath(graph, "L1S01", "L2S02");
		expect(path).toEqual([]);
	});
});
