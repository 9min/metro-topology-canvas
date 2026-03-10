import { beforeEach, describe, expect, it } from "vitest";
import { getEnabledLines, useMapStore } from "@/stores/useMapStore";

const LIVE_ENABLED = getEnabledLines("live");
const SIM_ENABLED = getEnabledLines("simulation");

describe("useMapStore — activeLines (live 모드)", () => {
	beforeEach(() => {
		useMapStore.setState({ activeLines: new Set([1]) });
	});

	it("toggleLine: 활성화 가능 노선(1호선)을 비활성화한다", () => {
		useMapStore.getState().toggleLine(1, LIVE_ENABLED);
		expect(useMapStore.getState().activeLines.has(1)).toBe(false);
	});

	it("toggleLine: 비활성화된 1호선을 다시 활성화한다", () => {
		useMapStore.setState({ activeLines: new Set() });
		useMapStore.getState().toggleLine(1, LIVE_ENABLED);
		expect(useMapStore.getState().activeLines.has(1)).toBe(true);
	});

	it("selectSingleLine: 3호선 선택 시 해당 호선만 활성화된다", () => {
		useMapStore.getState().selectSingleLine(3);
		const lines = useMapStore.getState().activeLines;
		expect(lines.size).toBe(1);
		expect(lines.has(3)).toBe(true);
	});

	it("selectSingleLine: 연속 호선 전환이 정상 동작한다", () => {
		useMapStore.getState().selectSingleLine(5);
		expect(useMapStore.getState().activeLines).toEqual(new Set([5]));
		useMapStore.getState().selectSingleLine(7);
		expect(useMapStore.getState().activeLines).toEqual(new Set([7]));
	});

	it("setAllLinesActive(true): live 모드에서 9개 노선 모두 활성화한다", () => {
		useMapStore.setState({ activeLines: new Set() });
		useMapStore.getState().setAllLinesActive(true, LIVE_ENABLED);
		expect(useMapStore.getState().activeLines.size).toBe(9);
	});

	it("setAllLinesActive(false): 모든 노선을 비활성화한다", () => {
		useMapStore.getState().setAllLinesActive(false, LIVE_ENABLED);
		expect(useMapStore.getState().activeLines.size).toBe(0);
	});
});

describe("useMapStore — activeLines (simulation 모드)", () => {
	beforeEach(() => {
		useMapStore.setState({ activeLines: new Set(SIM_ENABLED) });
	});

	it("toggleLine: 시뮬레이션에서 모든 노선 토글 가능", () => {
		useMapStore.getState().toggleLine(5, SIM_ENABLED);
		expect(useMapStore.getState().activeLines.has(5)).toBe(false);
		useMapStore.getState().toggleLine(5, SIM_ENABLED);
		expect(useMapStore.getState().activeLines.has(5)).toBe(true);
	});

	it("setAllLinesActive(true): 시뮬레이션에서 9개 노선 모두 활성화", () => {
		useMapStore.setState({ activeLines: new Set() });
		useMapStore.getState().setAllLinesActive(true, SIM_ENABLED);
		expect(useMapStore.getState().activeLines.size).toBe(9);
	});

	it("syncLinesForMode: live 전환 시 1호선만, simulation 전환 시 9개 전체", () => {
		useMapStore.getState().syncLinesForMode("live");
		expect(useMapStore.getState().activeLines).toEqual(new Set([1]));
		useMapStore.getState().syncLinesForMode("simulation");
		expect(useMapStore.getState().activeLines.size).toBe(9);
	});
});
