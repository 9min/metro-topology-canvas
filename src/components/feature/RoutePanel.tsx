import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import {
	OVERLAY_DROPDOWN,
	OVERLAY_INPUT,
	OVERLAY_PANEL,
	OVERLAY_RESULT,
} from "@/constants/overlayStyles";
import { useRouteStore } from "@/stores/useRouteStore";
import { useStationStore } from "@/stores/useStationStore";
import type { Station } from "@/types/station";
import type { TransferMap } from "@/utils/transferStation";

interface RoutePanelProps {
	transferMap: TransferMap;
	onStationSelect: (station: Station) => void;
}

/** 검색 자동완성 드롭다운 */
function SearchDropdown({
	query,
	stations,
	transferMap,
	onSelect,
}: {
	query: string;
	stations: Station[];
	transferMap: TransferMap;
	onSelect: (station: Station) => void;
}) {
	if (query.trim() === "" || stations.length === 0) return null;

	// 이름 중복 제거
	const seen = new Set<string>();
	const filtered: Station[] = [];
	for (const s of stations) {
		if (!s.name.includes(query)) continue;
		if (seen.has(s.name)) continue;
		seen.add(s.name);
		filtered.push(s);
		if (filtered.length >= 6) break;
	}

	if (filtered.length === 0) return null;

	return (
		<ul
			className={`absolute top-full right-0 left-0 z-50 mt-1 max-h-48 overflow-y-auto ${OVERLAY_DROPDOWN} py-1`}
		>
			{filtered.map((station) => {
				const transferLines = transferMap.get(station.name);
				const lines =
					transferLines !== undefined ? transferLines.map((s) => s.line) : [station.line];

				return (
					<li key={station.id}>
						<button
							type="button"
							onClick={() => onSelect(station)}
							className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-white/5"
						>
							<span className="flex-1">{station.name}</span>
							<span className="flex gap-1">
								{lines.map((l) => (
									<Badge key={l} line={l} />
								))}
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}

/** 경로 탐색 패널 */
export function RoutePanel({ transferMap, onStationSelect }: RoutePanelProps) {
	const isRouteMode = useRouteStore((s) => s.isRouteMode);
	const fromStation = useRouteStore((s) => s.fromStation);
	const toStation = useRouteStore((s) => s.toStation);
	const route = useRouteStore((s) => s.route);
	const transferCount = useRouteStore((s) => s.transferCount);
	const estimatedMinutes = useRouteStore((s) => s.estimatedMinutes);
	const clearRoute = useRouteStore((s) => s.clearRoute);

	const stations = useStationStore((s) => s.stations);
	const stationMap = useStationStore((s) => s.stationMap);
	const links = useStationStore((s) => s.links);
	const setFromStation = useRouteStore((s) => s.setFromStation);
	const setToStation = useRouteStore((s) => s.setToStation);

	const [fromQuery, setFromQuery] = useState("");
	const [toQuery, setToQuery] = useState("");
	const [activeInput, setActiveInput] = useState<"from" | "to" | null>(null);

	const fromRef = useRef<HTMLInputElement | null>(null);
	const toRef = useRef<HTMLInputElement | null>(null);

	// 출발/도착역이 외부에서 설정되면 입력값 동기화
	useEffect(() => {
		if (fromStation !== null) setFromQuery(fromStation.name);
	}, [fromStation]);

	useEffect(() => {
		if (toStation !== null) setToQuery(toStation.name);
	}, [toStation]);

	const handleFromSelect = useCallback(
		(station: Station) => {
			setFromStation(station);
			setFromQuery(station.name);
			setActiveInput(null);
			onStationSelect(station);
			// 도착 입력으로 포커스 이동
			setTimeout(() => toRef.current?.focus(), 100);
		},
		[setFromStation, onStationSelect],
	);

	const handleToSelect = useCallback(
		(station: Station) => {
			setToStation(station, stations, links, stationMap);
			setToQuery(station.name);
			setActiveInput(null);
			onStationSelect(station);
		},
		[setToStation, stations, links, stationMap, onStationSelect],
	);

	if (!isRouteMode) return null;

	return (
		<div className={`pointer-events-auto w-64 ${OVERLAY_PANEL} p-4`}>
			<div className="mb-3 flex items-center justify-between">
				<h3 className="text-sm font-bold text-white">경로 탐색</h3>
				<button
					type="button"
					onClick={clearRoute}
					className="cursor-pointer text-xs text-gray-400 transition-colors hover:text-white"
				>
					초기화
				</button>
			</div>

			{/* 출발역 */}
			<div className="relative mb-2">
				<div className="mb-1 flex items-center gap-1.5">
					<span className="inline-block h-2 w-2 rounded-full bg-green-400" />
					<span className="text-xs text-gray-400">출발</span>
				</div>
				<input
					ref={fromRef}
					type="text"
					value={fromQuery}
					onChange={(e) => {
						setFromQuery(e.target.value);
						setActiveInput("from");
					}}
					onFocus={() => setActiveInput("from")}
					placeholder="출발역 입력..."
					className={`w-full ${OVERLAY_INPUT} px-3 py-1.5 text-base text-white outline-none placeholder:text-gray-600 focus:border-green-500/50 sm:text-xs`}
				/>
				{activeInput === "from" && (
					<SearchDropdown
						query={fromQuery}
						stations={stations}
						transferMap={transferMap}
						onSelect={handleFromSelect}
					/>
				)}
			</div>

			{/* 도착역 */}
			<div className="relative mb-3">
				<div className="mb-1 flex items-center gap-1.5">
					<span className="inline-block h-2 w-2 rounded-full bg-red-400" />
					<span className="text-xs text-gray-400">도착</span>
				</div>
				<input
					ref={toRef}
					type="text"
					value={toQuery}
					onChange={(e) => {
						setToQuery(e.target.value);
						setActiveInput("to");
					}}
					onFocus={() => setActiveInput("to")}
					placeholder="도착역 입력..."
					className={`w-full ${OVERLAY_INPUT} px-3 py-1.5 text-base text-white outline-none placeholder:text-gray-600 focus:border-red-500/50 sm:text-xs`}
				/>
				{activeInput === "to" && (
					<SearchDropdown
						query={toQuery}
						stations={stations}
						transferMap={transferMap}
						onSelect={handleToSelect}
					/>
				)}
			</div>

			<p className="mb-2 text-xs text-gray-600">
				지도에서 역 클릭으로도 설정 가능 (첫 클릭=출발, 두 번째=도착)
			</p>

			{/* 경로 결과 */}
			{route !== null && route.length > 0 && (
				<div className={`${OVERLAY_RESULT} p-3`}>
					<div className="flex items-center justify-between">
						<span className="text-lg font-bold text-white">약 {estimatedMinutes}분</span>
						<span className="text-xs text-gray-400">{route.length}개역</span>
					</div>
					{transferCount > 0 && (
						<p className="mt-1 text-xs text-yellow-400/80">환승 {transferCount}회</p>
					)}
				</div>
			)}

			{fromStation !== null && toStation !== null && (route === null || route.length === 0) && (
				<p className="text-xs text-red-400/80">경로를 찾을 수 없습니다</p>
			)}
		</div>
	);
}
