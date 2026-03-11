import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { OVERLAY_DROPDOWN, OVERLAY_INPUT, OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { useStationStore } from "@/stores/useStationStore";
import type { Station } from "@/types/station";
import type { TransferMap } from "@/utils/transferStation";

interface StationSearchProps {
	transferMap: TransferMap;
	onSelect: (station: Station) => void;
}

/**
 * 역 검색 + 자동완성 컴포넌트.
 * `/` 키로 열기, Escape로 닫기, 화살표 키로 탐색, Enter로 선택.
 */
export function StationSearch({ transferMap, onSelect }: StationSearchProps) {
	const isSearchOpen = useStationStore((s) => s.isSearchOpen);
	const searchQuery = useStationStore((s) => s.searchQuery);
	const searchResults = useStationStore((s) => s.searchResults);
	const setSearchQuery = useStationStore((s) => s.setSearchQuery);
	const setSearchOpen = useStationStore((s) => s.setSearchOpen);

	const [highlightIndex, setHighlightIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement | null>(null);

	// 검색창 열릴 때 포커스
	useEffect(() => {
		if (isSearchOpen && inputRef.current !== null) {
			inputRef.current.focus();
		}
	}, [isSearchOpen]);

	// 하이라이트 인덱스 리셋
	useEffect(() => {
		setHighlightIndex(-1);
	}, [searchResults]);

	const handleSelect = useCallback(
		(station: Station) => {
			onSelect(station);
			setSearchOpen(false);
		},
		[onSelect, setSearchOpen],
	);

	const handleKeyDown = useCallback(
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
					handleSelect(target);
				}
			}
		},
		[searchResults, highlightIndex, handleSelect, setSearchOpen],
	);

	if (!isSearchOpen) {
		return (
			<button
				type="button"
				onClick={() => setSearchOpen(true)}
				title="역 검색 (/)"
				className={`pointer-events-auto flex cursor-pointer items-center gap-1.5 ${OVERLAY_TOOLBAR} px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white`}
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
				역 검색
				<kbd className="ml-1 rounded bg-white/10 px-1.5 py-0.5 text-xs text-gray-500">/</kbd>
			</button>
		);
	}

	return (
		<div className="pointer-events-auto relative w-64">
			<input
				ref={inputRef}
				type="text"
				value={searchQuery}
				onChange={(e) => setSearchQuery(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder="역 이름 검색..."
				className={`w-full ${OVERLAY_INPUT} px-3 py-2 text-base text-white outline-none placeholder:text-gray-500 focus:border-blue-500/50 sm:text-sm`}
			/>

			{searchResults.length > 0 && (
				<ul
					className={`absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto ${OVERLAY_DROPDOWN} py-1`}
				>
					{searchResults.map((station, idx) => {
						const transferLines = transferMap.get(station.name);
						const lines =
							transferLines !== undefined ? transferLines.map((s) => s.line) : [station.line];

						return (
							<li key={station.id}>
								<button
									type="button"
									onClick={() => handleSelect(station)}
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
					className={`absolute top-full right-0 left-0 z-50 mt-1 ${OVERLAY_DROPDOWN} px-3 py-3 text-center text-sm text-gray-500`}
				>
					검색 결과 없음
				</div>
			)}
		</div>
	);
}
