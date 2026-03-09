import { describe, expect, it } from "vitest";
import { TrainSimulator } from "@/services/trainSimulator";
import type { Station, StationLink } from "@/types/station";

const STATIONS: Station[] = [
	{ id: "S1", name: "A역", line: 1, x: 127.0, y: 37.5 },
	{ id: "S2", name: "B역", line: 1, x: 127.01, y: 37.51 },
	{ id: "S3", name: "C역", line: 1, x: 127.02, y: 37.52 },
	{ id: "S4", name: "D역", line: 1, x: 127.03, y: 37.53 },
	{ id: "S5", name: "E역", line: 1, x: 127.04, y: 37.54 },
];

const LINKS: StationLink[] = [
	{ source: "S1", target: "S2", line: 1 },
	{ source: "S2", target: "S3", line: 1 },
	{ source: "S3", target: "S4", line: 1 },
	{ source: "S4", target: "S5", line: 1 },
];

describe("TrainSimulator", () => {
	it("init 후 tick하면 열차 위치를 반환한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const positions = sim.tick();
		expect(positions.length).toBeGreaterThan(0);
	});

	it("모든 열차의 stationId가 유효한 역이다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const positions = sim.tick();
		const validIds = new Set(STATIONS.map((s) => s.id));
		for (const pos of positions) {
			expect(validIds.has(pos.stationId)).toBe(true);
		}
	});

	it("trainNo가 SIM- 접두사를 가진다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const positions = sim.tick();
		for (const pos of positions) {
			expect(pos.trainNo.startsWith("SIM-")).toBe(true);
		}
	});

	it("여러 틱에 걸쳐 열차가 이동한다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);

		const firstTick = sim.tick();
		const firstStations = firstTick.map((p) => p.stationId);

		// 여러 번 틱하면 열차가 이동해야 한다
		for (let i = 0; i < 10; i++) {
			sim.tick();
		}
		const laterTick = sim.tick();
		const laterStations = laterTick.map((p) => p.stationId);

		// 최소 하나의 열차는 다른 역에 있어야 한다
		const changed = laterStations.some((s, i) => s !== firstStations[i]);
		expect(changed).toBe(true);
	});

	it("status가 진입/도착/출발 중 하나이다", () => {
		const sim = new TrainSimulator();
		sim.init(LINKS);
		const positions = sim.tick();
		const validStatuses = new Set(["진입", "도착", "출발"]);
		for (const pos of positions) {
			expect(validStatuses.has(pos.status)).toBe(true);
		}
	});
});
