import { beforeEach, describe, expect, it } from "vitest";
import { handleTrainTap } from "@/canvas/interactions/trainClick";
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

describe("handleTrainTap", () => {
	beforeEach(() => {
		useTrainStore.setState({ selectedTrainNo: null });
		useStationStore.setState({ selectedStation: null });
	});

	it("열차 번호를 selectedTrainNo에 설정한다", () => {
		handleTrainTap("1001");
		expect(useTrainStore.getState().selectedTrainNo).toBe("1001");
	});

	it("selectedStation을 null로 초기화한다", () => {
		useStationStore.setState({ selectedStation: MOCK_STATION });
		handleTrainTap("1001");
		expect(useStationStore.getState().selectedStation).toBeNull();
	});
});
