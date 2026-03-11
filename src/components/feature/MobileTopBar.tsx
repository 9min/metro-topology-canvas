import { OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { useMapStore } from "@/stores/useMapStore";
import { usePerfStore } from "@/stores/usePerfStore";
import { type AppMode, useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 모바일 전용 상단 통합 바.
 * ModeSwitch 기능 + ToolBar 기능을 한 줄에 배치한다.
 * sm 이상에서는 hidden 처리되며, 데스크톱은 HUD + ToolBar가 별도 렌더링된다.
 */
export function MobileTopBar() {
	const mode = useSimulationStore((s) => s.mode);
	const setMode = useSimulationStore((s) => s.setMode);
	const syncLinesForMode = useMapStore((s) => s.syncLinesForMode);
	const heatmapEnabled = useMapStore((s) => s.heatmapEnabled);
	const toggleHeatmap = useMapStore((s) => s.toggleHeatmap);
	const trainLabelsEnabled = useMapStore((s) => s.trainLabelsEnabled);
	const toggleTrainLabels = useMapStore((s) => s.toggleTrainLabels);
	const perfVisible = usePerfStore((s) => s.visible);
	const togglePerf = usePerfStore((s) => s.toggleVisible);

	const handleSwitch = (newMode: AppMode): void => {
		if (newMode === mode) return;
		useTrainStore.setState({
			rawPositions: [],
			interpolatedTrains: [],
			lastFetchedAt: null,
			fetchError: null,
			selectedTrainNo: null,
		});
		syncLinesForMode(newMode);
		setMode(newMode);
	};

	return (
		<div className="pointer-events-none absolute top-2 left-2 right-2 flex items-center justify-between gap-2 sm:hidden">
			{/* 모드 전환 버튼 */}
			<div className={`pointer-events-auto flex ${OVERLAY_TOOLBAR} p-0.5`}>
				<button
					type="button"
					onClick={() => handleSwitch("simulation")}
					className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
						mode === "simulation"
							? "bg-blue-600 text-white shadow-sm"
							: "text-gray-400 hover:text-white"
					}`}
				>
					시뮬
				</button>
				<button
					type="button"
					onClick={() => handleSwitch("live")}
					className={`cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
						mode === "live" ? "bg-green-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
					}`}
				>
					실시간
				</button>
			</div>

			{/* 도구 버튼 */}
			<div className={`pointer-events-auto flex items-center gap-1 ${OVERLAY_TOOLBAR} px-2 py-2`}>
				<button
					type="button"
					onClick={toggleTrainLabels}
					title="열차 번호 표시"
					className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
						trainLabelsEnabled ? "bg-indigo-500/80 text-white" : "text-white/50 hover:text-white"
					}`}
				>
					번호
				</button>
				<button
					type="button"
					onClick={toggleHeatmap}
					title="혼잡도 히트맵"
					className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
						heatmapEnabled ? "bg-orange-500/80 text-white" : "text-white/50 hover:text-white"
					}`}
				>
					히트
				</button>
				<button
					type="button"
					onClick={togglePerf}
					title="성능 모니터"
					className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
						perfVisible ? "bg-blue-500/80 text-white" : "text-white/50 hover:text-white"
					}`}
				>
					FPS
				</button>
			</div>
		</div>
	);
}
