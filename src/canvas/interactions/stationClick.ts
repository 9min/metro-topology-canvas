import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station } from "@/types/station";

/**
 * 역 클릭 시 Zustand 스토어의 selectedStation을 업데이트하고, 열차 선택을 해제한다.
 */
export function handleStationTap(station: Station): void {
	useStationStore.getState().selectStation(station);
	useTrainStore.getState().selectTrain(null);
}
