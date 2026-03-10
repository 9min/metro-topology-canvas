import { beforeEach, describe, expect, it } from "vitest";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";

const SCREEN_MAP = new Map<string, ScreenCoord>([
	["S01", { x: 100, y: 200 }],
	["S02", { x: 200, y: 300 }],
]);

const ADJ_MAP = new Map<string, AdjacencyInfo>([
	["S01", { prev: null, next: "S02" }],
	["S02", { prev: "S01", next: null }],
]);

const MOCK_TRAINS: TrainPosition[] = [
	{
		trainNo: "1001",
		stationId: "S01",
		stationName: "역1",
		line: 1,
		direction: "상행",
		status: "도착",
	},
	{
		trainNo: "1002",
		stationId: "S02",
		stationName: "역2",
		line: 1,
		direction: "하행",
		status: "출발",
	},
];

describe("useTrainStore", () => {
	beforeEach(() => {
		useTrainStore.setState({
			rawPositions: [],
			interpolatedTrains: [],
			lastFetchedAt: null,
			fetchError: null,
			isPollingActive: false,
			selectedTrainNo: null,
			prevPollMap: new Map(),
		});
	});

	it("초기 상태가 비어있다", () => {
		const state = useTrainStore.getState();
		expect(state.rawPositions).toEqual([]);
		expect(state.interpolatedTrains).toEqual([]);
		expect(state.isPollingActive).toBe(false);
		expect(state.selectedTrainNo).toBeNull();
	});

	it("updatePositions로 열차 위치를 갱신한다", () => {
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		const state = useTrainStore.getState();

		expect(state.rawPositions).toHaveLength(2);
		expect(state.interpolatedTrains).toHaveLength(2);
		expect(state.lastFetchedAt).not.toBeNull();
		expect(state.fetchError).toBeNull();
	});

	it("존재하지 않는 역 ID의 열차는 보간 결과에서 제외한다", () => {
		const baseTrain = MOCK_TRAINS[0];
		if (baseTrain === undefined) throw new Error("테스트 데이터 오류");
		const unknownTrains: TrainPosition[] = [{ ...baseTrain, stationId: "UNKNOWN" }];
		useTrainStore.getState().updatePositions(unknownTrains, SCREEN_MAP, ADJ_MAP);
		const state = useTrainStore.getState();

		expect(state.rawPositions).toHaveLength(1);
		expect(state.interpolatedTrains).toHaveLength(0);
	});

	it("setFetchError로 에러를 설정한다", () => {
		useTrainStore.getState().setFetchError("API 오류");
		expect(useTrainStore.getState().fetchError).toBe("API 오류");
	});

	it("setPollingActive로 폴링 상태를 변경한다", () => {
		useTrainStore.getState().setPollingActive(true);
		expect(useTrainStore.getState().isPollingActive).toBe(true);
	});

	it("selectTrain으로 열차를 선택한다", () => {
		useTrainStore.getState().selectTrain("1001");
		expect(useTrainStore.getState().selectedTrainNo).toBe("1001");
	});

	it("selectTrain(null)로 열차 선택을 해제한다", () => {
		useTrainStore.getState().selectTrain("1001");
		useTrainStore.getState().selectTrain(null);
		expect(useTrainStore.getState().selectedTrainNo).toBeNull();
	});

	it("최초 폴링 시 repeatCount가 1이다", () => {
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		const state = useTrainStore.getState();
		const entry = state.prevPollMap.get("1001");
		expect(entry).toBeDefined();
		expect(entry?.repeatCount).toBe(1);
	});

	it("동일 상태 연속 폴링 시 repeatCount가 증가한다", () => {
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		// 같은 데이터로 다시 폴링
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		const state = useTrainStore.getState();
		const entry = state.prevPollMap.get("1001");
		expect(entry?.repeatCount).toBe(2);
	});

	it("상태 또는 역이 변경되면 repeatCount가 리셋된다", () => {
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		useTrainStore.getState().updatePositions(MOCK_TRAINS, SCREEN_MAP, ADJ_MAP);
		// 상태 변경
		const baseTrain = MOCK_TRAINS[0];
		if (baseTrain === undefined) throw new Error("테스트 데이터 오류");
		const changed: TrainPosition[] = [{ ...baseTrain, status: "출발" }];
		useTrainStore.getState().updatePositions(changed, SCREEN_MAP, ADJ_MAP);
		const entry = useTrainStore.getState().prevPollMap.get("1001");
		expect(entry?.repeatCount).toBe(1);
	});
});
