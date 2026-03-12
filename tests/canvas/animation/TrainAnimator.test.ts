import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import type { InterpolatedTrain } from "@/types/train";

/** TrainAnimator 내부와 동일한 easeInOut — 테스트 기댓값 계산용 */
function easeInOut(t: number): number {
	return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

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

/** 도착 상태 기본 열차 — S01에 정차 중, 다음역 S00 */
const MOCK_TRAIN_ARRIVE: InterpolatedTrain = {
	trainNo: "1001",
	line: 1,
	direction: "상행",
	status: "도착",
	stationId: "S01",
	stationX: 100,
	stationY: 200,
	nextStationId: "S00",
	nextX: 50,
	nextY: 150,
	trackAngle: 0,
};

/** 출발 상태 열차 — S01 출발, S00 방향 이동 */
const MOCK_TRAIN_DEPART: InterpolatedTrain = {
	trainNo: "1001",
	line: 1,
	direction: "상행",
	status: "출발",
	stationId: "S01",
	stationX: 100,
	stationY: 200,
	nextStationId: "S00",
	nextX: 50,
	nextY: 150,
	trackAngle: 0,
};

describe("TrainAnimator", () => {
	let animator: TrainAnimator;

	beforeEach(() => {
		animator = new TrainAnimator();
		// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
		animator.setLayer(createMockContainer() as any);
	});

	// ── 기본 동작 ──────────────────────────────────────────────────────────────

	it("초기 상태에서 열차 수가 0이다", () => {
		expect(animator.count).toBe(0);
	});

	it("setTargets로 열차를 추가하면 count가 증가한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		expect(animator.count).toBe(1);
	});

	it("clear()로 전체 상태를 초기화한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		animator.clear();
		expect(animator.count).toBe(0);
	});

	it("clear() 후 열차를 다시 추가할 수 있다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		animator.clear();
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		expect(animator.count).toBe(1);
	});

	it("layer가 설정되지 않으면 update()가 에러 없이 반환한다", () => {
		const noLayerAnimator = new TrainAnimator();
		noLayerAnimator.setTargets([MOCK_TRAIN_ARRIVE]);
		expect(() => noLayerAnimator.update()).not.toThrow();
	});

	it("getTrainState로 현재 열차 상태를 조회한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
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

	// ── 신규 열차 초기 배치 ────────────────────────────────────────────────────

	it("신규 도착 열차는 stationX/Y에 배치되고 isMoving=false이다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(false);
		expect(state?.currentX).toBe(100);
		expect(state?.currentY).toBe(200);
		expect(state?.progress).toBe(0);
	});

	it("신규 진입 열차도 stationX/Y에 배치되고 isMoving=false이다", () => {
		const enter: InterpolatedTrain = { ...MOCK_TRAIN_ARRIVE, status: "진입" };
		animator.setTargets([enter]);
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(false);
		expect(state?.currentX).toBe(100);
		expect(state?.currentY).toBe(200);
	});

	it("신규 출발 열차는 stationX/Y에서 시작해 nextX/Y를 향해 isMoving=true이다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(true);
		expect(state?.currentX).toBe(100); // 출발 직후 위치 (progress=0)
		expect(state?.currentY).toBe(200);
		expect(state?.fromX).toBe(100);
		expect(state?.fromY).toBe(200);
		expect(state?.toX).toBe(50);
		expect(state?.toY).toBe(150);
		expect(state?.progress).toBe(0);
	});

	it("stationId와 toStationId가 올바르게 저장된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		const state = animator.getTrainState("1001");
		expect(state?.stationId).toBe("S01");
		expect(state?.toStationId).toBe("S00");
	});

	// ── 같은 구간 재폴링 ────────────────────────────────────────────────────────

	it("같은 구간 출발 재폴링 시 progress가 초기화되지 않는다 (이동 연속성 — Rule 4)", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		// 진행 중 시뮬레이션
		if (state) state.progress = 0.4;

		animator.setTargets([MOCK_TRAIN_DEPART]); // 동일 구간 재폴링
		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.progress).toBe(0.4); // progress 유지
		expect(stateAfter?.isMoving).toBe(true);
	});

	it("같은 구간 출발 재폴링 시 목표 좌표가 최신으로 동기화된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const updatedTarget: InterpolatedTrain = { ...MOCK_TRAIN_DEPART, nextX: 60, nextY: 160 };
		animator.setTargets([updatedTarget]);
		const state = animator.getTrainState("1001");
		expect(state?.toX).toBe(60);
		expect(state?.toY).toBe(160);
	});

	it("이동 중 같은 구간 도착 수신은 무시하고 이동 상태를 유지한다 (스테일 데이터)", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // isMoving=true
		const state = animator.getTrainState("1001");
		if (state) state.progress = 0.5;

		const arrive: InterpolatedTrain = { ...MOCK_TRAIN_ARRIVE, status: "도착" };
		animator.setTargets([arrive]); // 같은 구간, 도착 수신
		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.isMoving).toBe(true); // 이동 상태 유지
		expect(stateAfter?.progress).toBe(0.5); // progress 유지
	});

	it("이동 중 같은 구간 진입 수신도 무시하고 이동 상태를 유지한다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // isMoving=true
		const enter: InterpolatedTrain = { ...MOCK_TRAIN_ARRIVE, status: "진입" };
		animator.setTargets([enter]);
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(true);
	});

	it("정차 중 도착 재폴링은 정차 상태를 유지한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // isMoving=false
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // 동일 재폴링
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(false);
	});

	// ── 다음 구간으로 정상 진행 (trainAdvanced) ────────────────────────────────

	it("출발로 다음 역 진행 시 즉시 B역으로 스냅 후 C로 이동한다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발, fromX=100, toX=50

		// 이동 중간 위치 시뮬레이션 (progress=0.1, currentX=75)
		const state = animator.getTrainState("1001");
		if (state) {
			state.progress = 0.1;
			state.currentX = 75;
			state.currentY = 175;
		}

		// S00(B역)에서 출발 수신 (trainAdvanced + isDepart, progress < 1)
		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00", // 기존 toStationId → trainAdvanced 분기
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const stateAfter = animator.getTrainState("1001");

		// fromX는 B역 좌표로 즉시 전환
		expect(stateAfter?.fromX).toBe(50);
		// toX는 C역 좌표
		expect(stateAfter?.toX).toBe(10);
		// currentX는 B역으로 스냅
		expect(stateAfter?.currentX).toBe(50);
		expect(stateAfter?.currentY).toBe(150);
		// stationId/toStationId 즉시 갱신
		expect(stateAfter?.stationId).toBe("S00");
		expect(stateAfter?.toStationId).toBe("S_PREV");
		// pending 필드는 비어있음
		expect(stateAfter?.pendingToX).toBeUndefined();
		expect(stateAfter?.pendingToStationId).toBeUndefined();
		expect(stateAfter?.isMoving).toBe(true);
	});

	it("출발로 다음 역 진행(trainAdvanced+isDepart) 시 currentX/Y가 B역 좌표로 스냅된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발

		// progress=0.1인 상태 (A→B 구간 10% 진행)
		const state = animator.getTrainState("1001");
		if (state) {
			state.currentX = 95;
			state.currentY = 195;
			state.progress = 0.1;
		}

		// B역에서 출발 수신 (trainAdvanced + isDepart)
		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50, // B역 좌표
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const stateAfter = animator.getTrainState("1001");

		// currentX는 B역 좌표(50)로 스냅되어야 한다
		expect(stateAfter?.currentX).toBe(50);
		expect(stateAfter?.currentY).toBe(150);
	});

	it("도착으로 다음 역 진행 시 역 좌표로 전진 스냅한다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01→S00 이동 중

		// S00 도착 (trainAdvanced + 도착)
		const arrivedAtNext: InterpolatedTrain = {
			...MOCK_TRAIN_ARRIVE,
			stationId: "S00", // 기존 toStationId
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
			status: "도착",
		};
		animator.setTargets([arrivedAtNext]);
		const state = animator.getTrainState("1001");

		expect(state?.isMoving).toBe(false);
		expect(state?.currentX).toBe(50); // 역 좌표로 전진 스냅
		expect(state?.currentY).toBe(150);
		expect(state?.stationId).toBe("S00");
		expect(state?.toStationId).toBe("S_PREV");
	});

	// ── 예상 밖 구간 변경 (API 이상) ──────────────────────────────────────────

	it("예상 밖 구간 변경 시 새 역으로 스냅 후 이동한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // S01 정차

		// 2+ 역 점프 (S01→S03, API 이상)
		const unexpectedJump: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S03", // S00이 아닌 전혀 다른 역
			stationX: 300,
			stationY: 400,
			nextStationId: "S04",
			nextX: 500,
			nextY: 600,
		};
		animator.setTargets([unexpectedJump]);
		const state = animator.getTrainState("1001");

		expect(state?.currentX).toBe(300); // 새 역으로 스냅
		expect(state?.currentY).toBe(400);
		expect(state?.fromX).toBe(300);
		expect(state?.toX).toBe(500);
		expect(state?.progress).toBe(0);
		expect(state?.isMoving).toBe(true);
	});

	it("예상 밖 구간이 도착 상태면 정차한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // S01 정차
		const unexpectedArrive: InterpolatedTrain = {
			...MOCK_TRAIN_ARRIVE,
			stationId: "S05",
			stationX: 500,
			stationY: 600,
			nextStationId: "S06",
			nextX: 600,
			nextY: 700,
			status: "도착",
		};
		animator.setTargets([unexpectedArrive]);
		const state = animator.getTrainState("1001");
		expect(state?.isMoving).toBe(false);
		expect(state?.currentX).toBe(500);
	});

	it("예상 밖 구간 변경 시 unexpectedSnapAt이 기록된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // S01 정차

		const unexpectedJump: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S03", // S00이 아닌 전혀 다른 역 (2+ 역 점프)
			stationX: 300,
			stationY: 400,
			nextStationId: "S04",
			nextX: 500,
			nextY: 600,
		};
		animator.setTargets([unexpectedJump]);
		const state = animator.getTrainState("1001");
		expect(state?.unexpectedSnapAt).toBeDefined();
	});

	it("정상 진행(trainAdvanced)에서는 unexpectedSnapAt이 세팅되지 않는다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발, toStationId=S00

		// S00(다음 역)에서 출발 — 정상 trainAdvanced 분기
		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const state = animator.getTrainState("1001");
		expect(state?.unexpectedSnapAt).toBeUndefined();
	});

	// ── trailDirty 플래그 (스냅 시 Trail 허상 선 방지) ───────────────────────

	it("출발로 다음 역 진행(trainAdvanced+isDepart) 시 trailDirty=true가 설정된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발

		// S00(다음 역)에서 출발 (trainAdvanced)
		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const state = animator.getTrainState("1001");
		expect(state?.trailDirty).toBe(true);
	});

	it("도착으로 다음 역 진행(trainAdvanced+도착) 시 trailDirty=true가 설정된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01→S00 이동 중

		// S00 도착 (trainAdvanced + 도착)
		const arrivedAtNext: InterpolatedTrain = {
			...MOCK_TRAIN_ARRIVE,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
			status: "도착",
		};
		animator.setTargets([arrivedAtNext]);
		const state = animator.getTrainState("1001");
		expect(state?.trailDirty).toBe(true);
	});

	it("예상 밖 구간 변경 시 trailDirty=true가 설정된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]); // S01 정차

		// 2+ 역 점프 (S01→S03, API 이상)
		const unexpectedJump: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S03",
			stationX: 300,
			stationY: 400,
			nextStationId: "S04",
			nextX: 500,
			nextY: 600,
		};
		animator.setTargets([unexpectedJump]);
		const state = animator.getTrainState("1001");
		expect(state?.trailDirty).toBe(true);
	});

	it("같은 구간 재폴링 시 trailDirty가 설정되지 않는다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		if (state) state.trailDirty = false;

		animator.setTargets([MOCK_TRAIN_DEPART]); // 동일 구간 재폴링
		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.trailDirty).toBe(false);
	});

	// ── trackAngle ─────────────────────────────────────────────────────────────

	it("trackAngle은 항상 최신 폴 값을 사용한다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		const withAngle: InterpolatedTrain = { ...MOCK_TRAIN_DEPART, trackAngle: 1.57 };
		animator.setTargets([withAngle]);
		const state = animator.getTrainState("1001");
		expect(state?.trackAngle).toBe(1.57);
	});

	it("direction이 바뀌면 기존 이동 상태는 유지된 채 direction만 갱신된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		const reversed: InterpolatedTrain = { ...MOCK_TRAIN_ARRIVE, direction: "하행" };
		animator.setTargets([reversed]);
		const state = animator.getTrainState("1001");
		expect(state?.direction).toBe("하행");
	});

	// ── speedFactor 동기화 (시뮬레이션 모드 속도 일치) ─────────────────────

	it("같은 구간 출발 재폴링 시 progress가 역방향으로 점프하지 않는다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		// 애니메이터가 progress=0.5까지 전진한 상황
		if (state) state.progress = 0.5;

		// 재폴링 시 progress가 0.5 미만으로 내려가지 않아야 한다
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.progress).toBeGreaterThanOrEqual(0.5);
	});

	it("같은 구간 출발 재폴링 시 progress=1.0에서도 역방향 점프가 없다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		// 애니메이터가 progress=1.0에 도달한 상황 (구간 완료)
		if (state) state.progress = 1.0;

		// 재폴링 시 progress가 1.0 미만으로 내려가지 않아야 한다
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const stateAfter = animator.getTrainState("1001");
		expect(stateAfter?.progress).toBe(1.0);
	});

	it("다음 구간 진행(trainAdvanced+출발+progress>=1) 시 즉시 B→C 전환한다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발, toStationId=S00

		// progress=1.0: 이미 B역(S00) 도달
		const state = animator.getTrainState("1001");
		if (state) state.progress = 1.0;

		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const stateAfter = animator.getTrainState("1001");
		// 즉시 B→C 전환: progress=0, stationId=S00, toX=10
		expect(stateAfter?.progress).toBe(0);
		expect(stateAfter?.stationId).toBe("S00");
		expect(stateAfter?.toX).toBe(10);
		expect(stateAfter?.isMoving).toBe(true);
	});

	it("speedFactor가 있는 신규 열차 생성 시 speedFactor가 저장된다", () => {
		const withSpeedFactor: InterpolatedTrain = { ...MOCK_TRAIN_DEPART, speedFactor: 0.9 };
		animator.setTargets([withSpeedFactor]);
		const state = animator.getTrainState("1001");
		expect(state?.speedFactor).toBe(0.9);
	});

	it("speedFactor 없는 신규 열차는 기본값 1.0으로 생성된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]);
		const state = animator.getTrainState("1001");
		expect(state?.speedFactor).toBe(1.0);
	});

	it("trainAdvanced+출발 시 speedFactor가 갱신된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발, toStationId=S00

		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
			speedFactor: 1.1,
		};
		animator.setTargets([departFromNext]);
		const state = animator.getTrainState("1001");
		expect(state?.speedFactor).toBe(1.1);
	});

	// ── Waypoint (경유지) 자동 전환 ────────────────────────────────────────────

	it("trainAdvanced+isDepart+progress<1 시 즉시 B→C 전환하고 pending은 비어있다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발, progress=0

		const state = animator.getTrainState("1001");
		if (state) state.progress = 0.1; // A→B 구간 10% 진행

		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);
		const stateAfter = animator.getTrainState("1001");

		// 즉시 B→C 전환: pending 필드는 모두 undefined
		expect(stateAfter?.pendingToX).toBeUndefined();
		expect(stateAfter?.pendingToY).toBeUndefined();
		expect(stateAfter?.pendingStationId).toBeUndefined();
		expect(stateAfter?.pendingToStationId).toBeUndefined();
		// toX는 C역 좌표로 즉시 전환
		expect(stateAfter?.toX).toBe(10);
		expect(stateAfter?.stationId).toBe("S00");
		expect(stateAfter?.toStationId).toBe("S_PREV");
	});

	it("trainAdvanced+isDepart 시 즉시 B→C 전환되어 progress=0, isMoving=true이다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발

		const state = animator.getTrainState("1001");
		if (state) state.progress = 0.1;

		// B역에서 출발 수신
		const departFromNext: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
		};
		animator.setTargets([departFromNext]);

		const stateAfter = animator.getTrainState("1001");
		// 즉시 B→C 전환 완료
		expect(stateAfter?.stationId).toBe("S00");
		expect(stateAfter?.toStationId).toBe("S_PREV");
		expect(stateAfter?.fromX).toBe(50); // B역
		expect(stateAfter?.toX).toBe(10); // C역
		expect(stateAfter?.currentX).toBe(50); // B역으로 스냅
		expect(stateAfter?.progress).toBe(0);
		expect(stateAfter?.isMoving).toBe(true);
		// pending 초기화
		expect(stateAfter?.pendingToX).toBeUndefined();
		expect(stateAfter?.pendingStationId).toBeUndefined();
	});

	it("trainAdvanced+도착 시 pending 필드가 모두 초기화된다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // S01 출발

		// waypoint 설정
		const state = animator.getTrainState("1001");
		if (state) {
			state.progress = 0.1;
			state.pendingToX = 10;
			state.pendingToY = 100;
			state.pendingStationId = "S00";
			state.pendingToStationId = "S_PREV";
		}

		// 도착 이벤트 수신 (trainAdvanced + !isDepart) → pending 초기화
		const arrivedAtNext: InterpolatedTrain = {
			...MOCK_TRAIN_ARRIVE,
			stationId: "S00",
			stationX: 50,
			stationY: 150,
			nextStationId: "S_PREV",
			nextX: 10,
			nextY: 100,
			status: "도착",
		};
		animator.setTargets([arrivedAtNext]);
		const stateAfter = animator.getTrainState("1001");

		expect(stateAfter?.pendingToX).toBeUndefined();
		expect(stateAfter?.pendingToY).toBeUndefined();
		expect(stateAfter?.pendingStationId).toBeUndefined();
		expect(stateAfter?.pendingToStationId).toBeUndefined();
		expect(stateAfter?.isMoving).toBe(false);
	});

	// ── 신규 열차 simProgress 기반 초기 배치 (시뮬레이션 텔레포트 방지) ─────

	it("simProgress 없는 신규 출발 열차는 progress=0, stationX/Y에서 시작한다", () => {
		animator.setTargets([MOCK_TRAIN_DEPART]); // simProgress 없음
		const state = animator.getTrainState("1001");
		expect(state?.progress).toBe(0);
		expect(state?.currentX).toBe(100); // stationX
		expect(state?.currentY).toBe(200); // stationY
	});

	it("simProgress=0.9인 신규 출발 열차는 구간의 90% 위치에서 시작한다", () => {
		const withSimProgress: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			simProgress: 0.9,
		};
		animator.setTargets([withSimProgress]);
		const state = animator.getTrainState("1001");

		expect(state?.progress).toBe(0.9);
		// easeInOut(0.9) = 1 - (-2*0.9+2)^2/2 = 1 - (0.2)^2/2 = 1 - 0.02 = 0.98
		// currentX = 100 + (50-100) * 0.98 = 100 - 49 = 51
		const t = 1 - (-2 * 0.9 + 2) ** 2 / 2;
		const expectedX = 100 + (50 - 100) * t;
		const expectedY = 200 + (150 - 200) * t;
		expect(state?.currentX).toBeCloseTo(expectedX, 5);
		expect(state?.currentY).toBeCloseTo(expectedY, 5);
		expect(state?.isMoving).toBe(true);
	});

	it("simProgress=0.5인 신규 출발 열차는 구간의 50% 위치에서 시작한다", () => {
		const withSimProgress: InterpolatedTrain = {
			...MOCK_TRAIN_DEPART,
			simProgress: 0.5,
		};
		animator.setTargets([withSimProgress]);
		const state = animator.getTrainState("1001");

		expect(state?.progress).toBe(0.5);
		// easeInOut(0.5) = 0.5 (중간점)
		// currentX = 100 + (50-100) * 0.5 = 75
		const t = easeInOut(0.5);
		const expectedX = 100 + (50 - 100) * t;
		const expectedY = 200 + (150 - 200) * t;
		expect(state?.currentX).toBeCloseTo(expectedX, 5);
		expect(state?.currentY).toBeCloseTo(expectedY, 5);
	});

	it("simProgress가 있어도 도착/진입 신규 열차는 stationX/Y에 배치된다", () => {
		const arriveWithSim: InterpolatedTrain = {
			...MOCK_TRAIN_ARRIVE,
			simProgress: 0.9, // 무시되어야 함
		};
		animator.setTargets([arriveWithSim]);
		const state = animator.getTrainState("1001");
		expect(state?.progress).toBe(0); // isDepart=false → simP=0
		expect(state?.currentX).toBe(100); // stationX
		expect(state?.currentY).toBe(200); // stationY
		expect(state?.isMoving).toBe(false);
	});

	// ── fade-out / fade-in ─────────────────────────────────────────────────────

	it("사라진 열차는 setTargets 후 즉시 삭제되지 않고 fade-out 상태가 된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		animator.setTargets([]);
		expect(animator.count).toBe(1);
		const state = animator.getTrainState("1001");
		expect(state?.fadeOutStartedAt).toBeDefined();
	});

	it("fade-out 완료 후 열차가 삭제된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		animator.setTargets([]);

		const state = animator.getTrainState("1001");
		// fade-out 시작 시각을 과거로 조정하여 완료 시뮬레이션
		if (state) {
			state.fadeOutStartedAt = performance.now() - 1600; // TRAIN_FADEOUT_MS(1500) 초과
		}

		animator.update();

		expect(animator.count).toBe(0);
		expect(animator.getTrainState("1001")).toBeUndefined();
	});

	it("fade-out 중 복귀하면 fade-out이 취소된다", () => {
		animator.setTargets([MOCK_TRAIN_ARRIVE]);
		animator.setTargets([]); // fade-out 시작

		const stateFading = animator.getTrainState("1001");
		expect(stateFading?.fadeOutStartedAt).toBeDefined();

		animator.setTargets([MOCK_TRAIN_ARRIVE]); // 같은 열차 복귀
		const stateRevived = animator.getTrainState("1001");
		expect(stateRevived?.fadeOutStartedAt).toBeUndefined();
		expect(animator.count).toBe(1);
	});
});
