import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import { wasPanning } from "./panGuard";

/**
 * 열차 클릭 시 Zustand 스토어의 selectedTrainNo를 업데이트하고, 역 선택을 해제한다.
 * 패닝 직후에는 선택을 무시한다.
 */
export function handleTrainTap(trainNo: string): void {
	if (wasPanning()) return;
	useTrainStore.getState().selectTrain(trainNo);
	useStationStore.getState().selectStation(null);
}
