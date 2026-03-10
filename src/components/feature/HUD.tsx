import { useEffect, useState } from "react";
import { ModeSwitch } from "@/components/feature/ModeSwitch";
import { OVERLAY_PANEL } from "@/constants/overlayStyles";
import { useSimulationStore } from "@/stores/useSimulationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/** 경과 시간을 사람이 읽기 쉬운 형태로 반환한다 */
function formatElapsed(lastFetchedAt: string | null, now: number): string {
	if (lastFetchedAt === null) return "대기 중";
	const sec = Math.round((now - new Date(lastFetchedAt).getTime()) / 1000);
	if (sec <= 0) return "방금";
	if (sec < 60) return `${sec}초 전`;
	return `${Math.floor(sec / 60)}분 전`;
}

/**
 * 좌상단 운행 현황 HUD 컴포넌트.
 * 운행 열차 수 / 마지막 업데이트 시각 / 폴링 인디케이터 / 에러 표시
 */
export function HUD() {
	const mode = useSimulationStore((s) => s.mode);
	const interpolatedTrains = useTrainStore((s) => s.interpolatedTrains);
	const lastFetchedAt = useTrainStore((s) => s.lastFetchedAt);
	const isPollingActive = useTrainStore((s) => s.isPollingActive);
	const fetchError = useTrainStore((s) => s.fetchError);

	const isSimulation = mode === "simulation";
	const indicatorColor = isSimulation ? "bg-blue-400" : "bg-green-400";
	const modeLabel = isSimulation ? "시뮬레이션" : "실시간 운행";

	const [now, setNow] = useState(() => Date.now());

	// 5초마다 경과 시간 갱신
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 5_000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="pointer-events-none absolute top-4 left-4 flex flex-col gap-2">
			{/* 모드 전환 */}
			<ModeSwitch />

			{/* 운행 현황 카드 */}
			<div className={`w-48 ${OVERLAY_PANEL} px-4 py-3`}>
				<div className="mb-2 flex items-center gap-2">
					{!isSimulation && isPollingActive ? (
						<span className="inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 animate-pulse">
							<span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
							<span className="text-xs font-bold leading-none text-white">LIVE</span>
						</span>
					) : (
						<span
							className={`inline-block h-2 w-2 rounded-full ${
								isPollingActive ? `animate-pulse ${indicatorColor}` : "bg-gray-500"
							}`}
						/>
					)}
					<span className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
						{modeLabel}
					</span>
				</div>
				<p className="text-2xl font-bold text-white">
					{interpolatedTrains.length}
					<span className="ml-1 text-sm font-normal text-gray-400">대</span>
				</p>
				<p className="mt-1 text-xs text-gray-500">{formatElapsed(lastFetchedAt, now)} 업데이트</p>
				{!isSimulation && <p className="mt-1 text-xs text-gray-600">서울교통공사 실시간 API</p>}
			</div>

			{/* 에러 배너 */}
			{fetchError !== null && (
				<div className="w-48 rounded-xl border border-red-500/30 bg-red-900/60 px-4 py-2 shadow-xl backdrop-blur-md">
					<p className="text-xs text-red-300">API 오류: {fetchError}</p>
				</div>
			)}
		</div>
	);
}
