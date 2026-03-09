import { useEffect, useState } from "react";
import { useTrainStore } from "@/stores/useTrainStore";

/** 경과 시간을 사람이 읽기 쉬운 형태로 반환한다 */
function formatElapsed(lastFetchedAt: string | null, now: number): string {
	if (lastFetchedAt === null) return "대기 중";
	const sec = Math.round((now - new Date(lastFetchedAt).getTime()) / 1000);
	if (sec < 60) return `${sec}초 전`;
	return `${Math.floor(sec / 60)}분 전`;
}

/**
 * 좌상단 운행 현황 HUD 컴포넌트.
 * 운행 열차 수 / 마지막 업데이트 시각 / 폴링 인디케이터 / 에러 표시
 */
export function HUD() {
	const interpolatedTrains = useTrainStore((s) => s.interpolatedTrains);
	const lastFetchedAt = useTrainStore((s) => s.lastFetchedAt);
	const isPollingActive = useTrainStore((s) => s.isPollingActive);
	const fetchError = useTrainStore((s) => s.fetchError);

	const [now, setNow] = useState(() => Date.now());

	// 5초마다 경과 시간 갱신
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 5_000);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="pointer-events-none absolute top-6 left-6 flex flex-col gap-2">
			{/* 운행 현황 카드 */}
			<div className="w-48 rounded-xl border border-white/10 bg-gray-900/85 px-4 py-3 shadow-xl backdrop-blur-md">
				<div className="mb-2 flex items-center gap-2">
					{/* 폴링 인디케이터 */}
					<span
						className={`inline-block h-2 w-2 rounded-full ${
							isPollingActive ? "animate-pulse bg-green-400" : "bg-gray-500"
						}`}
					/>
					<span className="text-xs font-semibold tracking-wide text-gray-300 uppercase">
						실시간 운행
					</span>
				</div>
				<p className="text-2xl font-bold text-white">
					{interpolatedTrains.length}
					<span className="ml-1 text-sm font-normal text-gray-400">대</span>
				</p>
				<p className="mt-1 text-xs text-gray-500">{formatElapsed(lastFetchedAt, now)} 업데이트</p>
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
