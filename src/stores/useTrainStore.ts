import { create } from "zustand";
import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";

interface TrainState {
	rawPositions: TrainPosition[];
	interpolatedTrains: InterpolatedTrain[];
	lastFetchedAt: string | null;
	fetchError: string | null;
	isPollingActive: boolean;
	selectedTrainNo: string | null;
	updatePositions: (
		positions: TrainPosition[],
		stationScreenMap: Map<string, ScreenCoord>,
		adjacencyMap: Map<string, AdjacencyInfo>,
	) => void;
	setFetchError: (error: string | null) => void;
	setPollingActive: (active: boolean) => void;
	selectTrain: (trainNo: string | null) => void;
}

export const useTrainStore = create<TrainState>((set) => ({
	rawPositions: [],
	interpolatedTrains: [],
	lastFetchedAt: null,
	fetchError: null,
	isPollingActive: false,
	selectedTrainNo: null,

	updatePositions: (positions, stationScreenMap, adjacencyMap) => {
		const interpolated: InterpolatedTrain[] = [];
		for (const train of positions) {
			const result = interpolateTrainPosition(train, stationScreenMap, adjacencyMap);
			if (result !== null) {
				interpolated.push(result);
			}
		}
		set({
			rawPositions: positions,
			interpolatedTrains: interpolated,
			lastFetchedAt: new Date().toISOString(),
			fetchError: null,
		});
	},

	setFetchError: (error) => set({ fetchError: error }),
	setPollingActive: (active) => set({ isPollingActive: active }),
	selectTrain: (trainNo) => set({ selectedTrainNo: trainNo }),
}));
