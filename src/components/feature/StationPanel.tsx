import { useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { IconButton } from "@/components/ui/IconButton";
import { OVERLAY_PANEL } from "@/constants/overlayStyles";
import stationsData from "@/data/stations.json";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station } from "@/types/station";
import { buildTransferMap } from "@/utils/transferStation";

const ALL_STATIONS = stationsData as Station[];

/** 역 클릭 시 우하단에 표시되는 정보 패널 */
export function StationPanel() {
	const selectedStation = useStationStore((state) => state.selectedStation);
	const selectStation = useStationStore((state) => state.selectStation);
	const interpolatedTrains = useTrainStore((state) => state.interpolatedTrains);

	const transferMap = useMemo(() => buildTransferMap(ALL_STATIONS), []);

	if (selectedStation === null) return null;

	// 환승역이면 같은 이름의 모든 호선 가져오기
	const transferGroup = transferMap.get(selectedStation.name);
	const allLines =
		transferGroup !== undefined ? transferGroup.map((s) => s.line) : [selectedStation.line];
	// 같은 이름 역의 모든 ID (환승역이면 여러 개)
	const allStationIds =
		transferGroup !== undefined ? transferGroup.map((s) => s.id) : [selectedStation.id];
	const stationIdSet = new Set(allStationIds);

	const approachingTrains = interpolatedTrains
		.filter((t) => stationIdSet.has(t.toStationId))
		.sort((a, b) => b.progress - a.progress)
		.slice(0, 5);

	return (
		<>
			{/* 외부 영역 클릭 시 패널 닫기 */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: 백드롭은 마우스 전용 */}
			<div className="pointer-events-auto absolute inset-0" onClick={() => selectStation(null)} />
			<div
				className={`pointer-events-auto absolute right-4 bottom-4 min-w-[240px] ${OVERLAY_PANEL} p-4`}
			>
				<div className="mb-3 flex items-start justify-between gap-2">
					<h2 className="text-lg font-bold text-white">{selectedStation.name}</h2>
					<IconButton onClick={() => selectStation(null)} label="패널 닫기">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</IconButton>
				</div>
				<div className="flex items-center gap-2">
					{allLines.map((line) => (
						<Badge key={line} line={line} />
					))}
				</div>
				<div className="mt-3 text-xs text-gray-400">
					<span>ID: {selectedStation.id}</span>
				</div>

				{approachingTrains.length > 0 && (
					<div className="mt-4">
						<p className="mb-2 text-xs font-semibold tracking-wide text-gray-300 uppercase">
							도착 예정
						</p>
						<ul className="space-y-2">
							{approachingTrains.map((train) => (
								<li key={train.trainNo}>
									<div className="mb-1 flex items-center gap-2">
										<Badge line={train.line} />
										<span className="text-xs text-white">{train.trainNo}</span>
										<span className="ml-auto text-xs text-gray-400">{train.direction}</span>
									</div>
									<div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
										<div
											className="h-full rounded-full bg-white/60"
											style={{ width: `${Math.round(train.progress * 100)}%` }}
										/>
									</div>
								</li>
							))}
						</ul>
					</div>
				)}
			</div>
		</>
	);
}
