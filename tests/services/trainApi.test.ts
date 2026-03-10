import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAllTrains, fetchLineTrains } from "@/services/trainApi";

const MOCK_API_RESPONSE = {
	realtimePositionList: [
		{
			subwayId: "1001",
			subwayNm: "1호선",
			statnNm: "서울역",
			trainNo: "1001",
			updnLine: "0",
			trainSttus: "1",
			directAt: "0",
			lstcarAt: "0",
		},
		{
			subwayId: "1001",
			subwayNm: "1호선",
			statnNm: "시청",
			trainNo: "1002",
			updnLine: "1",
			trainSttus: "2",
			directAt: "0",
			lstcarAt: "0",
		},
	],
};

describe("fetchLineTrains", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_SEOUL_API_KEY", "test-key");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("API 응답을 TrainPosition 배열로 파싱한다", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(MOCK_API_RESPONSE),
			}),
		);

		const trains = await fetchLineTrains(1);
		expect(trains).toHaveLength(2);
		expect(trains[0]?.trainNo).toBe("1001");
		expect(trains[0]?.line).toBe(1);
		expect(trains[0]?.direction).toBe("상행");
		expect(trains[0]?.status).toBe("도착");
		expect(trains[1]?.status).toBe("출발");
	});

	it("API 키가 없으면 빈 배열을 반환한다", async () => {
		vi.stubEnv("VITE_SEOUL_API_KEY", "");
		const trains = await fetchLineTrains(1);
		expect(trains).toEqual([]);
	});

	it("네트워크 에러 시 빈 배열을 반환한다", async () => {
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));

		const trains = await fetchLineTrains(1);
		expect(trains).toEqual([]);
	});

	it("HTTP 에러 시 빈 배열을 반환한다", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

		const trains = await fetchLineTrains(1);
		expect(trains).toEqual([]);
	});
});

describe("fetchAllTrains", () => {
	beforeEach(() => {
		vi.stubEnv("VITE_SEOUL_API_KEY", "test-key");
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllEnvs();
	});

	it("전달된 호선만 병렬 호출한다", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(MOCK_API_RESPONSE),
			}),
		);

		const trains = await fetchAllTrains([1]);
		// 1호선 × 2개 = 2개
		expect(trains).toHaveLength(2);
	});
});
