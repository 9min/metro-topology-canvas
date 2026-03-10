import { useCallback, useEffect, useMemo, useRef } from "react";
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
 * 실시간 모드에서 열차가 0대인 호선은 OFF 표시.
 */
export function LineFilter() {
	const mode = useSimulationStore((s) => s.mode);
	const activeLines = useMapStore((s) => s.activeLines);
	const toggleLine = useMapStore((s) => s.toggleLine);
	const setAllLinesActive = useMapStore((s) => s.setAllLinesActive);
	const removeInactiveLines = useMapStore((s) => s.removeInactiveLines);
	const rawPositions = useTrainStore((s) => s.rawPositions);
	const baseEnabledLines = useMemo(() => getEnabledLines(mode), [mode]);

	const trainCounts = useMemo(
		() => (mode === "live" ? countTrainsByLine(rawPositions) : null),
		[mode, rawPositions],
	);

	// 마지막으로 확인된 열차 운행 호선을 보존한다.
	// 전체해제 → 폴링 데이터 클리어 → enabledLines 비어짐 순환을 방지한다.
	const lastKnownEnabledRef = useRef<Set<number>>(baseEnabledLines);

	// 실시간 모드: 열차가 있는 호선만 활성화 가능
	const enabledLines = useMemo(() => {
		if (trainCounts === null) return baseEnabledLines;
		const live = new Set<number>();
		for (const [line, count] of trainCounts) {
			if (count > 0) live.add(line);
		}
		if (live.size > 0) {
			lastKnownEnabledRef.current = live;
			return live;
		}
		return lastKnownEnabledRef.current;
	}, [trainCounts, baseEnabledLines]);

	// 실시간 모드: 폴링 결과에서 열차 없는 호선을 activeLines에서 제거
	useEffect(() => {
		if (mode !== "live" || rawPositions.length === 0) return;
		removeInactiveLines(enabledLines);
	}, [mode, rawPositions, enabledLines, removeInactiveLines]);

	const allActive = enabledLines.size > 0 && [...enabledLines].every((l) => activeLines.has(l));

	const handleToggleAll = useCallback(() => {
		setAllLinesActive(!allActive, enabledLines);
	}, [allActive, setAllLinesActive, enabledLines]);

	return (
		<div className="pointer-events-auto absolute left-1/2 top-4 flex -translate-x-1/2 flex-col items-center gap-2">
			<div className={`flex items-center gap-1.5 ${OVERLAY_TOOLBAR} px-4 py-2`}>
				{LINES.map((line) => {
					const colorHex = LINE_COLORS[line] ?? "#ffffff";
					const isActive = activeLines.has(line);
					const count = trainCounts?.get(line) ?? 0;
					const isOff = trainCounts !== null && count === 0;
					return (
						<button
							key={line}
							type="button"
							disabled={isOff}
							onClick={() => toggleLine(line, enabledLines)}
							title={
								isOff
									? `${line}호선: 운행 열차 없음`
									: `${line}호선${trainCounts !== null ? `: ${count}대` : ""}`
							}
							className="relative h-8 w-8 rounded-full text-sm font-bold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-15"
							style={{
								backgroundColor: colorHex,
								...(!isOff && { opacity: isActive ? 1 : 0.25, cursor: "pointer" }),
							}}
						>
							{line}
							{isOff && (
								<span className="absolute -right-0.5 -bottom-0.5 rounded bg-gray-800 px-0.5 text-[8px] leading-tight font-semibold text-gray-400">
									OFF
								</span>
							)}
						</button>
					);
				})}

				<div className="mx-1.5 h-5 w-px bg-white/30" />
				<button
					type="button"
					onClick={handleToggleAll}
					className="w-18 cursor-pointer rounded px-2 py-0.5 text-center text-sm text-white/70 transition-colors hover:text-white"
				>
					{allActive ? "전체해제" : "전체"}
				</button>
			</div>
		</div>
	);
}
