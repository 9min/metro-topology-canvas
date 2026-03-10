import { create } from "zustand";
import { PERF_UPDATE_INTERVAL_MS } from "@/constants/mapConfig";

interface PerfState {
	fps: number;
	renderTimeMs: number;
	activeTrainCount: number;
	graphicsPoolSize: number;
	visible: boolean;
	updateMetrics: (
		fps: number,
		renderTimeMs: number,
		activeTrainCount: number,
		graphicsPoolSize: number,
	) => void;
	toggleVisible: () => void;
}

export const usePerfStore = create<PerfState>((set) => ({
	fps: 0,
	renderTimeMs: 0,
	activeTrainCount: 0,
	graphicsPoolSize: 0,
	visible: false,
	updateMetrics: (fps, renderTimeMs, activeTrainCount, graphicsPoolSize) =>
		set({ fps, renderTimeMs, activeTrainCount, graphicsPoolSize }),
	toggleVisible: () => set((state) => ({ visible: !state.visible })),
}));

let lastUpdateTime = 0;

/**
 * 250ms throttle로 성능 메트릭을 업데이트한다.
 * React 리렌더링을 최소화하기 위해 일정 주기로만 스토어에 반영한다.
 */
export function maybeUpdatePerfStore(
	fps: number,
	renderTimeMs: number,
	activeTrainCount: number,
	graphicsPoolSize: number,
): void {
	const now = performance.now();
	if (now - lastUpdateTime < PERF_UPDATE_INTERVAL_MS) return;
	lastUpdateTime = now;
	usePerfStore.getState().updateMetrics(fps, renderTimeMs, activeTrainCount, graphicsPoolSize);
}

/** 테스트용: throttle 타이머를 초기화한다 */
export function resetPerfThrottle(): void {
	lastUpdateTime = 0;
}
