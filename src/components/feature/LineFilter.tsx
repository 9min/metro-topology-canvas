import { useCallback, useMemo } from "react";
import { LINE_COLORS } from "@/constants/lineColors";
import { OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { getEnabledLines, useMapStore } from "@/stores/useMapStore";
import { useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

const LINES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 호선별 열차 수를 집계한다 */
function countTrainsByLine(positions: { line: number }[]): Map<number, number> {
	const counts = new Map<number, number>();
	for (const p of positions) {
		counts.set(p.line, (counts.get(p.line) ?? 0) + 1);
	}
	return counts;
}

/**
 * 노선 필터 UI — 상단 중앙에 고정된 1~9호선 토글 버튼.
 * 모든 모드에서 다중 토글 + 전체/전체해제를 지원한다.
 */
export function LineFilter() {
	const mode = useSimulationStore((s) => s.mode);
	const activeLines = useMapStore((s) => s.activeLines);
	const toggleLine = useMapStore((s) => s.toggleLine);
	const setAllLinesActive = useMapStore((s) => s.setAllLinesActive);
	const rawPositions = useTrainStore((s) => s.rawPositions);
	const baseEnabledLines = useMemo(() => getEnabledLines(mode), [mode]);

	const trainCounts = useMemo(
		() => (mode === "live" ? countTrainsByLine(rawPositions) : null),
		[mode, rawPositions],
	);

	const allActive =
		baseEnabledLines.size > 0 && [...baseEnabledLines].every((l) => activeLines.has(l));

	const handleToggleAll = useCallback(() => {
		setAllLinesActive(!allActive, baseEnabledLines);
	}, [allActive, setAllLinesActive, baseEnabledLines]);

	return (
		<div className="pointer-events-auto absolute left-1/2 top-12 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-2 sm:top-4">
			<div
				className={`flex items-center gap-1 overflow-x-auto sm:gap-1.5 ${OVERLAY_TOOLBAR} px-2 py-2 sm:px-4`}
			>
				{LINES.map((line) => {
					const colorHex = LINE_COLORS[line] ?? "#ffffff";
					const isActive = activeLines.has(line);
					const count = trainCounts?.get(line) ?? 0;
					return (
						<button
							key={line}
							type="button"
							onClick={() => toggleLine(line, baseEnabledLines)}
							title={`${line}호선${trainCounts !== null ? `: ${count}대` : ""}`}
							className="relative h-6 w-6 shrink-0 cursor-pointer rounded-full text-xs font-bold text-white transition-opacity sm:h-8 sm:w-8 sm:text-sm"
							style={{
								backgroundColor: colorHex,
								opacity: isActive ? 1 : 0.25,
							}}
						>
							{line}
						</button>
					);
				})}

				<div className="mx-1 h-5 w-px shrink-0 bg-white/30 sm:mx-1.5" />
				<button
					type="button"
					onClick={handleToggleAll}
					className="w-12 shrink-0 cursor-pointer whitespace-nowrap rounded px-1 py-0.5 text-center text-xs text-white/70 transition-colors hover:text-white sm:w-18 sm:px-2"
				>
					{allActive ? "전체해제" : "전체"}
				</button>
			</div>
		</div>
	);
}
