import { beforeEach, describe, expect, it, vi } from "vitest";

// pixi.js는 브라우저 환경이 필요하므로 모킹한다
vi.mock("pixi.js", () => ({
	Graphics: class {
		circle() {
			return this;
		}
		fill() {
			return this;
		}
		stroke() {
			return this;
		}
		clear() {
			return this;
		}
		on = vi.fn();
		eventMode = "none";
		cursor = "default";
	},
}));

import { updateStationAlpha } from "@/canvas/objects/StationNode";
import { useStationStore } from "@/stores/useStationStore";
import type { Station, StationLink } from "@/types/station";

const STATIONS: Station[] = [
	{ id: "S01", name: "역1", line: 1, x: 127.0, y: 37.5 },
	{ id: "S02", name: "역2", line: 1, x: 127.1, y: 37.6 },
	{ id: "S03", name: "역3", line: 1, x: 127.2, y: 37.7 },
];

const LINKS: StationLink[] = [{ source: "S01", target: "S02", line: 1 }];

// Container 자식 노드 모킹
function createMockLayer(count: number) {
	const children = Array.from({ length: count }, () => ({ alpha: 1.0 }));
	return { children };
}

describe("updateStationAlpha", () => {
	beforeEach(() => {
		useStationStore.setState({ links: LINKS });
	});

	it("선택 없음: 모든 역의 alpha가 1.0이다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockLayer(3) as any;
		updateStationAlpha(layer, STATIONS, null);
		for (const child of layer.children) {
			expect(child.alpha).toBe(1.0);
		}
	});

	it("역 선택: 선택 역 alpha 1.0, 인접 역 0.6, 나머지 0.15", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockLayer(3) as any;
		updateStationAlpha(layer, STATIONS, "S01");
		// S01: 선택 → 1.0
		expect(layer.children[0].alpha).toBe(1.0);
		// S02: S01과 링크 연결 → 0.6
		expect(layer.children[1].alpha).toBe(0.6);
		// S03: 나머지 → 0.15
		expect(layer.children[2].alpha).toBe(0.15);
	});

	it("인접 역 없는 역 선택: 선택 역만 1.0, 나머지 0.15", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockLayer(3) as any;
		updateStationAlpha(layer, STATIONS, "S03");
		expect(layer.children[0].alpha).toBe(0.15);
		expect(layer.children[1].alpha).toBe(0.15);
		expect(layer.children[2].alpha).toBe(1.0);
	});
});
