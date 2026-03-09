import { usePerfStore } from "@/stores/usePerfStore";

/** FPS 값에 따른 색상 클래스를 반환한다 */
function fpsColor(fps: number): string {
	if (fps >= 50) return "text-green-400";
	if (fps >= 30) return "text-yellow-400";
	return "text-red-400";
}

/**
 * 성능 모니터 HUD — 우하단 고정.
 * P 키로 토글한다.
 */
export function PerfMonitor() {
	const { fps, renderTimeMs, activeTrainCount, graphicsPoolSize, visible } = usePerfStore();

	if (!visible) return null;

	return (
		<div className="pointer-events-auto fixed right-4 bottom-4 rounded-lg bg-black/70 px-3 py-2 font-mono text-xs backdrop-blur-sm">
			<div className={fpsColor(fps)}>FPS: {Math.round(fps)}</div>
			<div className="text-gray-300">Render: {renderTimeMs.toFixed(1)}ms</div>
			<div className="text-gray-300">Trains: {activeTrainCount}</div>
			<div className="text-gray-300">Pool: {graphicsPoolSize}</div>
		</div>
	);
}
