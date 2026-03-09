import { beforeEach, describe, expect, it, vi } from "vitest";

// pixi.js 모킹: vi.mock은 호이스팅되므로 클래스 선언 없이 factory에서 직접 정의
vi.mock("pixi.js", () => {
	return {
		Text: class {
			x = 0;
			y = 0;
			text: string;
			anchor = { set: vi.fn() };
			constructor({ text }: { text: string }) {
				this.text = text;
			}
		},
	};
});

import { drawStationLabels } from "@/canvas/objects/StationLabel";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";

const STATIONS: Station[] = [
	{ id: "S01", name: "역1", line: 1, x: 127.0, y: 37.5 },
	{ id: "S02", name: "역2", line: 1, x: 127.1, y: 37.6 },
	{ id: "S03", name: "역3", line: 1, x: 127.2, y: 37.7 },
];

const SCREEN_MAP = new Map<string, ScreenCoord>([
	["S01", { x: 100, y: 200 }],
	["S02", { x: 200, y: 300 }],
	// S03는 map에 없음 (좌표 미등록)
]);

function createMockLayer() {
	const children: { x: number; y: number; text: string }[] = [];
	return {
		children,
		addChild(child: { x: number; y: number; text: string }) {
			children.push(child);
		},
		removeChildren() {
			children.length = 0;
		},
	};
}

describe("drawStationLabels", () => {
	let layer: ReturnType<typeof createMockLayer>;

	beforeEach(() => {
		layer = createMockLayer();
	});

	it("화면 좌표가 있는 역 수만큼 레이블을 생성한다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawStationLabels(layer as any, STATIONS, SCREEN_MAP);
		// S01, S02만 좌표 존재 → 2개
		expect(layer.children).toHaveLength(2);
	});

	it("레이블 텍스트가 역 이름과 일치한다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawStationLabels(layer as any, STATIONS, SCREEN_MAP);
		expect(layer.children[0]?.text).toBe("역1");
		expect(layer.children[1]?.text).toBe("역2");
	});

	it("레이블 x 좌표가 역 화면 좌표와 일치한다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawStationLabels(layer as any, STATIONS, SCREEN_MAP);
		expect(layer.children[0]?.x).toBe(100);
		expect(layer.children[1]?.x).toBe(200);
	});

	it("호출 시 기존 레이블을 초기화한다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawStationLabels(layer as any, STATIONS, SCREEN_MAP);
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawStationLabels(layer as any, STATIONS, SCREEN_MAP);
		expect(layer.children).toHaveLength(2);
	});
});
