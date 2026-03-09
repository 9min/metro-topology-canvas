import { useCallback, useEffect, useMemo, useState } from "react";
import { LINE_COLORS } from "@/constants/lineColors";
import { getEnabledLines, useMapStore } from "@/stores/useMapStore";
import { usePerfStore } from "@/stores/usePerfStore";
import { useSimulationStore } from "@/stores/useSimulationStore";

const LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 토스트 자동 닫힘 시간 (ms) */
const TOAST_DURATION_MS = 3000;

/**
 * 노선 필터 UI — 상단 중앙에 고정된 1~9호선 토글 버튼.
 * 비활성 노선의 역/링크/열차를 지도에서 숨긴다.
 */
export function LineFilter() {
	const mode = useSimulationStore((s) => s.mode);
	const activeLines = useMapStore((s) => s.activeLines);
	const toggleLine = useMapStore((s) => s.toggleLine);
	const setAllLinesActive = useMapStore((s) => s.setAllLinesActive);
	const heatmapEnabled = useMapStore((s) => s.heatmapEnabled);
	const toggleHeatmap = useMapStore((s) => s.toggleHeatmap);
	const perfVisible = usePerfStore((s) => s.visible);
	const togglePerf = usePerfStore((s) => s.toggleVisible);
	const [showToast, setShowToast] = useState(false);

	const enabledLines = useMemo(() => getEnabledLines(mode), [mode]);
	const allActive = activeLines.size === enabledLines.size;

	// 토스트 자동 닫힘
	useEffect(() => {
		if (!showToast) return;
		const id = setTimeout(() => setShowToast(false), TOAST_DURATION_MS);
		return () => clearTimeout(id);
	}, [showToast]);

	const handleToggleAll = useCallback(() => {
		if (!allActive && mode === "live") {
			setShowToast(true);
		}
		setAllLinesActive(!allActive, enabledLines);
	}, [allActive, setAllLinesActive, enabledLines, mode]);

	return (
		<div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-2">
			<div className="flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
				{LINES.map((line) => {
					const colorHex = LINE_COLORS[line] ?? "#ffffff";
					const isEnabled = enabledLines.has(line);
					const isActive = activeLines.has(line);
					return (
						<button
							key={line}
							type="button"
							onClick={() => (isEnabled ? toggleLine(line, enabledLines) : setShowToast(true))}
							title={isEnabled ? undefined : "준비중"}
							className={`h-8 w-8 rounded-full text-sm font-bold text-white transition-opacity ${
								!isEnabled ? "cursor-not-allowed" : ""
							}`}
							style={{
								backgroundColor: colorHex,
								opacity: isEnabled ? (isActive ? 1 : 0.25) : 0.15,
							}}
						>
							{line}
						</button>
					);
				})}
				<div className="mx-1.5 h-5 w-px bg-white/30" />
				<button
					type="button"
					onClick={handleToggleAll}
					className="w-18 rounded px-2 py-0.5 text-center text-sm text-white/70 transition-colors hover:text-white"
				>
					{allActive ? "전체해제" : "전체"}
				</button>
				<div className="mx-1.5 h-5 w-px bg-white/30" />
				<button
					type="button"
					onClick={toggleHeatmap}
					title="혼잡도 히트맵 (H)"
					className={`rounded px-2 py-0.5 text-sm transition-colors ${
						heatmapEnabled ? "bg-orange-500/80 text-white" : "text-white/50 hover:text-white"
					}`}
				>
					히트맵
				</button>
				<button
					type="button"
					onClick={togglePerf}
					title="성능 모니터 (P)"
					className={`rounded px-2 py-0.5 text-sm transition-colors ${
						perfVisible ? "bg-blue-500/80 text-white" : "text-white/50 hover:text-white"
					}`}
				>
					FPS
				</button>
			</div>

			{/* 토스트 알림 (실제운행 모드에서만) */}
			{showToast && mode === "live" && (
				<div className="animate-fade-in rounded-lg border border-amber-500/30 bg-amber-900/80 px-4 py-2 text-sm text-amber-200 shadow-lg backdrop-blur-sm">
					API 사용량 제한으로 1호선만 표시하고 있습니다
				</div>
			)}
		</div>
	);
}
