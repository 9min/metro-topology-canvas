import { describe, expect, it } from "vitest";
import type { ScreenCoord } from "@/types/map";
import type { TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { interpolateTrainPosition, lerp } from "@/utils/trainInterpolation";

const SCREEN_MAP = new Map<string, ScreenCoord>([
	["S01", { x: 100, y: 200 }],
	["S02", { x: 200, y: 300 }],
	["S03", { x: 300, y: 400 }],
]);

const ADJ_MAP = new Map<string, AdjacencyInfo>([
	["S01", { prevs: [], nexts: ["S02"] }],
	["S02", { prevs: ["S01"], nexts: ["S03"] }],
	["S03", { prevs: ["S02"], nexts: [] }],
]);

const BASE_TRAIN: TrainPosition = {
	trainNo: "1001",
	stationId: "S02",
	stationName: "테스트역",
	line: 1,
	direction: "상행",
	status: "도착",
};

describe("lerp", () => {
	it("t=0이면 a를 반환한다", () => {
		expect(lerp(10, 20, 0)).toBe(10);
	});

	it("t=1이면 b를 반환한다", () => {
		expect(lerp(10, 20, 1)).toBe(20);
	});

	it("t=0.5이면 중간값을 반환한다", () => {
		expect(lerp(10, 20, 0.5)).toBe(15);
	});
});

describe("interpolateTrainPosition", () => {
	it("현재역 좌표를 그대로 반환한다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		expect(result?.x).toBe(200);
		expect(result?.y).toBe(300);
	});

	it("progress는 항상 0이다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result?.progress).toBe(0);
	});

	it("fromStationId는 현재역, toStationId는 진행 방향의 다음역이다", () => {
		// BASE_TRAIN: S02, 상행 → prev 방향인 S01이 toStationId
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result?.fromStationId).toBe("S02");
		expect(result?.toStationId).toBe("S01");
	});

	it("adjacencyMap 없이 호출하면 toStationId가 현재역이다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP);
		expect(result?.fromStationId).toBe("S02");
		expect(result?.toStationId).toBe("S02");
	});

	it("존재하지 않는 역 ID는 null을 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "UNKNOWN" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).toBeNull();
	});

	it("진입/도착 상태에서 현재역 좌표를 반환한다", () => {
		// BASE_TRAIN: S02(200,300), 상행
		for (const status of ["진입", "도착"] as const) {
			const train: TrainPosition = { ...BASE_TRAIN, status };
			const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
			expect(result?.x).toBe(200);
			expect(result?.y).toBe(300);
		}
	});

	it("출발 상태에서 다음역 좌표를 반환한다", () => {
		// BASE_TRAIN: S02(200,300), 상행 → prev 방향인 S01(100,200)이 다음역
		const train: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result?.x).toBe(100);
		expect(result?.y).toBe(200);
	});

	it("출발 상태에서 fromStationId는 현재역, toStationId는 다음역이다", () => {
		// BASE_TRAIN: S02, 상행 → toStationId = S01
		const train: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result?.fromStationId).toBe("S02");
		expect(result?.toStationId).toBe("S01");
	});

	it("종착역에서 출발 상태이면 현재역 좌표를 유지한다", () => {
		// S01은 prevs=[] → 상행 시 다음역 없음 → targetCoord = currentCoord
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S01", status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result?.x).toBe(100);
		expect(result?.y).toBe(200);
	});

	it("adjacencyMap 없이 출발 상태이면 현재역 좌표를 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP);
		expect(result?.x).toBe(200);
		expect(result?.y).toBe(300);
	});

	it("adjacencyMap 없이 호출하면 trackAngle이 0이다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP);
		expect(result?.trackAngle).toBe(0);
	});
});

describe("trackAngle — 상행/하행 방향", () => {
	it("하행 열차는 nexts 방향(다음역)을 향한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, direction: "하행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// S02(200,300)→S03(300,400) 방향
		const expected = Math.atan2(400 - 300, 300 - 200);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("상행 열차는 prevs 방향(이전역)을 향한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, direction: "상행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// S02(200,300)→S01(100,200) 방향
		const expected = Math.atan2(200 - 300, 100 - 200);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("종착역(다음역 없음)이면 trackAngle이 0이다", () => {
		// S03은 nexts=[] → 하행 시 다음역 없음
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S03", direction: "하행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result?.trackAngle).toBe(0);
	});

	it("시발역(이전역 없음)이면 trackAngle이 0이다", () => {
		// S01은 prevs=[] → 상행 시 이전역 없음
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S01", direction: "상행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result?.trackAngle).toBe(0);
	});

	it("S01 하행 열차는 S02 방향을 향한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S01", direction: "하행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		// S01(100,200)→S02(200,300) 방향
		const expected = Math.atan2(300 - 200, 200 - 100);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("S03 상행 열차는 S02 방향을 향한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S03", direction: "상행" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		// S03(300,400)→S02(200,300) 방향
		const expected = Math.atan2(300 - 400, 200 - 300);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});
});
