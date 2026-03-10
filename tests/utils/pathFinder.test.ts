import { describe, expect, it } from "vitest";
import type { StationLink } from "@/types/station";
import { buildStationGraph, findStationPath } from "@/utils/pathFinder";

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
