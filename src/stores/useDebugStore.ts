import { create } from "zustand";

interface DebugState {
	/** D 키: 열차 번호 텍스트 + 디버그 HUD */
	debugMode: boolean;
	/** A 키: 이징 우회, 즉시 목표 위치 점프 */
	skipAnimation: boolean;
	/** T 키: 보간 목표점 빨간 원 */
	showTargetMarkers: boolean;
	/** 디버그 모드 토글 (off 시 나머지도 리셋) */
	toggleDebugMode: () => void;
	/** skipAnimation 토글 (debugMode일 때만 동작) */
	toggleSkipAnimation: () => void;
	/** showTargetMarkers 토글 (debugMode일 때만 동작) */
	toggleTargetMarkers: () => void;
}

export const useDebugStore = create<DebugState>((set, get) => ({
	debugMode: false,
	skipAnimation: false,
	showTargetMarkers: false,
	toggleDebugMode: () =>
		set((state) => {
			if (state.debugMode) {
				// off 시 하위 옵션도 리셋
				return { debugMode: false, skipAnimation: false, showTargetMarkers: false };
			}
			return { debugMode: true };
		}),
	toggleSkipAnimation: () => {
		if (!get().debugMode) return;
		set((state) => ({ skipAnimation: !state.skipAnimation }));
	},
	toggleTargetMarkers: () => {
		if (!get().debugMode) return;
		set((state) => ({ showTargetMarkers: !state.showTargetMarkers }));
	},
}));
