import { useEffect } from "react";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 전역 키보드 이벤트 핸들러 (테스트 가능하도록 분리).
 * - Esc: 선택된 역/열차 해제
 */
export function handleGlobalKeyDown(event: KeyboardEvent): void {
	if (event.key === "Escape") {
		useStationStore.getState().selectStation(null);
		useTrainStore.getState().selectTrain(null);
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
