import { create } from "zustand";
import { isOperatingHours } from "@/utils/operatingHours";

export type AppMode = "simulation" | "live";

/** 운행 시간이면 실시간 모드, 비운행 시간이면 시뮬레이션 모드를 기본값으로 사용한다 */
function getDefaultMode(): AppMode {
	return isOperatingHours() ? "live" : "simulation";
}

interface SimulationState {
	mode: AppMode;
	setMode: (mode: AppMode) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
	mode: getDefaultMode(),
	setMode: (mode) => set({ mode }),
}));
