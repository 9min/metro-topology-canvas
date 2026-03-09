import { create } from "zustand";
import type { AppMode } from "@/stores/useSimulationStore";

const ALL_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** 실제운행 모드에서 활성화된 노선 (나머지는 추후 오픈 예정) */
const LIVE_ENABLED_LINES = new Set([1]);

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
	setScale: (scale: number) => void;
	setOffset: (x: number, y: number) => void;
	setIsDragging: (isDragging: boolean) => void;
	toggleLine: (line: number, enabledLines: Set<number>) => void;
	setAllLinesActive: (active: boolean, enabledLines: Set<number>) => void;
	syncLinesForMode: (mode: AppMode) => void;
}

export const useMapStore = create<MapState>((set) => ({
	scale: 1,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	activeLines: new Set(ALL_LINES),
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
	syncLinesForMode: (mode) => set({ activeLines: new Set(getEnabledLines(mode)) }),
}));
