import { useCallback, useEffect, useRef } from "react";
import { API_POLLING_INTERVAL_MS, SMSS_POLLING_INTERVAL_MS } from "@/constants/mapConfig";
import { fetchAllTrains, fetchTrainsFromSmss } from "@/services/trainApi";
import { useMapStore } from "@/stores/useMapStore";
import { useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";
import type { TrainPosition } from "@/types/train";
import {
	type AdjacencyInfo,
	buildStationNameMap,
	resolveStationId,
} from "@/utils/stationNameResolver";

/** 역명을 station ID로 매핑하여 유효한 열차만 반환한다 */
function resolveTrains(rawTrains: TrainPosition[], nameMap: Map<string, string>): TrainPosition[] {
	const resolved: TrainPosition[] = [];
	for (const train of rawTrains) {
		const stationId = resolveStationId(nameMap, train.line, train.stationName);
		if (stationId !== undefined) {
			resolved.push({ ...train, stationId });
		}
	}
	return resolved;
}

/**
 * 실시간 열차 위치 폴링을 오케스트레이션한다.
 * - 1~8호선: SMSS 프록시 (10초 주기)
 * - 9호선: 서울열린데이터광장 API (30초 주기)
 * - visibilitychange로 탭 비활성 시 중단/재개
 * - activeLines 변경 시 폴링 재시작
 */
export function useTrainPolling(
	stations: Station[],
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
): void {
	const mode = useSimulationStore((s) => s.mode);
	const activeLines = useMapStore((s) => s.activeLines);
	const smssIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const apiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const updatePositions = useTrainStore((s) => s.updatePositions);
	const setFetchError = useTrainStore((s) => s.setFetchError);
	const setPollingActive = useTrainStore((s) => s.setPollingActive);

	const nameMapRef = useRef<Map<string, string>>(new Map());

	// 각 소스의 최신 데이터를 보관하여 합산에 사용한다
	const latestSmssRef = useRef<TrainPosition[]>([]);
	const latestApiRef = useRef<TrainPosition[]>([]);

	const activeLinesKey = Array.from(activeLines).sort().join(",");

	useEffect(() => {
		nameMapRef.current = buildStationNameMap(stations);
	}, [stations]);

	/** 두 소스의 최신 데이터를 합쳐 스토어에 반영한다 */
	const mergeAndUpdate = useCallback(() => {
		const merged = [...latestSmssRef.current, ...latestApiRef.current];
		updatePositions(merged, stationScreenMap, adjacencyMap);
	}, [updatePositions, stationScreenMap, adjacencyMap]);

	/** SMSS 폴링 (1~8호선) */
	const pollSmss = useCallback(async () => {
		const lines = Array.from(useMapStore.getState().activeLines).filter((l) => l <= 8);
		if (lines.length === 0) {
			latestSmssRef.current = [];
			mergeAndUpdate();
			return;
		}

		try {
			const raw = await fetchTrainsFromSmss(lines);
			latestSmssRef.current = resolveTrains(raw, nameMapRef.current);
			mergeAndUpdate();
		} catch {
			setFetchError("SMSS 열차 위치 데이터를 가져오는데 실패했습니다");
		}
	}, [mergeAndUpdate, setFetchError]);

	/** API 폴링 (9호선) */
	const pollApi = useCallback(async () => {
		const lines = Array.from(useMapStore.getState().activeLines).filter((l) => l === 9);
		if (lines.length === 0) {
			latestApiRef.current = [];
			mergeAndUpdate();
			return;
		}

		try {
			const raw = await fetchAllTrains(lines);
			latestApiRef.current = resolveTrains(raw, nameMapRef.current);
			mergeAndUpdate();
		} catch {
			setFetchError("9호선 열차 위치 데이터를 가져오는데 실패했습니다");
		}
	}, [mergeAndUpdate, setFetchError]);

	const startPolling = useCallback(() => {
		if (smssIntervalRef.current !== null) return;
		setPollingActive(true);

		// 최초 즉시 실행
		pollSmss();
		pollApi();

		smssIntervalRef.current = setInterval(pollSmss, SMSS_POLLING_INTERVAL_MS);
		apiIntervalRef.current = setInterval(pollApi, API_POLLING_INTERVAL_MS);
	}, [pollSmss, pollApi, setPollingActive]);

	const stopPolling = useCallback(() => {
		if (smssIntervalRef.current !== null) {
			clearInterval(smssIntervalRef.current);
			smssIntervalRef.current = null;
		}
		if (apiIntervalRef.current !== null) {
			clearInterval(apiIntervalRef.current);
			apiIntervalRef.current = null;
		}
		setPollingActive(false);
	}, [setPollingActive]);

	useEffect(() => {
		void activeLinesKey;

		if (mode !== "live") {
			stopPolling();
			return;
		}

		if (stationScreenMap.size === 0) return;

		// 호선 변경 시 이전 데이터 클리어
		latestSmssRef.current = [];
		latestApiRef.current = [];
		useTrainStore.getState().clearPositions();

		startPolling();

		const handleVisibility = (): void => {
			if (document.hidden) {
				stopPolling();
			} else {
				startPolling();
			}
		};

		document.addEventListener("visibilitychange", handleVisibility);

		return () => {
			stopPolling();
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [mode, activeLinesKey, startPolling, stopPolling, stationScreenMap]);
}
