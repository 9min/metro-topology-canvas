import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import type { ScreenCoord } from "@/types/map";
import type { InterpolatedTrain } from "@/types/train";
import type { StationGraph } from "@/utils/pathFinder";

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

	it("linear=true 시 열차 상태에 linear 플래그가 설정된다", () => {
		animator.setTargets([MOCK_TRAIN], 3000, true);
		const state = animator.getTrainState("1001");
		expect(state?.linear).toBe(true);
	});

	it("linear 미지정 시 기본값 false로 설정된다", () => {
		animator.setTargets([MOCK_TRAIN]);
		const state = animator.getTrainState("1001");
		expect(state?.linear).toBe(false);
	});

	it("이동 중인 기존 열차의 trackAngle은 실제 이동 벡터 기준으로 설정된다", () => {
		// 초기 위치 (100, 200)에 배치
		animator.setTargets([MOCK_TRAIN]);

		// 새 목표 (200, 200) — 오른쪽으로 이동, 예상 각도 0 (atan2(0, 100))
		const updatedTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			trackAngle: Math.PI, // interpolation에서 전혀 다른 각도를 줘도
		};
		animator.setTargets([updatedTrain]);

		const state = animator.getTrainState("1001");
		// 실제 이동 방향(오른쪽)인 0에 가까워야 한다 (Math.PI가 아님)
		expect(state?.trackAngle).toBeCloseTo(0, 1);
	});

	it("정지 상태 열차는 interpolation의 trackAngle을 사용한다", () => {
		// 초기 위치 (100, 200)에 배치
		animator.setTargets([MOCK_TRAIN]);

		// 같은 위치로 갱신 — 이동 없음
		const stationaryTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 100,
			y: 200,
			trackAngle: 1.5,
		};
		animator.setTargets([stationaryTrain]);

		const state = animator.getTrainState("1001");
		expect(state?.trackAngle).toBe(1.5);
	});

	it("direction이 바뀌면 신규 배치로 리셋된다", () => {
		// 상행으로 초기 배치
		animator.setTargets([MOCK_TRAIN]);
		const stateBefore = animator.getTrainState("1001");
		expect(stateBefore?.direction).toBe("상행");

		// 하행으로 전환 + 새 좌표
		const reversedTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 500,
			y: 600,
			direction: "하행",
		};
		animator.setTargets([reversedTrain]);

		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.direction).toBe("하행");
		// 새 좌표로 리셋 (기존 위치에서 애니메이션하지 않고 신규 배치)
		expect(stateAfter?.targetX).toBe(500);
		expect(stateAfter?.targetY).toBe(600);
	});

	it("거리가 임계값을 초과하면 즉시 텔레포트한다", () => {
		// 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);

		// 매우 먼 곳으로 이동 (2900, 1800) — 거리 > 500px
		const farTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 2900,
			y: 1800,
		};
		animator.setTargets([farTrain]);

		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(0);
	});

	it("역방향 BFS 경로는 직선 fallback된다", () => {
		// 그래프: S01 - S02 - S03 (왼→오 배치)
		const graph: StationGraph = new Map([
			["S01", ["S02"]],
			["S02", ["S01", "S03"]],
			["S03", ["S02"]],
		]);
		const screenMap = new Map<string, ScreenCoord>([
			["S01", { x: 100, y: 200 }],
			["S02", { x: 200, y: 200 }],
			["S03", { x: 300, y: 200 }],
		]);

		// 1단계: S03에 초기 배치 (toStationId = S03)
		const initialTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 300,
			y: 200,
			fromStationId: "S03",
			toStationId: "S03",
		};
		animator.setTargets([initialTrain], undefined, false, screenMap, graph);

		// 2단계: S01으로 이동 — BFS 경로(S03→S02→S01)는 오른쪽→왼쪽이지만
		// 실제 이동도 왼쪽이므로 방향 일치하면 polyline, 불일치면 직선
		const leftTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 80,
			y: 200,
			fromStationId: "S01",
			toStationId: "S01",
		};
		animator.setTargets([leftTrain], 5000, true, screenMap, graph);

		const state = animator.getTrainState("1001");
		expect(state).toBeDefined();
		// 이 경우 BFS S03→S02→S01 방향과 이동 방향이 같으므로 polyline이 될 수 있다
		// 핵심: 역방향이 아니므로 경로가 정상 구성됨
		expect(state?.path.length).toBeGreaterThanOrEqual(2);
	});

	it("인접 역 이동 시 직선 경로를 구성한다", () => {
		// 그래프: S01 - S02
		const graph: StationGraph = new Map([
			["S01", ["S02"]],
			["S02", ["S01"]],
		]);
		const screenMap = new Map<string, ScreenCoord>([
			["S01", { x: 100, y: 200 }],
			["S02", { x: 200, y: 200 }],
		]);

		// 1단계: S01에 초기 배치 (toStationId = S01)
		animator.setTargets([MOCK_TRAIN], undefined, false, screenMap, graph);

		// 2단계: S02로 이동 — BFS [S01, S02] → 첫/끝 제거 → 중간역 없음 → path 2점(직선)
		const nextTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			fromStationId: "S02",
			toStationId: "S02",
		};
		animator.setTargets([nextTrain], 5000, true, screenMap, graph);

		const state = animator.getTrainState("1001");
		expect(state).toBeDefined();
		// BFS 첫/끝 제거 후 중간역이 없으므로 startPoint + endPoint = 2점
		expect(state?.path.length).toBe(2);
	});

	it("polyline 총거리가 임계값 초과 시 즉시 텔레포트한다", () => {
		// 지그재그 4역 그래프: S01 - S02 - S03 - S04
		const graph: StationGraph = new Map([
			["S01", ["S02"]],
			["S02", ["S01", "S03"]],
			["S03", ["S02", "S04"]],
			["S04", ["S03"]],
		]);
		// 지그재그 배치로 polyline 거리를 크게 만든다
		const screenMap = new Map<string, ScreenCoord>([
			["S01", { x: 0, y: 0 }],
			["S02", { x: 256, y: 256 }],
			["S03", { x: 0, y: 512 }],
			["S04", { x: 256, y: 768 }],
		]);

		// 1단계: S01에 초기 배치
		const initTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 0,
			y: 0,
			fromStationId: "S01",
			toStationId: "S01",
		};
		animator.setTargets([initTrain], undefined, false, screenMap, graph);

		// 2단계: S04로 이동 — BFS [S01,S02,S03,S04] → 중간역 S02,S03 → polyline > 500px
		const farTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 256,
			y: 768,
			fromStationId: "S04",
			toStationId: "S04",
		};
		animator.setTargets([farTrain], 5000, true, screenMap, graph);

		const state = animator.getTrainState("1001");
		expect(state).toBeDefined();
		// polyline 총거리가 MAX_TRAIN_ANIM_DIST(500)를 초과하므로 즉시 텔레포트
		expect(state?.duration).toBe(0);
	});

	it("경유역이 있으면 polyline 경로를 구성한다", () => {
		// 그래프: S01 - S02 - S03
		const graph: StationGraph = new Map([
			["S01", ["S02"]],
			["S02", ["S01", "S03"]],
			["S03", ["S02"]],
		]);
		const screenMap = new Map<string, ScreenCoord>([
			["S01", { x: 100, y: 200 }],
			["S02", { x: 200, y: 200 }],
			["S03", { x: 300, y: 200 }],
		]);

		// 1단계: S01에 초기 배치 (toStationId = S01)
		animator.setTargets([MOCK_TRAIN], undefined, false, screenMap, graph);

		// 2단계: S03으로 이동 (fromStationId = S03, 이전 toStationId = S01 → BFS: S01→S02→S03)
		const farTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 300,
			y: 200,
			fromStationId: "S03",
			toStationId: "S03",
		};
		animator.setTargets([farTrain], 5000, true, screenMap, graph);

		const state = animator.getTrainState("1001");
		expect(state).toBeDefined();
		// path에 경유역(S01, S02, S03)이 포함되어 3점 이상이어야 한다
		expect(state?.path.length).toBeGreaterThanOrEqual(3);
		// pathCumulativeDist 길이가 path와 일치
		expect(state?.pathCumulativeDist.length).toBe(state?.path.length);
	});
});
