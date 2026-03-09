import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 열차 클릭 시 Zustand 스토어의 selectedTrainNo를 업데이트하고, 역 선택을 해제한다.
 */
export function handleTrainTap(trainNo: string): void {
	useTrainStore.getState().selectTrain(trainNo);
	useStationStore.getState().selectStation(null);
}
