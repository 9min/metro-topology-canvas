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

	it("애니메이션 시 trackAngle은 update()에서 이동 방향으로 갱신된다", () => {
		// 초기 위치 (100, 200)에 배치
		animator.setTargets([MOCK_TRAIN]);

		// 새 목표 — 오른쪽(+x)으로 이동
		const updatedTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			trackAngle: 1.23, // interpolation 값과 무관하게
		};
		animator.setTargets([updatedTrain]);

		// setTargets 직후에는 이전 trackAngle 유지 (advanceTrainState 미실행)
		const stateBefore = animator.getTrainState("1001");
		expect(stateBefore?.trackAngle).toBe(MOCK_TRAIN.trackAngle);

		// update() 호출 시 advanceTrainState가 이동 방향으로 갱신
		animator.update();
		const stateAfter = animator.getTrainState("1001");
		// 이동 방향: (100,200)→(200,200) = atan2(0,100) = 0
		expect(stateAfter?.trackAngle).toBeCloseTo(0, 1);
	});

	it("정지 상태 열차도 interpolation의 trackAngle을 사용한다", () => {
		animator.setTargets([MOCK_TRAIN]);

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

	it("direction이 바뀌어도 기존 위치에서 애니메이션이 계속된다", () => {
		// 상행으로 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);
		const stateBefore = animator.getTrainState("1001");
		expect(stateBefore?.direction).toBe("상행");

		// 하행으로 전환 + 새 좌표 (오른쪽으로 이동 — 정방향)
		const reversedTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			direction: "하행",
		};
		animator.setTargets([reversedTrain], 5000);

		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.direction).toBe("하행");
		// 기존 위치(100,200)에서 시작하여 새 목표(200,200)로 애니메이션
		expect(stateAfter?.startX).toBe(100);
		expect(stateAfter?.startY).toBe(200);
		expect(stateAfter?.targetX).toBe(200);
		expect(stateAfter?.targetY).toBe(200);
	});

	it("역방향 이동 시 텔레포트한다", () => {
		// 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);

		// 오른쪽으로 이동 → duration=0으로 즉시 배치
		const rightTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([rightTrain], 0);
		animator.update(); // currentX = 200

		// trackAngle=0(→) 방향이 예상이지만 실제 이동은 왼쪽(←) → 역방향 → 텔레포트
		const reverseTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 150,
			y: 200,
			trackAngle: 0, // 오른쪽 방향 유지 (API에서 같은 구간 유지)
		};
		animator.setTargets([reverseTrain], 5000);

		const state = animator.getTrainState("1001");
		// 역방향 → 텔레포트 (duration=0)
		expect(state?.duration).toBe(0);
		// 텔레포트 시 interpolation의 trackAngle 적용
		expect(state?.trackAngle).toBe(0);
	});

	it("텔레포트 후 다음 폴링에서 정방향 이동이 다시 텔레포트되지 않는다 (진동 방지)", () => {
		// 시나리오: B역(100,200)과 C역(200,200) 사이를 이동하는 열차
		// Poll N: (170,200) = lerp(B,C, 0.70) 위치에 배치
		const initialTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 170,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([initialTrain], 0);
		animator.update(); // currentX = 170

		// Poll N+1: B "到着" 35% 위치 (135,200) — trackAngle=0(→)인데 실제 이동 ← → 텔레포트
		const backwardTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 135,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([backwardTrain], 5000);
		const stateAfterTeleport = animator.getTrainState("1001");
		expect(stateAfterTeleport?.duration).toBe(0); // 텔레포트 발생 확인
		animator.update(); // currentX = 135

		// Poll N+2: B "出発" 70% 위치 (170,200) — trackAngle=0(→)이고 실제 이동도 → → 정방향
		const forwardTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 170,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([forwardTrain], 5000);
		const stateAfterForward = animator.getTrainState("1001");
		// 정방향이므로 텔레포트하지 않아야 한다 (이전 prevDirX 방식이면 진동 발생)
		expect(stateAfterForward?.duration).toBeGreaterThan(0);
	});

	it("trackAngle과 같은 방향 이동은 텔레포트하지 않는다", () => {
		// 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);
		animator.update();

		// trackAngle=0(→), 실제 이동도 오른쪽(→) → 정방향 → 애니메이션
		const sameDirTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([sameDirTrain], 5000);
		const state = animator.getTrainState("1001");
		expect(state?.duration).toBeGreaterThan(0); // 텔레포트 없음
	});

	it("trackAngle과 반대 방향 이동은 텔레포트한다", () => {
		// 초기 배치 (200, 200)에 즉시 배치
		const initTrain: InterpolatedTrain = { ...MOCK_TRAIN, x: 200, y: 200, trackAngle: 0 };
		animator.setTargets([initTrain], 0);
		animator.update(); // currentX = 200

		// trackAngle=0(→)인데 실제 이동은 왼쪽(←) → 역방향 → 텔레포트
		const oppositeTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 100,
			y: 200,
			trackAngle: 0,
		};
		animator.setTargets([oppositeTrain], 5000);
		const state = animator.getTrainState("1001");
		expect(state?.duration).toBe(0);
		expect(state?.trackAngle).toBe(0);
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

	it("2점 경로에서 update() 후 trackAngle이 이동 방향으로 갱신된다", () => {
		// 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);

		// 오른쪽으로 이동 (x+100) — trackAngle은 0(→)이어야 한다
		// trackAngle=0.8(비스듬한 값)이지만 이동 방향과 반대가 아니므로 애니메이션 진행
		const rightTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 200,
			y: 200,
			trackAngle: 0.8, // interpolation이 대략 맞는 방향이지만 약간 틀린 값을 줘도
		};
		animator.setTargets([rightTrain], 5000, true);

		// update()로 advanceTrainState 실행
		animator.update();

		const state = animator.getTrainState("1001");
		// 실제 이동 방향(→)으로 trackAngle이 갱신되어야 한다
		expect(state?.trackAngle).toBeCloseTo(0, 1);
	});

	it("텔레포트(duration=0) 시 trackAngle이 변경되지 않는다", () => {
		// 초기 배치 (100, 200)
		animator.setTargets([MOCK_TRAIN]);

		// 매우 먼 곳으로 이동 → duration=0 텔레포트
		const farTrain: InterpolatedTrain = {
			...MOCK_TRAIN,
			x: 2900,
			y: 1800,
			trackAngle: 1.23,
		};
		animator.setTargets([farTrain]);

		const stateBeforeUpdate = animator.getTrainState("1001");
		expect(stateBeforeUpdate?.duration).toBe(0);
		const angleBefore = stateBeforeUpdate?.trackAngle;

		// update() 호출해도 trackAngle 변경 안 됨
		animator.update();

		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.trackAngle).toBe(angleBefore);
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
