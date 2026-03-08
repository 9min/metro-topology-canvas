import { useCallback, useEffect, useRef } from "react";
import { POLLING_INTERVAL_MS } from "@/constants/mapConfig";
import { fetchAllTrains } from "@/services/trainApi";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";
import type { TrainPosition } from "@/types/train";
import {
	type AdjacencyInfo,
	buildStationNameMap,
	resolveStationId,
} from "@/utils/stationNameResolver";

/**
 * 실시간 열차 위치 폴링을 오케스트레이션한다.
 * - 마운트 시 최초 fetch
 * - setInterval로 90초 주기 반복
 * - visibilitychange로 탭 비활성 시 중단/재개
 */
export function useTrainPolling(
	stations: Station[],
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
): void {
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const updatePositions = useTrainStore((s) => s.updatePositions);
	const setFetchError = useTrainStore((s) => s.setFetchError);
	const setPollingActive = useTrainStore((s) => s.setPollingActive);

	const nameMapRef = useRef<Map<string, string>>(new Map());

	// stations가 변경될 때 역명 매핑 갱신
	useEffect(() => {
		nameMapRef.current = buildStationNameMap(stations);
	}, [stations]);

	const poll = useCallback(async () => {
		try {
			const rawTrains = await fetchAllTrains();

			// 역명 → station ID 매핑
			const resolved: TrainPosition[] = [];
			for (const train of rawTrains) {
				const stationId = resolveStationId(nameMapRef.current, train.line, train.stationName);
				if (stationId !== undefined) {
					resolved.push({ ...train, stationId });
				}
			}

			updatePositions(resolved, stationScreenMap, adjacencyMap);
		} catch {
			setFetchError("열차 위치 데이터를 가져오는데 실패했습니다");
		}
	}, [updatePositions, setFetchError, stationScreenMap, adjacencyMap]);

	const startPolling = useCallback(() => {
		if (intervalRef.current !== null) return;
		setPollingActive(true);
		poll();
		intervalRef.current = setInterval(poll, POLLING_INTERVAL_MS);
	}, [poll, setPollingActive]);

	const stopPolling = useCallback(() => {
		if (intervalRef.current !== null) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		setPollingActive(false);
	}, [setPollingActive]);

	// 마운트 시 폴링 시작, 언마운트 시 정리
	useEffect(() => {
		// stationScreenMap이 비어있으면 아직 준비되지 않음
		if (stationScreenMap.size === 0) return;

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
	}, [startPolling, stopPolling, stationScreenMap]);
}
