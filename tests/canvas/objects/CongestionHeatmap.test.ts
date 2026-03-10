import { describe, expect, it } from "vitest";
import { computeLinkCongestion, congestionColor } from "@/canvas/objects/CongestionHeatmap";
import type { StationLink } from "@/types/station";
import type { AnimatedTrainState } from "@/types/train";

function makeTrain(
	trainNo: string,
	fromStationId: string,
	toStationId: string,
): AnimatedTrainState {
	return {
		trainNo,
		line: 1,
		direction: "상행",
		startX: 0,
		startY: 0,
		targetX: 0,
		targetY: 0,
		currentX: 0,
		currentY: 0,
		startTime: 0,
		duration: 0,
		fromStationId,
		toStationId,
		path: [{ x: 0, y: 0 }],
		pathCumulativeDist: [0],
	};
}

describe("CongestionHeatmap", () => {
	describe("computeLinkCongestion", () => {
		const links: StationLink[] = [
			{ source: "A", target: "B", line: 1 },
			{ source: "B", target: "C", line: 1 },
		];

		it("열차가 있는 구간의 혼잡도를 정확히 집계한다", () => {
			const trains = [
				makeTrain("T1", "A", "B"),
				makeTrain("T2", "A", "B"),
				makeTrain("T3", "B", "C"),
			];

			const result = computeLinkCongestion(links, trains);

			expect(result.get("A-B")).toBe(2);
			expect(result.get("B-C")).toBe(1);
		});

		it("방향이 반대여도 동일 구간으로 매칭한다", () => {
			// B→A 방향 열차도 A-B 구간으로 집계
			const trains = [makeTrain("T1", "B", "A")];

			const result = computeLinkCongestion(links, trains);

			expect(result.get("A-B")).toBe(1);
		});

		it("유효하지 않은 구간의 열차는 무시한다", () => {
			const trains = [makeTrain("T1", "X", "Y")];

			const result = computeLinkCongestion(links, trains);

			expect(result.size).toBe(0);
		});

		it("열차가 없으면 빈 맵을 반환한다", () => {
			const result = computeLinkCongestion(links, []);
			expect(result.size).toBe(0);
		});
	});

	describe("congestionColor", () => {
		it("0대: 진파랑을 반환한다", () => {
			expect(congestionColor(0)).toBe(0x1a3a5c);
		});

		it("1대: 파랑을 반환한다", () => {
			expect(congestionColor(1)).toBe(0x2196f3);
		});

		it("2대: 노랑을 반환한다", () => {
			expect(congestionColor(2)).toBe(0xffc107);
		});

		it("3대 이상: 빨강을 반환한다", () => {
			expect(congestionColor(3)).toBe(0xf44336);
			expect(congestionColor(10)).toBe(0xf44336);
		});
	});
});
