import { describe, expect, it } from "vitest";
import {
	drawTrails,
	pruneTrails,
	type TrailQueue,
	updateTrailQueues,
} from "@/canvas/objects/TrainTrail";
import type { AnimatedTrainState } from "@/types/train";

function makeTrain(trainNo: string, line: number, x: number, y: number): AnimatedTrainState {
	return {
		trainNo,
		line,
		direction: "상행",
		startX: x,
		startY: y,
		targetX: x,
		targetY: y,
		currentX: x,
		currentY: y,
		startTime: 0,
		duration: 0,
		fromStationId: "s1",
		toStationId: "s2",
		path: [{ x, y }],
		pathCumulativeDist: [0],
	};
}

describe("TrainTrail", () => {
	describe("updateTrailQueues", () => {
		it("frameSkip 조건에 맞을 때만 포인트를 추가한다", () => {
			const trailMap = new Map<string, TrailQueue>();
			const trains = [makeTrain("T1", 1, 100, 200)];

			// frameCount=0 → 0 % 4 === 0 → 추가
			updateTrailQueues(trailMap, trains, 0, 4, 15);
			expect(trailMap.get("T1")?.points).toHaveLength(1);

			// frameCount=1 → 1 % 4 !== 0 → 추가하지 않음
			updateTrailQueues(trailMap, trains, 1, 4, 15);
			expect(trailMap.get("T1")?.points).toHaveLength(1);

			// frameCount=4 → 4 % 4 === 0 → 추가
			updateTrailQueues(trailMap, trains, 4, 4, 15);
			expect(trailMap.get("T1")?.points).toHaveLength(2);
		});

		it("최대 포인트 수를 초과하면 오래된 포인트를 제거한다", () => {
			const trailMap = new Map<string, TrailQueue>();
			const maxPoints = 3;

			for (let i = 0; i < 5; i++) {
				const trains = [makeTrain("T1", 1, i * 10, i * 10)];
				updateTrailQueues(trailMap, trains, i * 4, 4, maxPoints);
			}

			const queue = trailMap.get("T1");
			expect(queue?.points).toHaveLength(maxPoints);
			// 가장 오래된 포인트(0,0)는 제거되고 최근 3개만 남아야 한다
			expect(queue?.points[0]).toEqual({ x: 20, y: 20 });
		});

		it("신규 열차에 대해 큐를 자동 생성한다", () => {
			const trailMap = new Map<string, TrailQueue>();
			const trains = [makeTrain("NEW", 2, 50, 60)];

			updateTrailQueues(trailMap, trains, 0, 1, 15);
			expect(trailMap.has("NEW")).toBe(true);
			expect(trailMap.get("NEW")?.line).toBe(2);
		});
	});

	describe("pruneTrails", () => {
		it("활성 열차가 아닌 트레일 큐를 제거한다", () => {
			const trailMap = new Map<string, TrailQueue>();
			trailMap.set("T1", { points: [{ x: 0, y: 0 }], line: 1 });
			trailMap.set("T2", { points: [{ x: 10, y: 10 }], line: 2 });
			trailMap.set("T3", { points: [{ x: 20, y: 20 }], line: 3 });

			const activeNos = new Set(["T1", "T3"]);
			pruneTrails(trailMap, activeNos);

			expect(trailMap.has("T1")).toBe(true);
			expect(trailMap.has("T2")).toBe(false);
			expect(trailMap.has("T3")).toBe(true);
		});
	});

	describe("drawTrails", () => {
		it("비활성 노선의 트레일은 그리지 않는다", () => {
			const trailMap = new Map<string, TrailQueue>();
			// 선분 렌더링이므로 최소 2포인트 필요
			trailMap.set("T1", {
				points: [
					{ x: 0, y: 0 },
					{ x: 5, y: 5 },
				],
				line: 1,
			});
			trailMap.set("T2", {
				points: [
					{ x: 10, y: 10 },
					{ x: 15, y: 15 },
				],
				line: 2,
			});

			// mock Graphics — moveTo/lineTo/stroke 호출 수 확인
			let strokeCallCount = 0;
			const mockGfx = {
				clear: () => mockGfx,
				moveTo: () => mockGfx,
				lineTo: () => mockGfx,
				stroke: () => {
					strokeCallCount++;
					return mockGfx;
				},
			};

			// 1호선만 활성
			const activeLines = new Set([1]);
			// biome-ignore lint/suspicious/noExplicitAny: 테스트용 mock
			drawTrails({} as any, mockGfx as any, trailMap, activeLines);

			// 1호선 트레일만 그려야 한다 (2포인트 → 1세그먼트)
			expect(strokeCallCount).toBe(1);
		});

		it("포인트가 1개 이하이면 선분을 그리지 않는다", () => {
			const trailMap = new Map<string, TrailQueue>();
			trailMap.set("T1", { points: [{ x: 0, y: 0 }], line: 1 });

			let strokeCallCount = 0;
			const mockGfx = {
				clear: () => mockGfx,
				moveTo: () => mockGfx,
				lineTo: () => mockGfx,
				stroke: () => {
					strokeCallCount++;
					return mockGfx;
				},
			};

			const activeLines = new Set([1]);
			// biome-ignore lint/suspicious/noExplicitAny: 테스트용 mock
			drawTrails({} as any, mockGfx as any, trailMap, activeLines);

			expect(strokeCallCount).toBe(0);
		});
	});
});
