import {
	SIM_DWELL_TICKS,
	SIM_TERMINAL_DWELL_TICKS,
	SIMULATION_TRAINS_PER_LINE,
} from "@/constants/mapConfig";
import type { ScreenCoord } from "@/types/map";
import type { StationLink } from "@/types/station";
import type { InterpolatedTrain } from "@/types/train";
import { lerp } from "@/utils/trainInterpolation";

/** 시뮬레이션 열차 내부 상태 */
interface SimTrain {
	trainNo: string;
	line: number;
	direction: "상행" | "하행";
	/** 현재 출발역 인덱스 (route 배열 내 위치) */
	segmentIdx: number;
	/** 현재 구간 내 진행률 (0.0 ~ 1.0) */
	progress: number;
	/** 정차 잔여 틱 수. 0이면 이동 중, >0이면 역에 정차 중 */
	dwellRemaining: number;
	/** 열차별 속도 배율 (0.85 ~ 1.15). 동기화 방지용 */
	speedFactor: number;
}

/** 노선별 경로 (역 ID 배열) */
type RouteMap = Map<number, string[]>;

/** 틱당 진행률 증가량 — 1.5배속 (약 2틱에 한 역 구간 이동) */
const PROGRESS_PER_TICK = 0.525;

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
	// 순환 노선 닫기: 마지막 역→첫 역 구간 추가
	if (route.length > 1) {
		route.push(route[0] as string);
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
 * tick()마다 연속 좌표로 보간된 InterpolatedTrain[]을 반환한다.
 */
export class TrainSimulator {
	private trains: SimTrain[] = [];
	private routes: RouteMap = new Map();

	/** 링크 데이터로 경로 구성 및 열차 초기 배치 */
	init(links: StationLink[]): void {
		this.routes = buildRoutes(links);
		this.trains = [];
		let trainSeq = 1;

		for (const [line, route] of this.routes) {
			if (route.length < 2) continue;
			const segmentCount = route.length - 1;
			const count = SIMULATION_TRAINS_PER_LINE[line] ?? 6;
			const halfCount = Math.ceil(count / 2);

			// 상행 열차 배치
			for (let i = 0; i < halfCount; i++) {
				const totalProgress = (i / halfCount) * segmentCount;
				this.trains.push({
					trainNo: `gm-${String(trainSeq++).padStart(3, "0")}`,
					line,
					direction: "상행",
					segmentIdx: Math.floor(totalProgress) % segmentCount,
					progress: Math.min((totalProgress % 1) + Math.random() * 0.1, 0.99),
					dwellRemaining: Math.floor(Math.random() * (SIM_DWELL_TICKS + 1)),
					speedFactor: 0.85 + Math.random() * 0.3,
				});
			}

			// 하행 열차 배치 (오프셋으로 겹침 방지)
			const downCount = count - halfCount;
			for (let i = 0; i < downCount; i++) {
				const totalProgress = ((i + 0.5) / downCount) * segmentCount;
				this.trains.push({
					trainNo: `gm-${String(trainSeq++).padStart(3, "0")}`,
					line,
					direction: "하행",
					segmentIdx: Math.floor(totalProgress) % segmentCount,
					progress: Math.min((totalProgress % 1) + Math.random() * 0.1, 0.99),
					dwellRemaining: Math.floor(Math.random() * (SIM_DWELL_TICKS + 1)),
					speedFactor: 0.85 + Math.random() * 0.3,
				});
			}
		}
	}

	/** 한 틱 진행: 위치를 전진시키고 화면 좌표로 보간된 결과를 반환한다 */
	tick(stationScreenMap: Map<string, ScreenCoord>): InterpolatedTrain[] {
		const results: InterpolatedTrain[] = [];

		for (const train of this.trains) {
			const route = this.routes.get(train.line);
			if (route === undefined || route.length < 2) continue;

			// 진행률 전진
			this.advanceTrain(train, route);

			// 현재 구간의 양 끝 역 화면 좌표로 보간
			const result = this.interpolate(train, route, stationScreenMap);
			if (result !== null) results.push(result);
		}

		return results;
	}

	/** 열차 진행률을 전진시키고, 구간 끝에 도달하면 다음 구간으로 넘긴다 */
	private advanceTrain(train: SimTrain, route: string[]): void {
		const segmentCount = route.length - 1;

		// 정차 중이면 카운터만 감소
		if (train.dwellRemaining > 0) {
			train.dwellRemaining -= 1;
			return;
		}

		train.progress += PROGRESS_PER_TICK * train.speedFactor;

		if (train.progress >= 1) {
			train.progress = 0; // 초과분 버림 — 역에서 정확히 0 시작
			const isTerminal = this.moveToNextSegment(train, segmentCount);
			train.dwellRemaining = isTerminal ? SIM_TERMINAL_DWELL_TICKS : SIM_DWELL_TICKS;
		}
	}

	/** 다음 구간으로 이동 (종점 반전 또는 순환). 종점 방향 전환 시 true 반환 */
	private moveToNextSegment(train: SimTrain, segmentCount: number): boolean {
		const isCircular = train.line === 2;

		if (train.direction === "상행") {
			train.segmentIdx++;
			if (train.segmentIdx >= segmentCount) {
				if (isCircular) {
					train.segmentIdx = 0;
					return false;
				}
				train.segmentIdx = segmentCount - 1;
				train.direction = "하행";
				return true;
			}
		} else {
			train.segmentIdx--;
			if (train.segmentIdx < 0) {
				if (isCircular) {
					train.segmentIdx = segmentCount - 1;
					return false;
				}
				train.segmentIdx = 0;
				train.direction = "상행";
				return true;
			}
		}
		return false;
	}

	/** 현재 구간 내 progress로 화면 좌표를 보간한다 */
	private interpolate(
		train: SimTrain,
		route: string[],
		screenMap: Map<string, ScreenCoord>,
	): InterpolatedTrain | null {
		// 상행: route[segmentIdx] → route[segmentIdx+1]
		// 하행: route[segmentIdx+1] → route[segmentIdx]
		const fromIdx = train.direction === "상행" ? train.segmentIdx : train.segmentIdx + 1;
		const toIdx = train.direction === "상행" ? train.segmentIdx + 1 : train.segmentIdx;

		const fromId = route[fromIdx];
		const toId = route[toIdx];
		if (fromId === undefined || toId === undefined) return null;

		const fromCoord = screenMap.get(fromId);
		const toCoord = screenMap.get(toId);
		if (fromCoord === undefined || toCoord === undefined) return null;

		return {
			trainNo: train.trainNo,
			line: train.line,
			x: lerp(fromCoord.x, toCoord.x, train.progress),
			y: lerp(fromCoord.y, toCoord.y, train.progress),
			stationX: fromCoord.x,
			stationY: fromCoord.y,
			direction: train.direction,
			progress: train.progress,
			fromStationId: fromId,
			toStationId: toId,
			trackAngle: Math.atan2(toCoord.y - fromCoord.y, toCoord.x - fromCoord.x),
		};
	}

	/** 현재 시뮬레이션 열차 수 */
	get count(): number {
		return this.trains.length;
	}
}
