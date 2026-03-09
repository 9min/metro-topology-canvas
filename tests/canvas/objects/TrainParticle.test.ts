import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimatedTrainState } from "@/types/train";

// PixiJS Graphics 클래스 모킹 (new 연산자로 생성 가능)
class MockGraphics {
	x = 0;
	y = 0;
	alpha = 1.0;
	label = "";
	eventMode = "none";
	cursor = "default";
	on = vi.fn();

	circle() {
		return this;
	}
	fill() {
		return this;
	}
}

vi.mock("pixi.js", () => ({
	Graphics: MockGraphics,
}));

// LINE_COLORS 모킹 — 1호선 색상 제공
vi.mock("@/constants/lineColors", () => ({
	LINE_COLORS: { 1: "#263c96" },
}));

// drawAnimatedTrains를 직접 import (mock 적용 이후)
const { drawAnimatedTrains } = await import("@/canvas/objects/TrainParticle");

// PixiJS Container 모킹
function createMockContainer() {
	const children: MockGraphics[] = [];
	return {
		children,
		addChild(child: MockGraphics) {
			children.push(child);
		},
		removeChild(child: MockGraphics) {
			const idx = children.indexOf(child);
			if (idx !== -1) children.splice(idx, 1);
		},
	};
}

const MOCK_TRAIN: AnimatedTrainState = {
	trainNo: "1001",
	line: 1,
	direction: "상행",
	startX: 100,
	startY: 100,
	targetX: 100,
	targetY: 100,
	currentX: 100,
	currentY: 100,
	startTime: 0,
	duration: 0,
	fromStationId: "S01",
	toStationId: "S02",
};

const MOCK_TRAIN_2: AnimatedTrainState = {
	...MOCK_TRAIN,
	trainNo: "1002",
	toStationId: "S03",
};

describe("drawAnimatedTrains alpha 계산", () => {
	let pool: Map<string, MockGraphics>;

	beforeEach(() => {
		pool = new Map();
	});

	it("선택 없음: 모든 열차 alpha 1.0", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [MOCK_TRAIN, MOCK_TRAIN_2], pool as any, null, null, vi.fn());
		expect(pool.get("1001")?.alpha).toBe(1.0);
		expect(pool.get("1002")?.alpha).toBe(1.0);
	});

	it("역 선택: toStationId 일치 열차 1.0, 나머지 0.15", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [MOCK_TRAIN, MOCK_TRAIN_2], pool as any, null, "S02", vi.fn());
		expect(pool.get("1001")?.alpha).toBe(1.0);
		expect(pool.get("1002")?.alpha).toBe(0.15);
	});

	it("열차 선택: 선택 열차 1.0, 나머지 0.15", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [MOCK_TRAIN, MOCK_TRAIN_2], pool as any, "1001", null, vi.fn());
		expect(pool.get("1001")?.alpha).toBe(1.0);
		expect(pool.get("1002")?.alpha).toBe(0.15);
	});
});
