import { useCallback, useEffect, useRef } from "react";
import { SIMULATION_TICK_MS } from "@/constants/mapConfig";
import { TrainSimulator } from "@/services/trainSimulator";
import { useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { ScreenCoord } from "@/types/map";
import type { StationLink } from "@/types/station";
import type { AdjacencyInfo } from "@/utils/stationNameResolver";

/**
 * 시뮬레이션 모드 폴링 훅.
 * TrainSimulator를 주기적으로 tick하여 가짜 열차 데이터를 생성한다.
 * mode가 "simulation"일 때만 동작한다.
 */
export function useSimulationPolling(
	links: StationLink[],
	stationScreenMap: Map<string, ScreenCoord>,
	adjacencyMap: Map<string, AdjacencyInfo>,
): void {
	const mode = useSimulationStore((s) => s.mode);
	const updatePositions = useTrainStore((s) => s.updatePositions);
	const setPollingActive = useTrainStore((s) => s.setPollingActive);
	const simulatorRef = useRef<TrainSimulator | null>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const doTick = useCallback(() => {
		const sim = simulatorRef.current;
		if (sim === null) return;
		const positions = sim.tick();
		updatePositions(positions, stationScreenMap, adjacencyMap);
	}, [updatePositions, stationScreenMap, adjacencyMap]);

	useEffect(() => {
		if (mode !== "simulation") {
			// 시뮬레이션 모드가 아니면 정리
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
		const positions = sim.tick();
		updatePositions(positions, stationScreenMap, adjacencyMap);

		intervalRef.current = setInterval(doTick, SIMULATION_TICK_MS);

		return () => {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			simulatorRef.current = null;
		};
	}, [mode, links, stationScreenMap, adjacencyMap, doTick, updatePositions, setPollingActive]);
}
