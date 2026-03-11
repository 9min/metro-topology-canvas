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
	progress: 0,
	fromStationId: "S01",
	toStationId: "S01",
	trackAngle: 0,
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

	it("사라진 열차는 setTargets 후 즉시 삭제되지 않고 fade-out 상태가 된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		expect(animator.count).toBe(1);

		animator.setTargets([]);
		// fade-out 중이므로 아직 존재
		expect(animator.count).toBe(1);
		const state = animator.getTrainState("1001");
		expect(state?.fadeOutStartedAt).toBeDefined();
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

	it("신규 열차는 duration=0으로 즉시 배치된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(0);
		expect(state?.currentX).toBe(100);
		expect(state?.currentY).toBe(200);
	});

	it("같은 좌표면 정지한다 (duration=0)", () => {
		animator.setTargets([MOCK_TRAIN]);

		// 같은 좌표로 다시 전달
		animator.setTargets([MOCK_TRAIN], 9000);
		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(0);
	});

	it("다른 좌표면 등속 직선 이동한다", () => {
		animator.setTargets([MOCK_TRAIN]);

		const movedTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 200, y: 300 };
		animator.setTargets([movedTrain], 9000);
		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(9000);
		expect(state?.targetX).toBe(200);
		expect(state?.targetY).toBe(300);
	});

	it("이동 시 경로가 항상 2점이다", () => {
		animator.setTargets([MOCK_TRAIN]);

		const movedTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 300, y: 400 };
		animator.setTargets([movedTrain], 9000);
		const state = animator.getTrainState("1001");
		expect(state?.path.length).toBe(2);
	});

	it("이동 시 linear=true이다", () => {
		animator.setTargets([MOCK_TRAIN]);

		const movedTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 300, y: 400 };
		animator.setTargets([movedTrain], 9000);
		const state = animator.getTrainState("1001");
		expect(state?.linear).toBe(true);
	});

	it("update() 후 trackAngle이 이동 방향으로 갱신된다", () => {
		animator.setTargets([MOCK_TRAIN]);

		const rightTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 200, y: 200 };
		animator.setTargets([rightTrain], 9000);
		animator.update();

		const state = animator.getTrainState("1001");
		// 이동 방향: (100,200)→(200,200) = atan2(0,100) = 0
		expect(state?.trackAngle).toBeCloseTo(0, 1);
	});

	it("정지 상태 열차는 trackAngle이 유지된다", () => {
		const trainWithAngle: InterpolatedTrain = { ...MOCK_TRAIN, trackAngle: 1.5 };
		animator.setTargets([trainWithAngle]);

		// 같은 좌표 → 정지 → trackAngle 유지
		animator.setTargets([trainWithAngle], 9000);
		const state = animator.getTrainState("1001");
		expect(state?.trackAngle).toBe(1.5);
	});

	it("fade-out 완료 후 열차가 삭제된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		animator.setTargets([]); // fade-out 시작

		const state = animator.getTrainState("1001");
		expect(state?.fadeOutStartedAt).toBeDefined();

		// fade-out 시작 시각을 과거로 조정하여 완료 시뮬레이션
		if (state) {
			state.fadeOutStartedAt = performance.now() - 600; // TRAIN_FADEOUT_MS(500) 초과
		}

		animator.update(); // removeCompletedFadeOuts 호출

		expect(animator.count).toBe(0);
		expect(animator.getTrainState("1001")).toBeUndefined();
	});

	it("fade-out 중 복귀하면 fade-out이 취소된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		animator.setTargets([]); // fade-out 시작

		const stateFading = animator.getTrainState("1001");
		expect(stateFading?.fadeOutStartedAt).toBeDefined();

		// 같은 열차가 다시 나타남
		animator.setTargets([MOCK_TRAIN]);

		const stateRevived = animator.getTrainState("1001");
		expect(stateRevived?.fadeOutStartedAt).toBeUndefined();
		expect(animator.count).toBe(1);
	});

	it("먼 거리도 등속 직선 이동한다 (텔레포트 없음)", () => {
		animator.setTargets([MOCK_TRAIN]);

		const farTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 2900, y: 1800 };
		animator.setTargets([farTrain], 9000);

		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(9000);
		expect(state?.path.length).toBe(2);
	});

	it("direction이 바뀌어도 기존 위치에서 애니메이션이 계속된다", () => {
		animator.setTargets([MOCK_TRAIN]);

		const reversedTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			direction: "하행",
		};
		animator.setTargets([reversedTrain], 9000);

		const state = animator.getTrainState("1001");
		expect(state?.direction).toBe("하행");
		expect(state?.startX).toBe(100);
		expect(state?.startY).toBe(200);
		expect(state?.targetX).toBe(200);
		expect(state?.targetY).toBe(200);
	});
});
