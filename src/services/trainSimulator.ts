import { SIMULATION_TRAINS_PER_LINE } from "@/constants/mapConfig";
import type { StationLink } from "@/types/station";
import type { TrainPosition } from "@/types/train";

/** 시뮬레이션 열차 내부 상태 */
interface SimTrain {
	trainNo: string;
	line: number;
	direction: "상행" | "하행";
	/** 현재 경로 인덱스 (route 배열 내 위치) */
	routeIdx: number;
	/** 상태 전이 순서: 0=출발, 1=진입, 2=도착 */
	phase: number;
}

/** 노선별 경로 (역 ID 배열) */
type RouteMap = Map<number, string[]>;

/** 링크 데이터로부터 인접 리스트를 구성한다 */
function buildAdjacency(lineLinks: StationLink[]): Map<string, string[]> {
	const adj = new Map<string, string[]>();
	for (const link of lineLinks) {
		if (!adj.has(link.source)) adj.set(link.source, []);
		if (!adj.has(link.target)) adj.set(link.target, []);
		adj.get(link.source)?.push(link.target);
		adj.get(link.target)?.push(link.source);
	}
	return adj;
}

/** 순환선(2호선) 경로를 구성한다 */
function buildCircularRoute(lineLinks: StationLink[]): string[] {
	const route: string[] = [lineLinks[0]?.source ?? ""];
	const visited = new Set<string>(route);
	for (const link of lineLinks) {
		if (!visited.has(link.target)) {
			route.push(link.target);
			visited.add(link.target);
		}
	}
	return route;
}

/** 인접 리스트에서 종점(차수 1)을 찾는다 */
function findTerminal(adj: Map<string, string[]>, fallback: string): string {
	for (const [id, neighbors] of adj) {
		if (neighbors.length === 1) return id;
	}
	return fallback;
}

/** 시작점부터 BFS로 선형 경로를 구성한다 */
function buildLinearRoute(adj: Map<string, string[]>, startId: string): string[] {
	const route: string[] = [startId];
	const visited = new Set<string>([startId]);
	let current = startId;

	while (true) {
		const neighbors = adj.get(current);
		if (neighbors === undefined) break;
		const next = neighbors.find((n) => !visited.has(n));
		if (next === undefined) break;
		route.push(next);
		visited.add(next);
		current = next;
	}
	return route;
}

/** links 데이터로부터 노선별 역 경로를 구성한다 */
function buildRoutes(links: StationLink[]): RouteMap {
	const routes: RouteMap = new Map();

	for (let line = 1; line <= 9; line++) {
		const lineLinks = links.filter((l) => l.line === line);
		if (lineLinks.length === 0) continue;

		if (line === 2) {
			routes.set(line, buildCircularRoute(lineLinks));
			continue;
		}

		const adj = buildAdjacency(lineLinks);
		const startId = findTerminal(adj, lineLinks[0]?.source ?? "");
		routes.set(line, buildLinearRoute(adj, startId));
	}

	return routes;
}

/**
 * 시뮬레이션 열차 엔진.
 * 초기화 시 각 노선에 열차를 균등 배치하고,
 * tick()마다 상태를 전이시켜 TrainPosition[]을 생성한다.
 */
export class TrainSimulator {
	private trains: SimTrain[] = [];
	private routes: RouteMap = new Map();

	/** 링크 데이터로 경로 구성 및 열차 초기 배치 */
	init(links: StationLink[]): void {
		this.routes = buildRoutes(links);
		this.trains = [];

		for (const [line, route] of this.routes) {
			const count = SIMULATION_TRAINS_PER_LINE[line] ?? 6;
			const halfCount = Math.ceil(count / 2);
			const spacing = Math.max(1, Math.floor(route.length / halfCount));

			// 상행 열차 배치
			for (let i = 0; i < halfCount; i++) {
				const idx = (i * spacing) % route.length;
				this.trains.push({
					trainNo: `SIM-L${line}-U${i}`,
					line,
					direction: "상행",
					routeIdx: idx,
					phase: (i * 7) % 3, // 위상 분산
				});
			}

			// 하행 열차 배치 (오프셋으로 겹침 방지)
			const downCount = count - halfCount;
			for (let i = 0; i < downCount; i++) {
				const idx = (i * spacing + Math.floor(spacing / 2)) % route.length;
				this.trains.push({
					trainNo: `SIM-L${line}-D${i}`,
					line,
					direction: "하행",
					routeIdx: idx,
					phase: (i * 5 + 1) % 3,
				});
			}
		}
	}

	/** 한 틱 진행: 상태 전이 후 TrainPosition[] 반환 */
	tick(): TrainPosition[] {
		const positions: TrainPosition[] = [];

		for (const train of this.trains) {
			const route = this.routes.get(train.line);
			if (route === undefined || route.length === 0) continue;

			// 상태 전이: 출발(0) → 진입(1) → 도착(2) → 출발(0) + 이동
			train.phase = (train.phase + 1) % 3;

			if (train.phase === 0) {
				// 출발 → 다음 역으로 이동
				this.advanceTrain(train, route);
			}

			const stationId = route[train.routeIdx];
			if (stationId === undefined) continue;

			const statusMap = ["출발", "진입", "도착"] as const;

			positions.push({
				trainNo: train.trainNo,
				stationId,
				stationName: "",
				line: train.line,
				direction: train.direction,
				status: statusMap[train.phase] ?? "도착",
			});
		}

		return positions;
	}

	/** 열차를 경로상 다음 역으로 이동시킨다 */
	private advanceTrain(train: SimTrain, route: string[]): void {
		const isCircular = train.line === 2;

		if (train.direction === "상행") {
			train.routeIdx++;
			if (train.routeIdx >= route.length) {
				if (isCircular) {
					train.routeIdx = 0;
				} else {
					train.routeIdx = route.length - 2;
					train.direction = "하행";
				}
			}
		} else {
			train.routeIdx--;
			if (train.routeIdx < 0) {
				if (isCircular) {
					train.routeIdx = route.length - 1;
				} else {
					train.routeIdx = 1;
					train.direction = "상행";
				}
			}
		}
	}
}
