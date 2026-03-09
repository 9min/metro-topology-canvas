import { useCallback, useEffect, useRef } from "react";
import { SIMULATION_TICK_MS } from "@/constants/mapConfig";
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
	const simulatorRef = useRef<TrainSimulator | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
			simulatorRef.current = null;
			return;
		}

		if (stationScreenMap.size === 0) return;

		// 시뮬레이터 초기화
		const sim = new TrainSimulator();
		sim.init(links);
		simulatorRef.current = sim;

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
			simulatorRef.current = null;
		};
	}, [mode, links, stationScreenMap, doTick, setPollingActive]);
}
