import { create } from "zustand";
import { TRAIN_GRACE_POLL_COUNT } from "@/constants/mapConfig";
import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";

/** 열차별 이전 폴링 상태 (grace period용) */
interface PrevPollEntry {
	/** 연속 누락 폴 횟수 (grace period 카운터) */
	missedCount: number;
}

interface TrainState {
	rawPositions: TrainPosition[];
	interpolatedTrains: InterpolatedTrain[];
	lastFetchedAt: string | null;
	fetchError: string | null;
	isPollingActive: boolean;
	isInitializing: boolean;
	selectedTrainNo: string | null;
	prevPollMap: Map<string, PrevPollEntry>;
	/** 이전 보간 결과 (grace 기간 열차의 마지막 위치 유지용) */
	prevInterpolatedMap: Map<string, InterpolatedTrain>;
	updatePositions: (
		positions: TrainPosition[],
		stationScreenMap: Map<string, ScreenCoord>,
		adjacencyMap: Map<string, AdjacencyInfo>,
	) => void;
	setFetchError: (error: string | null) => void;
	setPollingActive: (active: boolean) => void;
	setInitializing: (v: boolean) => void;
	selectTrain: (trainNo: string | null) => void;
	clearPositions: () => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
	rawPositions: [],
	interpolatedTrains: [],
	lastFetchedAt: null,
	fetchError: null,
	isPollingActive: false,
	isInitializing: false,
	selectedTrainNo: null,
	prevPollMap: new Map(),
	prevInterpolatedMap: new Map(),

	updatePositions: (positions, stationScreenMap, adjacencyMap) => {
		const oldPollMap = get().prevPollMap;
		const oldInterpolatedMap = get().prevInterpolatedMap;
		const newPollMap = new Map<string, PrevPollEntry>();
		const newInterpolatedMap = new Map<string, InterpolatedTrain>();
		const interpolated: InterpolatedTrain[] = [];

		// 현재 폴에 존재하는 열차 번호 집합
		const currentTrainNos = new Set(positions.map((t) => t.trainNo));

		for (const train of positions) {
			const result = interpolateTrainPosition(train, stationScreenMap, adjacencyMap);
			if (result !== null) {
				interpolated.push(result);
				newInterpolatedMap.set(train.trainNo, result);
			}

			newPollMap.set(train.trainNo, {
				missedCount: 0,
			});
		}

		// Grace period: 현재 폴에 없지만 이전에 있었던 열차 유지
		for (const [trainNo, prevEntry] of oldPollMap) {
			if (currentTrainNos.has(trainNo)) continue;

			const nextMissedCount = prevEntry.missedCount + 1;
			if (nextMissedCount < TRAIN_GRACE_POLL_COUNT) {
				// grace 기간 내 — pollMap 이력 유지
				newPollMap.set(trainNo, {
					missedCount: nextMissedCount,
				});

				// 이전 보간 결과를 그대로 포함 (마지막 위치에서 정지)
				const lastInterpolated = oldInterpolatedMap.get(trainNo);
				if (lastInterpolated !== undefined) {
					interpolated.push(lastInterpolated);
					newInterpolatedMap.set(trainNo, lastInterpolated);
				}
			}
			// grace 초과 → newPollMap에 추가하지 않음 → 자연 삭제
		}

		set({
			rawPositions: positions,
			interpolatedTrains: interpolated,
			lastFetchedAt: new Date().toISOString(),
			fetchError: null,
			prevPollMap: newPollMap,
			prevInterpolatedMap: newInterpolatedMap,
		});
	},

	setFetchError: (error) => set({ fetchError: error }),
	setPollingActive: (active) => set({ isPollingActive: active }),
	setInitializing: (v) => set({ isInitializing: v }),
	selectTrain: (trainNo) => set({ selectedTrainNo: trainNo }),
	clearPositions: () =>
		set({
			rawPositions: [],
			interpolatedTrains: [],
			prevPollMap: new Map(),
			prevInterpolatedMap: new Map(),
			lastFetchedAt: null,
		}),
}));
