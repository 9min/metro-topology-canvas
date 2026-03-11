import { OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { useMapStore } from "@/stores/useMapStore";
import { type AppMode, useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 시뮬레이션 / 실시간운행 모드 전환 토글.
 * 좌측 상단 HUD 위에 배치한다.
 */
export function ModeSwitch() {
	const mode = useSimulationStore((s) => s.mode);
	const setMode = useSimulationStore((s) => s.setMode);
	const syncLinesForMode = useMapStore((s) => s.syncLinesForMode);

	const handleSwitch = (newMode: AppMode): void => {
		if (newMode === mode) return;

		// 열차 데이터 초기화 (모드 전환 시 깔끔하게 리셋)
		useTrainStore.setState({
			rawPositions: [],
			interpolatedTrains: [],
			lastFetchedAt: null,
			fetchError: null,
			selectedTrainNo: null,
		});

		// 노선 필터를 새 모드에 맞게 동기화
		syncLinesForMode(newMode);
		setMode(newMode);
	};

	return (
		<div className={`pointer-events-auto flex ${OVERLAY_TOOLBAR} p-0.5`}>
			<button
				type="button"
				onClick={() => handleSwitch("simulation")}
				className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-semibold transition-all sm:px-3 ${
					mode === "simulation"
						? "bg-blue-600 text-white shadow-sm"
						: "text-gray-400 hover:text-white"
				}`}
			>
				<span className="sm:hidden">시뮬</span>
				<span className="hidden sm:inline">시뮬레이션</span>
			</button>
			<button
				type="button"
				onClick={() => handleSwitch("live")}
				className={`flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-xs font-semibold transition-all sm:px-3 ${
					mode === "live" ? "bg-green-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
				}`}
			>
				<span className="sm:hidden">실시간</span>
				<span className="hidden sm:inline">실시간 운행</span>
			</button>
		</div>
	);
}
