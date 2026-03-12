import { create } from "zustand";
import { TRAIN_GRACE_POLL_COUNT } from "@/constants/mapConfig";
import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";
import { loadAllSnapshots, saveAllSnapshots, type TrainSnapshot } from "@/utils/trainLocalCache";

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

/** 현재 폴 데이터를 보간하고 결과 맵을 구성한다 */
function collectInterpolated(
	positions: TrainPosition[],
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
	oldPollMap: Map<string, PrevPollEntry>,
): {
	interpolated: InterpolatedTrain[];
	newPollMap: Map<string, PrevPollEntry>;
	newInterpolatedMap: Map<string, InterpolatedTrain>;
	newSnapshotMap: Map<string, TrainSnapshot>;
} {
	const newPollMap = new Map<string, PrevPollEntry>();
	const newInterpolatedMap = new Map<string, InterpolatedTrain>();
	const interpolated: InterpolatedTrain[] = [];
	const newSnapshotMap = new Map<string, TrainSnapshot>();
	const now = Date.now();

	const hasNewTrains = positions.some((t) => !oldPollMap.has(t.trainNo));
	const snapshotMap = hasNewTrains ? loadAllSnapshots() : new Map<string, TrainSnapshot>();

	for (const train of positions) {
		const isSimTrain = train.trainNo.startsWith("gm-");
		const isNewTrain = !oldPollMap.has(train.trainNo);
		const snapshot = isNewTrain && !isSimTrain ? snapshotMap.get(train.trainNo) : undefined;

		const result = interpolateTrainPosition(train, stationScreenMap, adjacencyMap, snapshot);
		if (result !== null) {
			interpolated.push(result);
			newInterpolatedMap.set(train.trainNo, result);
			// 시뮬레이션 열차(gm-xxx)는 세션 간 번호 재사용 없으므로 저장 제외
			if (!isSimTrain) {
				newSnapshotMap.set(train.trainNo, {
					stationId: train.stationId,
					nextStationId: result.nextStationId,
					status: train.status,
					savedAt: now,
				});
			}
		}
		newPollMap.set(train.trainNo, { missedCount: 0 });
	}

	return { interpolated, newPollMap, newInterpolatedMap, newSnapshotMap };
}

/** Grace period 내 누락 열차를 보간 결과에 포함시킨다 */
function applyGracePeriod(
	oldPollMap: Map<string, PrevPollEntry>,
	oldInterpolatedMap: Map<string, InterpolatedTrain>,
	currentTrainNos: Set<string>,
	newPollMap: Map<string, PrevPollEntry>,
	interpolated: InterpolatedTrain[],
	newInterpolatedMap: Map<string, InterpolatedTrain>,
): void {
	for (const [trainNo, prevEntry] of oldPollMap) {
		if (currentTrainNos.has(trainNo)) continue;
		const nextMissedCount = prevEntry.missedCount + 1;
		if (nextMissedCount >= TRAIN_GRACE_POLL_COUNT) continue;
		newPollMap.set(trainNo, { missedCount: nextMissedCount });
		const lastInterpolated = oldInterpolatedMap.get(trainNo);
		if (lastInterpolated !== undefined) {
			interpolated.push(lastInterpolated);
			newInterpolatedMap.set(trainNo, lastInterpolated);
		}
	}
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
		const currentTrainNos = new Set(positions.map((t) => t.trainNo));

		const { interpolated, newPollMap, newInterpolatedMap, newSnapshotMap } = collectInterpolated(
			positions,
			stationScreenMap,
			adjacencyMap,
			oldPollMap,
		);

		if (newSnapshotMap.size > 0) {
			saveAllSnapshots(newSnapshotMap);
		}

		applyGracePeriod(
			oldPollMap,
			oldInterpolatedMap,
			currentTrainNos,
			newPollMap,
			interpolated,
			newInterpolatedMap,
		);

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
