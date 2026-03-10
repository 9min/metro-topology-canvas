import { create } from "zustand";
import type { AppMode } from "@/stores/useSimulationStore";
import { isOperatingHours } from "@/utils/operatingHours";

const ALL_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
const LIVE_DEFAULT_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

/** 실시간운행 모드에서 활성화 가능한 노선 (모든 호선 지원) */
const LIVE_ENABLED_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** 모드에 따른 활성화 가능 노선을 반환한다 */
export function getEnabledLines(mode: AppMode): Set<number> {
	return mode === "simulation" ? ALL_LINES : LIVE_ENABLED_LINES;
}

interface MapState {
	scale: number;
	offsetX: number;
	offsetY: number;
	isDragging: boolean;
	activeLines: Set<number>;
	heatmapEnabled: boolean;
	setScale: (scale: number) => void;
	setOffset: (x: number, y: number) => void;
	setIsDragging: (isDragging: boolean) => void;
	toggleLine: (line: number, enabledLines: Set<number>) => void;
	setAllLinesActive: (active: boolean, enabledLines: Set<number>) => void;
	selectSingleLine: (line: number) => void;
	syncLinesForMode: (mode: AppMode) => void;
	removeInactiveLines: (linesWithTrains: Set<number>) => void;
	toggleHeatmap: () => void;
}

export const useMapStore = create<MapState>((set) => ({
	scale: 1,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	activeLines: isOperatingHours() ? new Set(LIVE_DEFAULT_LINES) : new Set(ALL_LINES),
	heatmapEnabled: false,
	setScale: (scale) => set({ scale }),
	setOffset: (offsetX, offsetY) => set({ offsetX, offsetY }),
	setIsDragging: (isDragging) => set({ isDragging }),
	toggleLine: (line, enabledLines) =>
		set((state) => {
			if (!enabledLines.has(line)) return state;
			const next = new Set(state.activeLines);
			if (next.has(line)) {
				next.delete(line);
			} else {
				next.add(line);
			}
			return { activeLines: next };
		}),
	setAllLinesActive: (active, enabledLines) =>
		set({ activeLines: active ? new Set(enabledLines) : new Set() }),
	selectSingleLine: (line) => set({ activeLines: new Set([line]) }),
	syncLinesForMode: (mode) =>
		set({ activeLines: mode === "live" ? new Set(LIVE_DEFAULT_LINES) : new Set(ALL_LINES) }),
	removeInactiveLines: (linesWithTrains) =>
		set((state) => {
			const next = new Set<number>();
			for (const line of state.activeLines) {
				if (linesWithTrains.has(line)) next.add(line);
			}
			if (next.size === state.activeLines.size) return state;
			return { activeLines: next };
		}),
	toggleHeatmap: () => set((state) => ({ heatmapEnabled: !state.heatmapEnabled })),
}));
