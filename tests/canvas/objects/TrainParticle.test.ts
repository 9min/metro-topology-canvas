import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimatedTrainState } from "@/types/train";

// PixiJS Graphics 클래스 모킹 (new 연산자로 생성 가능)
class MockGraphics {
	x = 0;
	y = 0;
	alpha = 1.0;
	rotation = 0;
	label = "";
	eventMode = "none";
	cursor = "default";
	scale = { set: vi.fn() };
	on = vi.fn();

	private _children: MockGraphics[] = [];

	addChild(child: MockGraphics) {
		this._children.push(child);
	}
	getChildByLabel(label: string): MockGraphics | null {
		return this._children.find((c) => c.label === label) ?? null;
	}
	clear() {
		return this;
	}
	circle() {
		return this;
	}
	roundRect() {
		return this;
	}
	moveTo() {
		return this;
	}
	lineTo() {
		return this;
	}
	closePath() {
		return this;
	}
	fill() {
		return this;
	}
	stroke() {
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
	path: [{ x: 100, y: 100 }],
	pathCumulativeDist: [0],
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

describe("drawAnimatedTrains 캡슐 회전", () => {
	let pool: Map<string, MockGraphics>;

	beforeEach(() => {
		pool = new Map();
	});

	it("이동 중인 열차의 rotation이 이동 방향으로 부드럽게 전환된다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		const movingTrain: AnimatedTrainState = {
			...MOCK_TRAIN,
			startX: 100,
			startY: 100,
			targetX: 200,
			targetY: 200,
			currentX: 150,
			currentY: 150,
		};
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [movingTrain], pool as any, null, null, vi.fn());
		const gfx = pool.get("1001");
		// 초기 rotation=0, 목표=π/4, 한 프레임에 0.12만큼 접근
		const expected = (Math.PI / 4) * 0.12;
		expect(gfx?.rotation).toBeCloseTo(expected, 5);
	});

	it("정지 열차는 이전 rotation 값을 유지한다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		// 먼저 이동 중인 열차를 그려서 rotation 설정
		const movingTrain: AnimatedTrainState = {
			...MOCK_TRAIN,
			startX: 100,
			startY: 100,
			targetX: 200,
			targetY: 100,
			currentX: 150,
			currentY: 100,
		};
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [movingTrain], pool as any, null, null, vi.fn());
		const gfx = pool.get("1001");
		const rotationAfterMove = gfx?.rotation ?? 0;
		// 목표=0, 초기=0 → rotation=0 (차이 없음)
		expect(rotationAfterMove).toBeCloseTo(0, 5);

		// 정지 상태로 변경 (startX === targetX, startY === targetY)
		const stoppedTrain: AnimatedTrainState = {
			...MOCK_TRAIN,
			startX: 200,
			startY: 100,
			targetX: 200,
			targetY: 100,
			currentX: 200,
			currentY: 100,
		};
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [stoppedTrain], pool as any, null, null, vi.fn());
		// 정지 시 이전 rotation(0) 유지
		expect(gfx?.rotation).toBeCloseTo(0, 5);
	});

	it("반대 방향 회전 시 최단 경로로 전환된다", () => {
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		const layer = createMockContainer() as any;
		// 풀에 기존 Graphics를 미리 설정 (rotation을 π - 0.1 근처로)
		const gfx = new MockGraphics();
		gfx.rotation = Math.PI - 0.1; // ~170°
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		pool.set("1001", gfx as any);
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		layer.addChild(gfx as any);

		// 목표 방향: -(π - 0.1) ≈ -170° (반대쪽)
		// 최단 경로: +0.2 (시계방향 20°), NOT -340°
		const train: AnimatedTrainState = {
			...MOCK_TRAIN,
			startX: 100,
			startY: 100,
			targetX: 100 + Math.cos(-(Math.PI - 0.1)) * 10,
			targetY: 100 + Math.sin(-(Math.PI - 0.1)) * 10,
			currentX: 100,
			currentY: 100,
		};
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		drawAnimatedTrains(layer, [train], pool as any, null, null, vi.fn());

		// 최단 경로(+0.2)로 lerp → rotation이 증가해야 함
		expect(gfx.rotation).toBeGreaterThan(Math.PI - 0.1);
	});
});
