import { create } from "zustand";

export type AppMode = "simulation" | "live";

interface SimulationState {
	mode: AppMode;
	setMode: (mode: AppMode) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
	mode: "simulation",
	setMode: (mode) => set({ mode }),
}));
