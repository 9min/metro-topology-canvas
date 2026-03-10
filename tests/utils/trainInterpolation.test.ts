import { describe, expect, it } from "vitest";
import type { ScreenCoord } from "@/types/map";
import type { TrainPollHistory, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { computeDynamicProgress, interpolateTrainPosition, lerp } from "@/utils/trainInterpolation";

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
	it("도착 상태: 현재역→다음역 35% 예측 위치를 반환한다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// lerp(200, 300, 0.35) = 235, lerp(300, 400, 0.35) = 335
		expect(result?.x).toBe(235);
		expect(result?.y).toBe(335);
		expect(result?.progress).toBe(0.35);
		expect(result?.fromStationId).toBe("S02");
		expect(result?.toStationId).toBe("S03");
	});

	it("진입 상태: 이전역→현재역 100% (역 도착 예측)를 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, status: "진입" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// lerp(100, 200, 1.0) = 200, lerp(200, 300, 1.0) = 300
		expect(result?.x).toBe(200);
		expect(result?.y).toBe(300);
		expect(result?.progress).toBe(1.0);
		expect(result?.fromStationId).toBe("S01");
		expect(result?.toStationId).toBe("S02");
	});

	it("출발 상태: 현재역→다음역 70% 예측 위치를 반환한다", () => {
		const train: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// lerp(200, 300, 0.7) = 270, lerp(300, 400, 0.7) = 370
		expect(result?.x).toBe(270);
		expect(result?.y).toBe(370);
		expect(result?.progress).toBe(0.7);
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

	it("진입 상태 prevId=null 시 nextId 기준으로 trackAngle을 계산한다", () => {
		// S01은 prev=null, next=S02 → S01→S02 방향
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S01", status: "진입" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// S01(100,200)→S02(200,300) 방향
		const expected = Math.atan2(300 - 200, 200 - 100);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("출발 상태 nextId=null 시 prevId 기준으로 trackAngle을 계산한다", () => {
		// S03은 prev=S02, next=null → S02→S03 방향 (도래 방향)
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S03", status: "출발" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// fallback: S02(200,300)→S03(300,400) 방향
		const expected = Math.atan2(400 - 300, 300 - 200);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("도착 상태 trackAngle이 nextId(진행 방향) 기준이다", () => {
		// S02 도착, 상행: next=S03 → S02→S03 방향
		const train: TrainPosition = { ...BASE_TRAIN, stationId: "S02", status: "도착" };
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// S02(200,300)→S03(300,400) 방향
		const expected = Math.atan2(400 - 300, 300 - 200);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("하행 열차 도착 시 trackAngle이 하행 방향이다", () => {
		// S02 하행: prev/next 스왑 → prevId=S03, nextId=S01
		// S02→S01 방향
		const train: TrainPosition = {
			...BASE_TRAIN,
			stationId: "S02",
			status: "도착",
			direction: "하행",
		};
		const result = interpolateTrainPosition(train, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// S02(200,300)→S01(100,200) 방향
		const expected = Math.atan2(200 - 300, 100 - 200);
		expect(result?.trackAngle).toBeCloseTo(expected);
	});

	it("도착→출발 전환 시 예측 위치가 순방향으로 진행한다", () => {
		// 도착: 35% toward next, 출발: 70% toward next
		const arrived: TrainPosition = { ...BASE_TRAIN, status: "도착" };
		const departed: TrainPosition = { ...BASE_TRAIN, status: "출발" };
		const r1 = interpolateTrainPosition(arrived, SCREEN_MAP, ADJ_MAP);
		const r2 = interpolateTrainPosition(departed, SCREEN_MAP, ADJ_MAP);
		expect(r1).not.toBeNull();
		expect(r2).not.toBeNull();
		// 출발 예측이 도착 예측보다 다음역에 더 가깝다
		expect(r2?.x).toBeGreaterThan(r1?.x ?? 0);
		expect(r2?.y).toBeGreaterThan(r1?.y ?? 0);
	});

	it("pollHistory 없이 호출하면 기존 고정 예측값을 사용한다", () => {
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP);
		expect(result).not.toBeNull();
		// 고정값 0.35 사용
		expect(result?.progress).toBe(0.35);
	});

	it("pollHistory가 있으면 동적 예측률을 사용한다", () => {
		const history: TrainPollHistory = {
			prevStatus: "도착",
			prevStationId: "S02",
			repeatCount: 2,
		};
		const result = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP, history);
		expect(result).not.toBeNull();
		// computeDynamicProgress("도착", 2) = 0.35 + 0.20 = 0.55
		expect(result?.progress).toBeCloseTo(0.55);
	});

	it("pollHistory 반복 시 좌표가 다음역 방향으로 전진한다", () => {
		const h1: TrainPollHistory = { prevStatus: "도착", prevStationId: "S02", repeatCount: 1 };
		const h2: TrainPollHistory = { prevStatus: "도착", prevStationId: "S02", repeatCount: 3 };
		const r1 = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP, h1);
		const r2 = interpolateTrainPosition(BASE_TRAIN, SCREEN_MAP, ADJ_MAP, h2);
		expect(r1).not.toBeNull();
		expect(r2).not.toBeNull();
		expect(r2?.x).toBeGreaterThan(r1?.x ?? 0);
	});

	it("진입→도착 전환 시 예측 위치가 순방향으로 진행한다", () => {
		// 진입: 현재역 위치, 도착: 35% toward next
		const entering: TrainPosition = { ...BASE_TRAIN, status: "진입" };
		const arrived: TrainPosition = { ...BASE_TRAIN, status: "도착" };
		const r1 = interpolateTrainPosition(entering, SCREEN_MAP, ADJ_MAP);
		const r2 = interpolateTrainPosition(arrived, SCREEN_MAP, ADJ_MAP);
		expect(r1).not.toBeNull();
		expect(r2).not.toBeNull();
		// 도착 예측(다음역 방향)이 진입 예측(현재역 도착)보다 앞에 있다
		expect(r2?.x).toBeGreaterThan(r1?.x ?? 0);
		expect(r2?.y).toBeGreaterThan(r1?.y ?? 0);
	});
});

describe("computeDynamicProgress", () => {
	it("진입 상태는 반복과 무관하게 항상 1.0을 반환한다", () => {
		expect(computeDynamicProgress("진입", 1)).toBe(1.0);
		expect(computeDynamicProgress("진입", 5)).toBe(1.0);
	});

	it("도착 상태는 반복 횟수에 따라 점진적으로 증가한다", () => {
		expect(computeDynamicProgress("도착", 1)).toBeCloseTo(0.35);
		expect(computeDynamicProgress("도착", 2)).toBeCloseTo(0.55);
		expect(computeDynamicProgress("도착", 3)).toBeCloseTo(0.75);
	});

	it("출발 상태는 반복 횟수에 따라 점진적으로 증가한다", () => {
		expect(computeDynamicProgress("출발", 1)).toBeCloseTo(0.7);
		expect(computeDynamicProgress("출발", 2)).toBeCloseTo(0.825);
		expect(computeDynamicProgress("출발", 3)).toBeCloseTo(0.95);
	});

	it("진행률이 0.95를 초과하지 않는다", () => {
		expect(computeDynamicProgress("도착", 10)).toBe(0.95);
		expect(computeDynamicProgress("출발", 10)).toBe(0.95);
	});
});
