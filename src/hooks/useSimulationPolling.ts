import { useCallback, useEffect, useRef } from "react";
import { MODE_LOADING_MS, SIMULATION_TICK_MS } from "@/constants/mapConfig";
import { TrainSimulator } from "@/services/trainSimulator";
import { useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { StationLink } from "@/types/station";

/**
 * 시뮬레이션 모드 폴링 훅.
 * TrainSimulator를 주기적으로 tick하여 보간된 열차 좌표를 직접 생성한다.
 * mode가 "simulation"일 때만 동작한다.
 */
export function useSimulationPolling(
	links: StationLink[],
	stationScreenMap: Map<string, ScreenCoord>,
): void {
	const mode = useSimulationStore((s) => s.mode);
	const setPollingActive = useTrainStore((s) => s.setPollingActive);
	const setInitializing = useTrainStore((s) => s.setInitializing);
	const simulatorRef = useRef<TrainSimulator | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const doTick = useCallback(() => {
		const sim = simulatorRef.current;
		if (sim === null) return;
		const interpolated = sim.tick(stationScreenMap);
		useTrainStore.setState({
			interpolatedTrains: interpolated,
			lastFetchedAt: new Date().toISOString(),
			fetchError: null,
		});
	}, [stationScreenMap]);

	useEffect(() => {
		if (mode !== "simulation") {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (initTimerRef.current !== null) {
				clearTimeout(initTimerRef.current);
				initTimerRef.current = null;
			}
			simulatorRef.current = null;
			// live 모드가 자신의 isInitializing을 직접 관리하므로 여기서 덮어쓰지 않는다
			return;
		}

		if (stationScreenMap.size === 0) return;

		// 시뮬레이터 초기화
		const sim = new TrainSimulator();
		sim.init(links);
		simulatorRef.current = sim;

		// 초기 로딩 오버레이 표시
		setInitializing(true);
		initTimerRef.current = setTimeout(() => {
			setInitializing(false);
			initTimerRef.current = null;
		}, MODE_LOADING_MS);

		// 즉시 첫 틱 실행 + 주기적 반복
		setPollingActive(true);
		const interpolated = sim.tick(stationScreenMap);
		useTrainStore.setState({
			interpolatedTrains: interpolated,
			lastFetchedAt: new Date().toISOString(),
			fetchError: null,
		});

		intervalRef.current = setInterval(doTick, SIMULATION_TICK_MS);

		return () => {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (initTimerRef.current !== null) {
				clearTimeout(initTimerRef.current);
				initTimerRef.current = null;
			}
			simulatorRef.current = null;
			setInitializing(false);
		};
	}, [mode, links, stationScreenMap, doTick, setPollingActive, setInitializing]);
}
