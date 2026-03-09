import { beforeEach, describe, expect, it } from "vitest";
import { handleGlobalKeyDown } from "@/hooks/useKeyboardShortcuts";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station } from "@/types/station";

const MOCK_STATION: Station = {
	id: "S01",
	name: "역1",
	line: 1,
	x: 127.0,
	y: 37.5,
};

/** KeyboardEvent 생성자 없이 테스트용 이벤트 객체 생성 */
function keyEvent(key: string): KeyboardEvent {
	return { key } as KeyboardEvent;
}

describe("handleGlobalKeyDown", () => {
	beforeEach(() => {
		useStationStore.setState({ selectedStation: MOCK_STATION });
		useTrainStore.setState({ selectedTrainNo: "1001" });
	});

	it("Esc 키로 역 선택이 해제된다", () => {
		handleGlobalKeyDown(keyEvent("Escape"));
		expect(useStationStore.getState().selectedStation).toBeNull();
	});

	it("Esc 키로 열차 선택이 해제된다", () => {
		handleGlobalKeyDown(keyEvent("Escape"));
		expect(useTrainStore.getState().selectedTrainNo).toBeNull();
	});

	it("다른 키는 역/열차 선택을 유지한다", () => {
		handleGlobalKeyDown(keyEvent("Enter"));
		expect(useStationStore.getState().selectedStation).not.toBeNull();
		expect(useTrainStore.getState().selectedTrainNo).toBe("1001");
	});
});
