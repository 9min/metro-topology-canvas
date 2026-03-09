import { describe, expect, it } from "vitest";
import { TrainSimulator } from "@/services/trainSimulator";
import type { ScreenCoord } from "@/types/map";
import type { StationLink } from "@/types/station";

const LINKS: StationLink[] = [
	{ source: "S1", target: "S2", line: 1 },
	{ source: "S2", target: "S3", line: 1 },
	{ source: "S3", target: "S4", line: 1 },
	{ source: "S4", target: "S5", line: 1 },
];

const SCREEN_MAP: Map<string, ScreenCoord> = new Map([
	["S1", { x: 100, y: 100 }],
	["S2", { x: 200, y: 100 }],
	["S3", { x: 300, y: 100 }],
	["S4", { x: 400, y: 100 }],
	["S5", { x: 500, y: 100 }],
]);

describe("TrainSimulator", () => {
	it("init 후 tick하면 보간된 열차 좌표를 반환한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const trains = sim.tick(SCREEN_MAP);
		expect(trains.length).toBeGreaterThan(0);
		for (const t of trains) {
			expect(t.x).toBeGreaterThanOrEqual(100);
			expect(t.x).toBeLessThanOrEqual(500);
		}
	});

	it("trainNo가 SIM- 접두사를 가진다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const trains = sim.tick(SCREEN_MAP);
		for (const t of trains) {
			expect(t.trainNo.startsWith("SIM-")).toBe(true);
		}
	});

	it("여러 틱에 걸쳐 열차가 이동한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);

		const first = sim.tick(SCREEN_MAP);
		const firstPositions = first.map((t) => `${t.x},${t.y}`);

		for (let i = 0; i < 10; i++) {
			sim.tick(SCREEN_MAP);
		}
		const later = sim.tick(SCREEN_MAP);
		const laterPositions = later.map((t) => `${t.x},${t.y}`);

		const changed = laterPositions.some((pos, i) => pos !== firstPositions[i]);
		expect(changed).toBe(true);
	});

	it("fromStationId와 toStationId가 유효하다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const trains = sim.tick(SCREEN_MAP);
		for (const t of trains) {
			expect(SCREEN_MAP.has(t.fromStationId)).toBe(true);
			expect(SCREEN_MAP.has(t.toStationId)).toBe(true);
		}
	});

	it("progress가 0~1 범위이다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		for (let i = 0; i < 20; i++) {
			const trains = sim.tick(SCREEN_MAP);
			for (const t of trains) {
				expect(t.progress).toBeGreaterThanOrEqual(0);
				expect(t.progress).toBeLessThan(1);
			}
		}
	});
});
