import { create } from "zustand";
import type { Station, StationLink } from "@/types/station";

/** 검색 결과 최대 개수 */
const MAX_SEARCH_RESULTS = 8;

interface StationState {
	stations: Station[];
	links: StationLink[];
	selectedStation: Station | null;
	stationMap: Map<string, Station>;
	searchQuery: string;
	searchResults: Station[];
	isSearchOpen: boolean;
	initStations: (stations: Station[], links: StationLink[]) => void;
	selectStation: (station: Station | null) => void;
	setSearchQuery: (query: string) => void;
	setSearchOpen: (open: boolean) => void;
}

/** 검색어로 역을 필터링하고 이름 중복을 제거한다 */
function filterStations(stations: Station[], query: string): Station[] {
	if (query.trim() === "") return [];
	const seen = new Set<string>();
	const results: Station[] = [];
	for (const station of stations) {
		if (!station.name.includes(query)) continue;
		if (seen.has(station.name)) continue;
		seen.add(station.name);
		results.push(station);
		if (results.length >= MAX_SEARCH_RESULTS) break;
	}
	return results;
}

export const useStationStore = create<StationState>((set, get) => ({
	stations: [],
	links: [],
	selectedStation: null,
	stationMap: new Map(),
	searchQuery: "",
	searchResults: [],
	isSearchOpen: false,
	initStations: (stations, links) => {
		const stationMap = new Map<string, Station>();
		for (const station of stations) {
			stationMap.set(station.id, station);
		}
		set({ stations, links, stationMap });
	},
	selectStation: (selectedStation) => set({ selectedStation }),
	setSearchQuery: (query) => {
		const results = filterStations(get().stations, query);
		set({ searchQuery: query, searchResults: results });
	},
	setSearchOpen: (isSearchOpen) => {
		if (!isSearchOpen) {
			set({ isSearchOpen, searchQuery: "", searchResults: [] });
		} else {
			set({ isSearchOpen });
		}
	},
}));
