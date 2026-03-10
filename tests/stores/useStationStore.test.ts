import { beforeEach, describe, expect, it } from "vitest";
import { useStationStore } from "@/stores/useStationStore";
import type { Station, StationLink } from "@/types/station";

const MOCK_STATIONS: Station[] = [
	{ id: "L1S01", name: "구로", line: 1, x: 126.887, y: 37.503 },
	{ id: "L1S02", name: "신도림", line: 1, x: 126.901, y: 37.509 },
	{ id: "L2S01", name: "시청", line: 2, x: 126.978, y: 37.566 },
];

const MOCK_LINKS: StationLink[] = [
	{ source: "L1S01", target: "L1S02", line: 1 },
	{ source: "L1S02", target: "L2S01", line: 2 },
];

describe("useStationStore", () => {
	beforeEach(() => {
		useStationStore.getState().initStations([], []);
		useStationStore.getState().selectStation(null);
	});

	it("initStations 호출 시 stations와 links가 저장된다", () => {
		useStationStore.getState().initStations(MOCK_STATIONS, MOCK_LINKS);
		const { stations, links } = useStationStore.getState();
		expect(stations).toHaveLength(3);
		expect(links).toHaveLength(2);
	});

	it("initStations 호출 시 stationMap이 생성된다", () => {
		useStationStore.getState().initStations(MOCK_STATIONS, MOCK_LINKS);
		const { stationMap } = useStationStore.getState();
		expect(stationMap.size).toBe(3);
		expect(stationMap.get("L1S01")?.name).toBe("구로");
		expect(stationMap.get("L2S01")?.name).toBe("시청");
	});

	it("selectStation 호출 시 selectedStation이 업데이트된다", () => {
		const station = MOCK_STATIONS[0];
		if (station === undefined) return;
		useStationStore.getState().selectStation(station);
		expect(useStationStore.getState().selectedStation?.id).toBe("L1S01");
	});

	it("selectStation(null) 호출 시 선택이 해제된다", () => {
		const station = MOCK_STATIONS[0];
		if (station === undefined) return;
		useStationStore.getState().selectStation(station);
		useStationStore.getState().selectStation(null);
		expect(useStationStore.getState().selectedStation).toBeNull();
	});

	it("존재하지 않는 역 ID로 stationMap.get 시 undefined를 반환한다", () => {
		useStationStore.getState().initStations(MOCK_STATIONS, MOCK_LINKS);
		const { stationMap } = useStationStore.getState();
		expect(stationMap.get("NONEXISTENT")).toBeUndefined();
	});
});

describe("검색 기능", () => {
	const SEARCH_STATIONS: Station[] = [
		{ id: "L1S01", name: "서울역", line: 1, x: 126.972, y: 37.555 },
		{ id: "L4S01", name: "서울역", line: 4, x: 126.972, y: 37.555 },
		{ id: "L1S02", name: "시청", line: 1, x: 126.978, y: 37.566 },
		{ id: "L2S01", name: "시청", line: 2, x: 126.978, y: 37.566 },
		{ id: "L1S03", name: "종각", line: 1, x: 126.983, y: 37.57 },
		{ id: "L1S04", name: "종로3가", line: 1, x: 126.991, y: 37.571 },
		{ id: "L3S01", name: "종로3가", line: 3, x: 126.991, y: 37.571 },
		{ id: "L5S01", name: "종로3가", line: 5, x: 126.991, y: 37.571 },
		{ id: "L1S05", name: "동대문", line: 1, x: 127.009, y: 37.571 },
		{ id: "L1S06", name: "신설동", line: 1, x: 127.025, y: 37.576 },
		{ id: "L1S07", name: "제기동", line: 1, x: 127.034, y: 37.58 },
		{ id: "L1S08", name: "청량리", line: 1, x: 127.047, y: 37.58 },
		{ id: "L1S09", name: "회기", line: 1, x: 127.057, y: 37.589 },
		{ id: "L1S10", name: "외대앞", line: 1, x: 127.06, y: 37.593 },
		{ id: "L1S11", name: "신이문", line: 1, x: 127.065, y: 37.596 },
	];

	beforeEach(() => {
		useStationStore.getState().initStations(SEARCH_STATIONS, []);
		useStationStore.getState().setSearchQuery("");
		useStationStore.getState().setSearchOpen(false);
	});

	it("검색어로 역을 필터링한다", () => {
		useStationStore.getState().setSearchQuery("종");
		const { searchResults } = useStationStore.getState();
		expect(searchResults.length).toBeGreaterThan(0);
		for (const r of searchResults) {
			expect(r.name).toContain("종");
		}
	});

	it("빈 검색어는 빈 결과를 반환한다", () => {
		useStationStore.getState().setSearchQuery("");
		expect(useStationStore.getState().searchResults).toHaveLength(0);
	});

	it("결과는 최대 8개로 제한된다", () => {
		useStationStore.getState().setSearchQuery("");
		// 모든 역 이름이 포함될 수 있는 검색어는 없으므로, 짧은 검색어로 테스트
		useStationStore.getState().initStations(
			Array.from({ length: 20 }, (_, i) => ({
				id: `T${i}`,
				name: `테스트역${i}`,
				line: 1,
				x: 127,
				y: 37,
			})),
			[],
		);
		useStationStore.getState().setSearchQuery("테스트");
		expect(useStationStore.getState().searchResults.length).toBeLessThanOrEqual(8);
	});

	it("중복 이름은 하나만 표시한다", () => {
		useStationStore.getState().setSearchQuery("서울역");
		const { searchResults } = useStationStore.getState();
		const names = searchResults.map((s) => s.name);
		const uniqueNames = new Set(names);
		expect(names.length).toBe(uniqueNames.size);
	});
});
