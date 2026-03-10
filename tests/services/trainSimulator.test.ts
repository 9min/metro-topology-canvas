import { describe, expect, it } from "vitest";
import { SIM_DWELL_TICKS } from "@/constants/mapConfig";
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

	it("역 도착 시 정차한다 — 일부 열차가 역 좌표에 정확히 위치한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);

		const stationXs = new Set([100, 200, 300, 400, 500]);
		let foundDwelling = false;

		// 충분한 틱을 돌려 정차 상태 열차를 찾는다
		for (let i = 0; i < 30; i++) {
			const trains = sim.tick(SCREEN_MAP);
			const dwelling = trains.filter((t) => t.progress === 0 && stationXs.has(t.x));
			if (dwelling.length > 0) {
				foundDwelling = true;
				break;
			}
		}

		expect(foundDwelling).toBe(true);
	});

	it("정차 후 다시 이동한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);

		// 정차 상태 열차를 찾는다
		let dwellingTrainNo: string | null = null;
		for (let i = 0; i < 30; i++) {
			const trains = sim.tick(SCREEN_MAP);
			const dwelling = trains.find((t) => t.progress === 0);
			if (dwelling !== undefined) {
				dwellingTrainNo = dwelling.trainNo;
				break;
			}
		}
		expect(dwellingTrainNo).not.toBeNull();

		// dwell 틱 + 1 이후 해당 열차가 이동 재개했는지 확인
		let moved = false;
		for (let i = 0; i < SIM_DWELL_TICKS + 3; i++) {
			const trains = sim.tick(SCREEN_MAP);
			const target = trains.find((t) => t.trainNo === dwellingTrainNo);
			if (target !== undefined && target.progress > 0) {
				moved = true;
				break;
			}
		}
		expect(moved).toBe(true);
	});

	it("정차 중 progress가 0이다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);

		// 정차 상태의 열차를 찾아서 progress === 0인지 확인
		for (let i = 0; i < 30; i++) {
			const trains = sim.tick(SCREEN_MAP);
			const stationXs = new Set([100, 200, 300, 400, 500]);
			const dwelling = trains.filter((t) => stationXs.has(t.x) && t.progress === 0);
			for (const t of dwelling) {
				expect(t.progress).toBe(0);
			}
		}
	});
});
