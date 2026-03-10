import { beforeEach, describe, expect, it } from "vitest";
import {
	countTransfers,
	estimateTime,
	getTransferDetails,
	useRouteStore,
} from "@/stores/useRouteStore";
import type { Station, StationLink } from "@/types/station";

const MOCK_STATIONS: Station[] = [
	{ id: "L1S01", name: "서울역", line: 1, x: 126.972, y: 37.555 },
	{ id: "L4S01", name: "서울역", line: 4, x: 126.972, y: 37.555 },
	{ id: "L1S02", name: "시청", line: 1, x: 126.978, y: 37.566 },
	{ id: "L2S01", name: "시청", line: 2, x: 126.978, y: 37.566 },
	{ id: "L1S03", name: "종각", line: 1, x: 126.983, y: 37.57 },
	{ id: "L2S02", name: "을지로입구", line: 2, x: 126.982, y: 37.566 },
];

const MOCK_LINKS: StationLink[] = [
	{ source: "L1S01", target: "L1S02", line: 1 },
	{ source: "L1S02", target: "L1S03", line: 1 },
	{ source: "L4S01", target: "L1S01", line: 4 }, // 서울역 환승은 transferLink가 자동 생성됨
	{ source: "L2S01", target: "L2S02", line: 2 },
];

const stationMap = new Map<string, Station>();
for (const s of MOCK_STATIONS) {
	stationMap.set(s.id, s);
}

describe("useRouteStore", () => {
	beforeEach(() => {
		useRouteStore.getState().clearRoute();
	});

	it("출발역을 설정한다", () => {
		const station = MOCK_STATIONS[0];
		if (station === undefined) return;
		useRouteStore.getState().setFromStation(station);
		expect(useRouteStore.getState().fromStation?.id).toBe("L1S01");
		expect(useRouteStore.getState().toStation).toBeNull();
	});

	it("출발/도착 설정 시 경로를 자동 계산한다", () => {
		const from = MOCK_STATIONS[0]; // 서울역 1호선
		const to = MOCK_STATIONS[4]; // 종각 1호선
		if (from === undefined || to === undefined) return;

		useRouteStore.getState().setFromStation(from);
		useRouteStore.getState().setToStation(to, MOCK_STATIONS, MOCK_LINKS, stationMap);

		const { route } = useRouteStore.getState();
		expect(route).not.toBeNull();
		expect(route?.length).toBeGreaterThanOrEqual(2);
		expect(route?.[0]).toBe("L1S01");
	});

	it("toggleRouteMode로 모드를 전환한다", () => {
		expect(useRouteStore.getState().isRouteMode).toBe(false);
		useRouteStore.getState().toggleRouteMode();
		expect(useRouteStore.getState().isRouteMode).toBe(true);
		useRouteStore.getState().toggleRouteMode();
		expect(useRouteStore.getState().isRouteMode).toBe(false);
	});

	it("clearRoute가 모든 상태를 초기화한다", () => {
		const from = MOCK_STATIONS[0];
		if (from === undefined) return;
		useRouteStore.getState().setFromStation(from);
		useRouteStore.getState().clearRoute();
		expect(useRouteStore.getState().fromStation).toBeNull();
		expect(useRouteStore.getState().isRouteMode).toBe(false);
	});
});

describe("countTransfers", () => {
	it("같은 호선은 환승 0회이다", () => {
		expect(countTransfers(["L1S01", "L1S02", "L1S03"], stationMap)).toBe(0);
	});

	it("환승 횟수를 정확히 계산한다", () => {
		// 1호선 → 2호선 = 1회 환승
		expect(countTransfers(["L1S01", "L1S02", "L2S01"], stationMap)).toBe(1);
	});
});

describe("getTransferDetails", () => {
	it("같은 호선이면 빈 배열을 반환한다", () => {
		expect(getTransferDetails(["L1S01", "L1S02", "L1S03"], stationMap)).toEqual([]);
	});

	it("환승 지점의 역명과 호선 정보를 반환한다", () => {
		// 1호선 서울역 → 1호선 시청 → 2호선 시청 = 시청에서 1→2 환승
		const details = getTransferDetails(["L1S01", "L1S02", "L2S01"], stationMap);
		expect(details).toEqual([{ stationName: "시청", fromLine: 1, toLine: 2 }]);
	});

	it("다중 환승을 모두 반환한다", () => {
		// 1호선 → 2호선 → 다시 1호선
		const details = getTransferDetails(["L1S01", "L2S01", "L1S03"], stationMap);
		expect(details).toHaveLength(2);
		expect(details[0]?.fromLine).toBe(1);
		expect(details[0]?.toLine).toBe(2);
		expect(details[1]?.fromLine).toBe(2);
		expect(details[1]?.toLine).toBe(1);
	});
});

describe("estimateTime", () => {
	it("소요시간을 계산한다 (역 간 2분 + 환승 3분)", () => {
		// 3역 = 2구간 × 2분 = 4분, 환승 0회
		expect(estimateTime(["L1S01", "L1S02", "L1S03"], stationMap)).toBe(4);
	});

	it("환승 포함 소요시간을 계산한다", () => {
		// 3역 = 2구간 × 2분 = 4분, 환승 1회 × 3분 = 3분, 총 7분
		expect(estimateTime(["L1S01", "L1S02", "L2S01"], stationMap)).toBe(7);
	});
});
