import { useEffect, useState } from "react";
import { useMapStore } from "@/stores/useMapStore";
import { type AppMode, useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/** 실시간운행 가능 시간대: 07:00 ~ 23:59 */
const LIVE_START_HOUR = 7;
const LIVE_END_HOUR = 24;

/** 현재 시각이 실시간운행 가능 시간대인지 반환한다 */
function isLiveAvailable(): boolean {
	const hour = new Date().getHours();
	return hour >= LIVE_START_HOUR && hour < LIVE_END_HOUR;
}

/**
 * 시뮬레이션 / 실시간운행 모드 전환 토글.
 * 좌측 상단 HUD 위에 배치한다.
 */
export function ModeSwitch() {
	const mode = useSimulationStore((s) => s.mode);
	const setMode = useSimulationStore((s) => s.setMode);
	const syncLinesForMode = useMapStore((s) => s.syncLinesForMode);
	const [liveEnabled, setLiveEnabled] = useState(isLiveAvailable);

	// 1분마다 실시간운행 가능 여부를 갱신한다
	useEffect(() => {
		const id = setInterval(() => setLiveEnabled(isLiveAvailable()), 60_000);
		return () => clearInterval(id);
	}, []);

	const handleSwitch = (newMode: AppMode): void => {
		if (newMode === mode) return;
		if (newMode === "live" && !liveEnabled) return;

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
				className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-all ${
					mode === "simulation"
						? "bg-blue-600 text-white shadow-sm"
						: "text-gray-400 hover:text-white"
				}`}
			>
				시뮬레이션
			</button>
			<button
				type="button"
				disabled={!liveEnabled}
				title={liveEnabled ? undefined : "실시간 운행은 07:00~24:00에만 가능합니다"}
				onClick={() => handleSwitch("live")}
				className={`flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-semibold transition-all ${
					!liveEnabled
						? "cursor-not-allowed text-gray-600"
						: mode === "live"
							? "bg-green-600 text-white shadow-sm"
							: "text-gray-400 hover:text-white"
				}`}
			>
				실시간 운행
			</button>
		</div>
	);
}
