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
 * 모바일: ModeSwitch 숨김 + 카드만 LineFilter 아래에 표시
 * 데스크톱: ModeSwitch + 카드 flex-col
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
		// 모바일: top-[5.5rem] = MobileTopBar(top-2 ~36px) + LineFilter(top-12 ~40px) 아래
		// 데스크톱: top-4 (기존 위치)
		<div className="pointer-events-none absolute top-[5.5rem] left-2 flex flex-col gap-2 sm:top-4 sm:left-4">
			{/* 모드 전환 — 모바일에서는 MobileTopBar가 담당하므로 숨김 */}
			<div className="hidden sm:block">
				<ModeSwitch />
			</div>

			{/* 운행 현황 카드 */}
			<div className={`${OVERLAY_PANEL} px-3 py-2 sm:w-48 sm:px-4 sm:py-3`}>
				<div className="mb-1.5 flex items-center gap-2 sm:mb-2">
					{!isSimulation && isPollingActive ? (
						<span className="inline-flex animate-pulse items-center gap-1 rounded bg-red-600 px-1.5 py-0.5">
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
				<p className="text-xl font-bold text-white sm:text-2xl">
					{interpolatedTrains.length}
					<span className="ml-1 text-sm font-normal text-gray-400">대</span>
				</p>
				<p className="mt-1 hidden text-xs text-gray-500 sm:block">
					{formatElapsed(lastFetchedAt, now)} 업데이트
				</p>
				{!isSimulation && (
					<p className="mt-1 hidden text-xs text-gray-600 sm:block">서울시 공공데이터 API</p>
				)}
			</div>

			{/* 에러 배너 */}
			{fetchError !== null && (
				<div className="rounded-xl border border-red-500/30 bg-red-900/60 px-3 py-2 shadow-xl backdrop-blur-md sm:w-48 sm:px-4">
					<p className="text-xs text-red-300">API 오류: {fetchError}</p>
				</div>
			)}
		</div>
	);
}
