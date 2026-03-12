import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station } from "@/types/station";
import { wasPanning } from "./panGuard";

/**
 * 역 클릭 시 Zustand 스토어의 selectedStation을 업데이트하고, 열차 선택을 해제한다.
 * 패닝 직후에는 선택을 무시한다.
 */
export function handleStationTap(station: Station): void {
	if (wasPanning()) return;
	useStationStore.getState().selectStation(station);
	useTrainStore.getState().selectTrain(null);
}
