import { useEffect } from "react";
import { useMapStore } from "@/stores/useMapStore";
import { usePerfStore } from "@/stores/usePerfStore";
import { useRouteStore } from "@/stores/useRouteStore";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 전역 키보드 이벤트 핸들러 (테스트 가능하도록 분리).
 * - Esc: 선택된 역/열차 해제 + 검색창 닫기
 * - P: 성능 모니터 토글
 * - H: 히트맵 토글
 * - /: 역 검색 열기
 * - R: 경로 탐색 모드 토글
 */
export function handleGlobalKeyDown(event: KeyboardEvent): void {
	// input/textarea 등에서는 Escape만 처리
	const target = event.target as HTMLElement | null | undefined;
	const isInputFocused =
		target !== null &&
		target !== undefined &&
		(target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");

	if (isInputFocused) {
		if (event.key === "Escape") {
			useStationStore.getState().setSearchOpen(false);
		}
		return;
	}

	if (event.key === "Escape") {
		const { isSearchOpen, setSearchOpen } = useStationStore.getState();
		if (isSearchOpen) {
			setSearchOpen(false);
		} else {
			useStationStore.getState().selectStation(null);
			useTrainStore.getState().selectTrain(null);
			useRouteStore.getState().clearRoute();
		}
	} else if (event.key === "/") {
		event.preventDefault();
		useStationStore.getState().setSearchOpen(true);
	} else if (event.key === "r" || event.key === "R") {
		useRouteStore.getState().toggleRouteMode();
	} else if (event.key === "p" || event.key === "P") {
		usePerfStore.getState().toggleVisible();
	} else if (event.key === "h" || event.key === "H") {
		useMapStore.getState().toggleHeatmap();
	}
}

/**
 * 전역 키보드 단축키를 등록한다.
 * - Esc: 선택된 역/열차 해제
 */
export function useKeyboardShortcuts(): void {
	useEffect(() => {
		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, []);
}
