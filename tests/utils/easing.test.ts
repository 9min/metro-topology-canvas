import { describe, expect, it } from "vitest";
import { easeInOutCubic } from "@/utils/easing";

describe("easeInOutCubic", () => {
	it("t=0이면 0을 반환한다", () => {
		expect(easeInOutCubic(0)).toBe(0);
	});

	it("t=1이면 1을 반환한다", () => {
		expect(easeInOutCubic(1)).toBe(1);
	});

	it("t=0.5이면 0.5를 반환한다", () => {
		expect(easeInOutCubic(0.5)).toBe(0.5);
	});

	it("0~0.5 구간은 느리게 시작한다 (0.25에서 0.5 미만)", () => {
		expect(easeInOutCubic(0.25)).toBeLessThan(0.25);
	});

	it("0.5~1 구간은 느리게 끝난다 (0.75에서 0.75 초과)", () => {
		expect(easeInOutCubic(0.75)).toBeGreaterThan(0.75);
	});
});
