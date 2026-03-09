import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import type { InterpolatedTrain } from "@/types/train";

// PixiJS Container 모킹
function createMockContainer() {
	const children: { x: number; y: number; visible: boolean }[] = [];
	return {
		children,
		addChild(child: { x: number; y: number; visible: boolean }) {
			children.push(child);
		},
		removeChild(child: { x: number; y: number; visible: boolean }) {
			const idx = children.indexOf(child);
			if (idx !== -1) children.splice(idx, 1);
		},
		removeChildren() {
			children.length = 0;
		},
	};
}

// drawAnimatedTrains 모킹
vi.mock("@/canvas/objects/TrainParticle", () => ({
	drawAnimatedTrains: vi.fn(),
}));

const MOCK_TRAIN: InterpolatedTrain = {
	trainNo: "1001",
	line: 1,
	x: 100,
	y: 200,
	direction: "상행",
	progress: 1,
	fromStationId: "S01",
	toStationId: "S01",
};

describe("TrainAnimator", () => {
	let animator: TrainAnimator;

	beforeEach(() => {
		animator = new TrainAnimator();
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		animator.setLayer(createMockContainer() as any);
	});

	it("초기 상태에서 열차 수가 0이다", () => {
		expect(animator.count).toBe(0);
	});

	it("setTargets로 열차를 추가하면 count가 증가한다", () => {
		animator.setTargets([MOCK_TRAIN]);
		expect(animator.count).toBe(1);
	});

	it("사라진 열차는 setTargets 후 제거된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		expect(animator.count).toBe(1);

		animator.setTargets([]);
		expect(animator.count).toBe(0);
	});

	it("기존 열차에 새 목표를 전달하면 상태가 갱신된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		const updatedTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 300, y: 400 };
		animator.setTargets([updatedTrain]);
		expect(animator.count).toBe(1);
	});

	it("clear()로 전체 상태를 초기화한다", () => {
		animator.setTargets([MOCK_TRAIN]);
		animator.clear();
		expect(animator.count).toBe(0);
	});

	it("clear() 후 pool이 비워진다 (count 0으로 확인)", () => {
		animator.setTargets([MOCK_TRAIN]);
		animator.clear();
		// pool이 비워지면 동일 열차를 재추가해도 count는 정상
		animator.setTargets([MOCK_TRAIN]);
		expect(animator.count).toBe(1);
	});

	it("layer가 설정되지 않으면 update()가 에러 없이 반환한다", () => {
		const noLayerAnimator = new TrainAnimator();
		noLayerAnimator.setTargets([MOCK_TRAIN]);
		expect(() => noLayerAnimator.update()).not.toThrow();
	});

	it("getTrainState로 현재 열차 상태를 조회한다", () => {
		animator.setTargets([MOCK_TRAIN]);
		const state = animator.getTrainState("1001");
		expect(state).toBeDefined();
		expect(state?.trainNo).toBe("1001");
	});

	it("존재하지 않는 열차의 getTrainState는 undefined를 반환한다", () => {
		expect(animator.getTrainState("NONE")).toBeUndefined();
	});

	it("setOnTrainTap으로 콜백을 등록할 수 있다", () => {
		const cb = vi.fn();
		expect(() => animator.setOnTrainTap(cb)).not.toThrow();
	});
});
