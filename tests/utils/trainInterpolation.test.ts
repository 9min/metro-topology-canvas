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
	["S01", { prev: null, next: "S02" }],
	["S02", { prev: "S01", next: "S03" }],
	["S03", { prev: "S02", next: null }],
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
	it("도착 상태: 현재역 좌표를 반환한다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		expect(result?.x).toBe(200);
		expect(result?.y).toBe(300);
		expect(result?.progress).toBe(1);
	});

	it("진입 상태: 이전역→현재역 80% 지점을 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, status: "진입" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// lerp(100, 200, 0.8) = 180, lerp(200, 300, 0.8) = 280
		expect(result?.x).toBe(180);
		expect(result?.y).toBe(280);
		expect(result?.progress).toBe(0.8);
		expect(result?.fromStationId).toBe("S01");
		expect(result?.toStationId).toBe("S02");
	});

	it("출발 상태: 현재역→다음역 20% 지점을 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// lerp(200, 300, 0.2) = 220, lerp(300, 400, 0.2) = 320
		expect(result?.x).toBe(220);
		expect(result?.y).toBe(320);
		expect(result?.progress).toBe(0.2);
		expect(result?.fromStationId).toBe("S02");
		expect(result?.toStationId).toBe("S03");
	});

	it("존재하지 않는 역 ID는 null을 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "UNKNOWN" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).toBeNull();
	});

	it("진입 상태에서 이전역이 없으면 현재역 좌표를 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S01", status: "진입" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		expect(result?.x).toBe(100);
		expect(result?.y).toBe(200);
	});

	it("출발 상태에서 다음역이 없으면 현재역 좌표를 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S03", status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		expect(result?.x).toBe(300);
		expect(result?.y).toBe(400);
	});
});
