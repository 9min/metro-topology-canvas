import { create } from "zustand";

/** 현재 활성화된 노선 (나머지는 추후 오픈 예정) */
const ENABLED_LINES = new Set([1]);

interface MapState {
	scale: number;
	offsetX: number;
	offsetY: number;
	isDragging: boolean;
	activeLines: Set<number>;
	setScale: (scale: number) => void;
	setOffset: (x: number, y: number) => void;
	setIsDragging: (isDragging: boolean) => void;
	toggleLine: (line: number) => void;
	setAllLinesActive: (active: boolean) => void;
}

export const useMapStore = create<MapState>((set) => ({
	scale: 1,
	offsetX: 0,
	offsetY: 0,
	isDragging: false,
	activeLines: new Set(ENABLED_LINES),
	setScale: (scale) => set({ scale }),
	setOffset: (offsetX, offsetY) => set({ offsetX, offsetY }),
	setIsDragging: (isDragging) => set({ isDragging }),
	toggleLine: (line) =>
		set((state) => {
			if (!ENABLED_LINES.has(line)) return state;
			const next = new Set(state.activeLines);
			if (next.has(line)) {
				next.delete(line);
			} else {
				next.add(line);
			}
			return { activeLines: next };
		}),
	setAllLinesActive: (active) => set({ activeLines: active ? new Set(ENABLED_LINES) : new Set() }),
}));
