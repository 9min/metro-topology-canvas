import { useCallback, useMemo } from "react";
import { LINE_COLORS } from "@/constants/lineColors";
import { getEnabledLines, useMapStore } from "@/stores/useMapStore";
import { useSimulationStore } from "@/stores/useSimulationStore";

const LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/**
 * 노선 필터 UI — 상단 중앙에 고정된 1~9호선 토글 버튼.
 * - 실시간 모드: 단일 선택 (selectSingleLine)
 * - 시뮬레이션 모드: 다중 토글 + 전체/전체해제
 */
export function LineFilter() {
	const mode = useSimulationStore((s) => s.mode);
	const activeLines = useMapStore((s) => s.activeLines);
	const toggleLine = useMapStore((s) => s.toggleLine);
	const setAllLinesActive = useMapStore((s) => s.setAllLinesActive);
	const selectSingleLine = useMapStore((s) => s.selectSingleLine);

	const enabledLines = useMemo(() => getEnabledLines(mode), [mode]);
	const allActive = activeLines.size === enabledLines.size;
	const isLive = mode === "live";

	const handleToggleAll = useCallback(() => {
		setAllLinesActive(!allActive, enabledLines);
	}, [allActive, setAllLinesActive, enabledLines]);

	return (
		<div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-2">
			<div className="flex items-center gap-1.5 rounded-full bg-black/60 px-4 py-2 backdrop-blur-sm">
				{LINES.map((line) => {
					const colorHex = LINE_COLORS[line] ?? "#ffffff";
					const isActive = activeLines.has(line);
					return (
						<button
							key={line}
							type="button"
							onClick={() => (isLive ? selectSingleLine(line) : toggleLine(line, enabledLines))}
							className="h-8 w-8 cursor-pointer rounded-full text-sm font-bold text-white transition-opacity"
							style={{
								backgroundColor: colorHex,
								opacity: isActive ? 1 : 0.25,
							}}
						>
							{line}
						</button>
					);
				})}

				{/* 시뮬레이션 모드에서만 전체/전체해제 버튼 표시 */}
				{!isLive && (
					<>
						<div className="mx-1.5 h-5 w-px bg-white/30" />
						<button
							type="button"
							onClick={handleToggleAll}
							className="w-18 cursor-pointer rounded px-2 py-0.5 text-center text-sm text-white/70 transition-colors hover:text-white"
						>
							{allActive ? "전체해제" : "전체"}
						</button>
					</>
				)}
			</div>

			{/* 실시간 모드 안내 텍스트 */}
			{isLive && <span className="text-xs text-white/50">실시간 모드: 호선을 선택하세요</span>}
		</div>
	);
}
