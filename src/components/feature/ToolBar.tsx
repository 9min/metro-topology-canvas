import { OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { useMapStore } from "@/stores/useMapStore";
import { usePerfStore } from "@/stores/usePerfStore";

/**
 * 우측 상단 도구 버튼 — 열차번호 토글 + 히트맵 토글 + FPS 모니터 토글.
 */
export function ToolBar() {
	const heatmapEnabled = useMapStore((s) => s.heatmapEnabled);
	const toggleHeatmap = useMapStore((s) => s.toggleHeatmap);
	const trainLabelsEnabled = useMapStore((s) => s.trainLabelsEnabled);
	const toggleTrainLabels = useMapStore((s) => s.toggleTrainLabels);
	const perfVisible = usePerfStore((s) => s.visible);
	const togglePerf = usePerfStore((s) => s.toggleVisible);

	return (
		<div
			className={`pointer-events-auto absolute top-4 right-4 flex items-center gap-1.5 ${OVERLAY_TOOLBAR} px-3 py-2`}
		>
			<button
				type="button"
				onClick={toggleTrainLabels}
				title="열차 번호 표시"
				className={`cursor-pointer rounded px-2 py-0.5 text-sm transition-colors ${
					trainLabelsEnabled ? "bg-indigo-500/80 text-white" : "text-white/50 hover:text-white"
				}`}
			>
				열차번호
			</button>
			<button
				type="button"
				onClick={toggleHeatmap}
				title="혼잡도 히트맵 (H)"
				className={`cursor-pointer rounded px-2 py-0.5 text-sm transition-colors ${
					heatmapEnabled ? "bg-orange-500/80 text-white" : "text-white/50 hover:text-white"
				}`}
			>
				히트맵
			</button>
			<button
				type="button"
				onClick={togglePerf}
				title="성능 모니터 (P)"
				className={`cursor-pointer rounded px-2 py-0.5 text-sm transition-colors ${
					perfVisible ? "bg-blue-500/80 text-white" : "text-white/50 hover:text-white"
				}`}
			>
				FPS
			</button>
		</div>
	);
}
