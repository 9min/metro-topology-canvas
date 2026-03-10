import { describe, expect, it } from "vitest";
import { isOperatingHours, msUntilOperatingStart } from "@/utils/operatingHours";

describe("isOperatingHours", () => {
	it("05:30은 운행 시간이다 (운행 시작)", () => {
		expect(isOperatingHours(new Date("2026-03-09T05:30:00"))).toBe(true);
	});

	it("06:00은 운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T06:00:00"))).toBe(true);
	});

	it("12:00은 운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T12:00:00"))).toBe(true);
	});

	it("00:30은 운행 시간이다 (익일 01:00 전)", () => {
		expect(isOperatingHours(new Date("2026-03-09T00:30:00"))).toBe(true);
	});

	it("23:59은 운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T23:59:00"))).toBe(true);
	});

	it("01:00은 비운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T01:00:00"))).toBe(false);
	});

	it("03:00은 비운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T03:00:00"))).toBe(false);
	});

	it("05:00은 비운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T05:00:00"))).toBe(false);
	});

	it("05:29은 비운행 시간이다", () => {
		expect(isOperatingHours(new Date("2026-03-09T05:29:00"))).toBe(false);
	});
});

describe("msUntilOperatingStart", () => {
	it("운행 시간이면 0을 반환한다", () => {
		expect(msUntilOperatingStart(new Date("2026-03-09T12:00:00"))).toBe(0);
	});

	it("03:00이면 05:30까지 2시간 30분(9000000ms)을 반환한다", () => {
		expect(msUntilOperatingStart(new Date("2026-03-09T03:00:00"))).toBe(2.5 * 60 * 60 * 1000);
	});

	it("01:00이면 05:30까지 4시간 30분을 반환한다", () => {
		expect(msUntilOperatingStart(new Date("2026-03-09T01:00:00"))).toBe(4.5 * 60 * 60 * 1000);
	});

	it("05:00이면 05:30까지 30분을 반환한다", () => {
		expect(msUntilOperatingStart(new Date("2026-03-09T05:00:00"))).toBe(30 * 60 * 1000);
	});
});
