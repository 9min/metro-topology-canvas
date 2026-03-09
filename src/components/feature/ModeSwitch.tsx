import { useMapStore } from "@/stores/useMapStore";
import { type AppMode, useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 시뮬레이션 / 실제운행 모드 전환 토글.
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
		<div className="pointer-events-auto flex rounded-lg border border-white/10 bg-gray-900/85 p-0.5 shadow-xl backdrop-blur-md">
			<button
				type="button"
				onClick={() => handleSwitch("simulation")}
				className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
					mode === "simulation"
						? "bg-blue-600 text-white shadow-sm"
						: "text-gray-400 hover:text-white"
				}`}
			>
				시뮬레이션
			</button>
			<button
				type="button"
				onClick={() => handleSwitch("live")}
				className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
					mode === "live" ? "bg-green-600 text-white shadow-sm" : "text-gray-400 hover:text-white"
				}`}
			>
				실제운행
			</button>
		</div>
	);
}
