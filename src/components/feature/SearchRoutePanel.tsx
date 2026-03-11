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

type TabMode = "search" | "route";

interface SearchRoutePanelProps {
	transferMap: TransferMap;
	onStationSelect: (station: Station) => void;
}

/** 쿼리로 역 목록을 필터링한다 (이름 기준 중복 제거, 최대 6건) */
function filterStations(query: string, stations: Station[]): Station[] {
	if (query.trim() === "") return [];
	const seen = new Set<string>();
	const result: Station[] = [];
	for (const s of stations) {
		if (!s.name.includes(query)) continue;
		if (seen.has(s.name)) continue;
		seen.add(s.name);
		result.push(s);
		if (result.length >= 6) break;
	}
	return result;
}

/** 검색 자동완성 드롭다운 (경로 탐색용) */
function RouteDropdown({
	filtered,
	transferMap,
	highlightIndex,
	onSelect,
}: {
	filtered: Station[];
	transferMap: TransferMap;
	highlightIndex: number;
	onSelect: (station: Station) => void;
}) {
	if (filtered.length === 0) return null;

	return (
		<ul
			className={`absolute bottom-full right-0 left-0 z-50 mb-1 max-h-48 overflow-y-auto sm:top-full sm:bottom-auto sm:mt-1 sm:mb-0 ${OVERLAY_DROPDOWN} py-1`}
		>
			{filtered.map((station, idx) => {
				const transferLines = transferMap.get(station.name);
				const lines =
					transferLines !== undefined ? transferLines.map((s) => s.line) : [station.line];

				return (
					<li key={station.id}>
						<button
							type="button"
							onClick={() => onSelect(station)}
							className={`flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
								idx === highlightIndex ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
							}`}
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

/**
 * 역 검색 + 경로 탐색 통합 패널.
 * 탭으로 "검색"/"경로" 모드를 전환한다.
 * `/` 키 → 검색 탭, `R` 키 → 경로 탭.
 */
export function SearchRoutePanel({ transferMap, onStationSelect }: SearchRoutePanelProps) {
	// 검색 상태
	const isSearchOpen = useStationStore((s) => s.isSearchOpen);
	const searchQuery = useStationStore((s) => s.searchQuery);
	const searchResults = useStationStore((s) => s.searchResults);
	const setSearchQuery = useStationStore((s) => s.setSearchQuery);
	const setSearchOpen = useStationStore((s) => s.setSearchOpen);

	// 경로 상태
	const isRouteMode = useRouteStore((s) => s.isRouteMode);
	const fromStation = useRouteStore((s) => s.fromStation);
	const toStation = useRouteStore((s) => s.toStation);
	const route = useRouteStore((s) => s.route);
	const transferDetails = useRouteStore((s) => s.transferDetails);
	const clearRoute = useRouteStore((s) => s.clearRoute);
	const setFromStation = useRouteStore((s) => s.setFromStation);
	const setToStation = useRouteStore((s) => s.setToStation);
	const toggleRouteMode = useRouteStore((s) => s.toggleRouteMode);

	const stations = useStationStore((s) => s.stations);
	const stationMap = useStationStore((s) => s.stationMap);
	const links = useStationStore((s) => s.links);

	// 검색 관련 로컬 상태
	const [highlightIndex, setHighlightIndex] = useState(-1);
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	// 경로 관련 로컬 상태
	const [fromQuery, setFromQuery] = useState("");
	const [toQuery, setToQuery] = useState("");
	const [activeInput, setActiveInput] = useState<"from" | "to" | null>(null);
	const [routeHighlight, setRouteHighlight] = useState(-1);
	const fromRef = useRef<HTMLInputElement | null>(null);
	const toRef = useRef<HTMLInputElement | null>(null);

	// 경로 드롭다운 필터 결과
	const fromFiltered = activeInput === "from" ? filterStations(fromQuery, stations) : [];
	const toFiltered = activeInput === "to" ? filterStations(toQuery, stations) : [];

	// 현재 활성 탭 결정
	const activeTab: TabMode | null = isSearchOpen ? "search" : isRouteMode ? "route" : null;

	// 검색 탭 열릴 때 포커스
	useEffect(() => {
		if (isSearchOpen && searchInputRef.current !== null) {
			searchInputRef.current.focus();
		}
	}, [isSearchOpen]);

	// 하이라이트 인덱스 리셋
	useEffect(() => {
		setHighlightIndex(-1);
	}, [searchResults]);

	// 쿼리나 활성 입력이 바뀌면 하이라이트 리셋
	useEffect(() => {
		setRouteHighlight(-1);
	}, [fromQuery, toQuery, activeInput]);

	// 출발/도착역이 외부에서 설정되면 입력값 동기화
	useEffect(() => {
		if (fromStation !== null) setFromQuery(fromStation.name);
	}, [fromStation]);

	useEffect(() => {
		if (toStation !== null) setToQuery(toStation.name);
	}, [toStation]);

	// 패널 닫기 핸들러
	const closePanel = useCallback(() => {
		if (isSearchOpen) setSearchOpen(false);
		if (isRouteMode) clearRoute();
	}, [isSearchOpen, isRouteMode, setSearchOpen, clearRoute]);

	// 탭 전환 핸들러
	const switchTab = useCallback(
		(tab: TabMode) => {
			if (tab === "search") {
				if (isRouteMode) clearRoute();
				setSearchOpen(true);
			} else {
				if (isSearchOpen) setSearchOpen(false);
				if (!isRouteMode) toggleRouteMode();
			}
		},
		[isRouteMode, isSearchOpen, toggleRouteMode, setSearchOpen, clearRoute],
	);

	// 검색 선택 핸들러
	const handleSearchSelect = useCallback(
		(station: Station) => {
			onStationSelect(station);
			setSearchOpen(false);
		},
		[onStationSelect, setSearchOpen],
	);

	// 검색 키보드 핸들러
	const handleSearchKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Escape") {
				setSearchOpen(false);
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setHighlightIndex((prev) => Math.min(prev + 1, searchResults.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setHighlightIndex((prev) => Math.max(prev - 1, 0));
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				const target = highlightIndex >= 0 ? searchResults[highlightIndex] : searchResults[0];
				if (target !== undefined) {
					handleSearchSelect(target);
				}
			}
		},
		[searchResults, highlightIndex, handleSearchSelect, setSearchOpen],
	);

	// 경로 입력 키보드 핸들러
	const handleRouteKeyDown = useCallback(
		(e: React.KeyboardEvent, items: Station[], onSelect: (s: Station) => void) => {
			if (e.key === "Escape") {
				setActiveInput(null);
				return;
			}
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setRouteHighlight((prev) => Math.min(prev + 1, items.length - 1));
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setRouteHighlight((prev) => Math.max(prev - 1, 0));
				return;
			}
			if (e.key === "Enter") {
				e.preventDefault();
				const target = routeHighlight >= 0 ? items[routeHighlight] : items[0];
				if (target !== undefined) {
					onSelect(target);
				}
			}
		},
		[routeHighlight],
	);

	// 경로 출발역 선택 핸들러
	const handleFromSelect = useCallback(
		(station: Station) => {
			setFromStation(station);
			setFromQuery(station.name);
			setActiveInput(null);
			onStationSelect(station);
			setTimeout(() => toRef.current?.focus(), 100);
		},
		[setFromStation, onStationSelect],
	);

	// 경로 도착역 선택 핸들러
	const handleToSelect = useCallback(
		(station: Station) => {
			setToStation(station, stations, links, stationMap);
			setToQuery(station.name);
			setActiveInput(null);
			onStationSelect(station);
		},
		[setToStation, stations, links, stationMap, onStationSelect],
	);

	// 닫힌 상태: 컴팩트 버튼 2개
	if (activeTab === null) {
		return (
			<div className="pointer-events-auto flex gap-1.5">
				<button
					type="button"
					onClick={() => switchTab("search")}
					title="역 검색 (/)"
					className={`flex cursor-pointer items-center gap-1.5 ${OVERLAY_PANEL} px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white`}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="11" cy="11" r="8" />
						<line x1="21" y1="21" x2="16.65" y2="16.65" />
					</svg>
					검색
					<kbd className="ml-0.5 hidden rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-500 sm:inline">
						/
					</kbd>
				</button>
				<button
					type="button"
					onClick={() => switchTab("route")}
					title="경로 탐색 (R)"
					className={`flex cursor-pointer items-center gap-1.5 ${OVERLAY_PANEL} px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white`}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
						<polyline points="9 22 9 12 15 12 15 22" />
					</svg>
					경로
					<kbd className="ml-0.5 hidden rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-500 sm:inline">
						R
					</kbd>
				</button>
			</div>
		);
	}

	return (
		<div className={`pointer-events-auto w-[calc(100vw-2rem)] sm:w-72 ${OVERLAY_PANEL} p-0`}>
			{/* 탭 헤더 */}
			<div className="flex items-center border-b border-white/10">
				<button
					type="button"
					onClick={() => switchTab("search")}
					className={`flex-1 cursor-pointer px-4 py-2.5 text-center text-xs font-semibold transition-colors ${
						activeTab === "search" ? "text-white" : "text-gray-500 hover:text-gray-300"
					}`}
				>
					<span className="flex items-center justify-center gap-1.5">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
						역 검색
					</span>
					{activeTab === "search" && (
						<div className="mx-auto mt-1.5 h-0.5 w-8 rounded-full bg-blue-500" />
					)}
				</button>
				<button
					type="button"
					onClick={() => switchTab("route")}
					className={`flex-1 cursor-pointer px-4 py-2.5 text-center text-xs font-semibold transition-colors ${
						activeTab === "route" ? "text-white" : "text-gray-500 hover:text-gray-300"
					}`}
				>
					<span className="flex items-center justify-center gap-1.5">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="5" r="3" />
							<line x1="12" y1="8" x2="12" y2="16" />
							<circle cx="12" cy="19" r="3" />
						</svg>
						경로 탐색
					</span>
					{activeTab === "route" && (
						<div className="mx-auto mt-1.5 h-0.5 w-8 rounded-full bg-green-500" />
					)}
				</button>
				{/* 닫기 버튼 */}
				<button
					type="button"
					onClick={closePanel}
					title="닫기 (Esc)"
					className="cursor-pointer px-2.5 py-2.5 text-gray-500 transition-colors hover:text-white"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="14"
						height="14"
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
				</button>
			</div>

			{/* 검색 탭 */}
			{activeTab === "search" && (
				<div className="relative p-3">
					<input
						ref={searchInputRef}
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						onKeyDown={handleSearchKeyDown}
						placeholder="역 이름 검색..."
						className={`w-full ${OVERLAY_INPUT} px-3 py-2 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/50`}
					/>

					{searchResults.length > 0 && (
						<ul
							className={`absolute right-3 bottom-full left-3 z-50 mb-1 max-h-72 overflow-y-auto sm:top-full sm:bottom-auto sm:mt-1 sm:mb-0 ${OVERLAY_DROPDOWN} py-1`}
						>
							{searchResults.map((station, idx) => {
								const transferLines = transferMap.get(station.name);
								const lines =
									transferLines !== undefined ? transferLines.map((s) => s.line) : [station.line];

								return (
									<li key={station.id}>
										<button
											type="button"
											onClick={() => handleSearchSelect(station)}
											className={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
												idx === highlightIndex
													? "bg-white/10 text-white"
													: "text-gray-300 hover:bg-white/5"
											}`}
										>
											<span className="flex-1">{station.name}</span>
											<span className="flex gap-1">
												{lines.map((line) => (
													<Badge key={line} line={line} />
												))}
											</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}

					{searchQuery.trim() !== "" && searchResults.length === 0 && (
						<div
							className={`absolute right-3 bottom-full left-3 z-50 mb-1 sm:top-full sm:bottom-auto sm:mt-1 sm:mb-0 ${OVERLAY_DROPDOWN} px-3 py-3 text-center text-sm text-gray-500`}
						>
							검색 결과 없음
						</div>
					)}
				</div>
			)}

			{/* 경로 탭 */}
			{activeTab === "route" && (
				<div className="p-3">
					<p className="mb-2 text-xs text-gray-500">출발역과 도착역을 입력하세요</p>

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
							onKeyDown={(e) => handleRouteKeyDown(e, fromFiltered, handleFromSelect)}
							placeholder="출발역 입력..."
							className={`w-full ${OVERLAY_INPUT} px-3 py-1.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-green-500/50`}
						/>
						{activeInput === "from" && (
							<RouteDropdown
								filtered={fromFiltered}
								transferMap={transferMap}
								highlightIndex={routeHighlight}
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
							onKeyDown={(e) => handleRouteKeyDown(e, toFiltered, handleToSelect)}
							placeholder="도착역 입력..."
							className={`w-full ${OVERLAY_INPUT} px-3 py-1.5 text-xs text-white outline-none placeholder:text-gray-600 focus:border-red-500/50`}
						/>
						{activeInput === "to" && (
							<RouteDropdown
								filtered={toFiltered}
								transferMap={transferMap}
								highlightIndex={routeHighlight}
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
							<span className="text-sm font-semibold text-white">{route.length}개역</span>
							{transferDetails.length > 0 && (
								<div className="mt-2 flex flex-col gap-1.5">
									{transferDetails.map((td) => (
										<div
											key={`${td.stationName}-${td.fromLine}-${td.toLine}`}
											className="flex items-center gap-1.5 text-xs text-gray-300"
										>
											<span className="shrink-0 text-white">{td.stationName}</span>
											<Badge line={td.fromLine} />
											<span className="text-gray-500">&rarr;</span>
											<Badge line={td.toLine} />
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{fromStation !== null && toStation !== null && (route === null || route.length === 0) && (
						<p className="text-xs text-red-400/80">경로를 찾을 수 없습니다</p>
					)}
				</div>
			)}
		</div>
	);
}
