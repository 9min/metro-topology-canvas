import { create } from "zustand";
import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPollHistory, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";

/** 열차별 이전 폴링 상태 (repeatCount 추적용) */
interface PrevPollEntry {
	stationId: string;
	status: string;
	repeatCount: number;
}

interface TrainState {
	rawPositions: TrainPosition[];
	interpolatedTrains: InterpolatedTrain[];
	lastFetchedAt: string | null;
	fetchError: string | null;
	isPollingActive: boolean;
	selectedTrainNo: string | null;
	prevPollMap: Map<string, PrevPollEntry>;
	updatePositions: (
		positions: TrainPosition[],
		stationScreenMap: Map<string, ScreenCoord>,
		adjacencyMap: Map<string, AdjacencyInfo>,
	) => void;
	setFetchError: (error: string | null) => void;
	setPollingActive: (active: boolean) => void;
	selectTrain: (trainNo: string | null) => void;
	clearPositions: () => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
	rawPositions: [],
	interpolatedTrains: [],
	lastFetchedAt: null,
	fetchError: null,
	isPollingActive: false,
	selectedTrainNo: null,
	prevPollMap: new Map(),

	updatePositions: (positions, stationScreenMap, adjacencyMap) => {
		const oldPollMap = get().prevPollMap;
		const newPollMap = new Map<string, PrevPollEntry>();
		const interpolated: InterpolatedTrain[] = [];

		for (const train of positions) {
			// 이전 상태 조회 → repeatCount 계산
			const prev = oldPollMap.get(train.trainNo);
			const repeatCount =
				prev !== undefined && prev.stationId === train.stationId && prev.status === train.status
					? prev.repeatCount + 1
					: 1;

			newPollMap.set(train.trainNo, {
				stationId: train.stationId,
				status: train.status,
				repeatCount,
			});

			const pollHistory: TrainPollHistory = {
				prevStatus: train.status,
				prevStationId: train.stationId,
				repeatCount,
			};

			const result = interpolateTrainPosition(train, stationScreenMap, adjacencyMap, pollHistory);
			if (result !== null) {
				interpolated.push(result);
			}
		}
		set({
			rawPositions: positions,
			interpolatedTrains: interpolated,
			lastFetchedAt: new Date().toISOString(),
			fetchError: null,
			prevPollMap: newPollMap,
		});
	},

	setFetchError: (error) => set({ fetchError: error }),
	setPollingActive: (active) => set({ isPollingActive: active }),
	selectTrain: (trainNo) => set({ selectedTrainNo: trainNo }),
	clearPositions: () =>
		set({
			rawPositions: [],
			interpolatedTrains: [],
			prevPollMap: new Map(),
			lastFetchedAt: null,
		}),
}));
