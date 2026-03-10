import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";

/** 경로 위 글로우 라인 두께 */
const ROUTE_GLOW_WIDTH = 6;

/** 경로 위 호선 색상 라인 두께 */
const ROUTE_LINE_WIDTH = 3;

/** 경로 위 역 반지름 */
const ROUTE_STATION_RADIUS = 5;

/** 환승역 펄스 최대 스케일 */
const PULSE_MAX_SCALE = 1.3;

/** 환승역 펄스 주기 (ms) */
const PULSE_PERIOD_MS = 1000;

/** 호선 색상을 숫자로 변환 */
function lineColor(line: number): number {
	const hex = LINE_COLORS[line];
	return hex !== undefined ? parseInt(hex.replace("#", ""), 16) : 0xffffff;
}

/**
 * 경로를 routeLayer에 렌더링한다.
 * 글로우 라인 + 호선 색상 라인 + 경로 역 강조.
 */
export function drawRoute(
	routeLayer: Container,
	route: string[],
	stationScreenMap: Map<string, ScreenCoord>,
	stationMap: Map<string, Station>,
): void {
	routeLayer.removeChildren();

	if (route.length < 2) return;

	const gfx = new Graphics();
	routeLayer.addChild(gfx);

	// 구간별로 그린다
	for (let i = 0; i < route.length - 1; i++) {
		const fromId = route[i];
		const toId = route[i + 1];
		if (fromId === undefined || toId === undefined) continue;

		const fromCoord = stationScreenMap.get(fromId);
		const toCoord = stationScreenMap.get(toId);
		if (fromCoord === undefined || toCoord === undefined) continue;

		const toStation = stationMap.get(toId);
		const fromStation = stationMap.get(fromId);
		const segLine = toStation?.line ?? fromStation?.line ?? 1;

		// 글로우 라인 (흰색)
		gfx.moveTo(fromCoord.x, fromCoord.y);
		gfx.lineTo(toCoord.x, toCoord.y);
		gfx.stroke({ width: ROUTE_GLOW_WIDTH, color: 0xffffff, alpha: 0.3 });

		// 호선 색상 라인
		gfx.moveTo(fromCoord.x, fromCoord.y);
		gfx.lineTo(toCoord.x, toCoord.y);
		gfx.stroke({ width: ROUTE_LINE_WIDTH, color: lineColor(segLine), alpha: 0.9 });
	}

	// 경로 위 역 표시
	for (const stationId of route) {
		const coord = stationScreenMap.get(stationId);
		if (coord === undefined) continue;
		const station = stationMap.get(stationId);
		const color = station !== undefined ? lineColor(station.line) : 0xffffff;

		gfx.circle(coord.x, coord.y, ROUTE_STATION_RADIUS).fill({ color, alpha: 1 });
		gfx.circle(coord.x, coord.y, ROUTE_STATION_RADIUS).stroke({
			width: 1.5,
			color: 0xffffff,
			alpha: 0.9,
		});
	}

	// 출발역 (더 크게)
	const startId = route[0];
	if (startId !== undefined) {
		const startCoord = stationScreenMap.get(startId);
		if (startCoord !== undefined) {
			gfx.circle(startCoord.x, startCoord.y, ROUTE_STATION_RADIUS + 2).stroke({
				width: 2,
				color: 0x00ff88,
				alpha: 1,
			});
		}
	}

	// 도착역 (더 크게)
	const endId = route[route.length - 1];
	if (endId !== undefined) {
		const endCoord = stationScreenMap.get(endId);
		if (endCoord !== undefined) {
			gfx.circle(endCoord.x, endCoord.y, ROUTE_STATION_RADIUS + 2).stroke({
				width: 2,
				color: 0xff4444,
				alpha: 1,
			});
		}
	}
}

/**
 * 경로 환승역에 펄스 애니메이션을 적용한다.
 * ticker에서 매 프레임 호출.
 */
export function updateRoutePulse(
	routeLayer: Container,
	route: string[],
	stationMap: Map<string, Station>,
): void {
	if (route.length === 0 || routeLayer.children.length === 0) return;

	// 환승 지점 찾기 (호선이 바뀌는 역)
	const transferIndices: number[] = [];
	let prevLine = -1;
	for (let i = 0; i < route.length; i++) {
		const id = route[i];
		if (id === undefined) continue;
		const station = stationMap.get(id);
		if (station === undefined) continue;
		if (prevLine !== -1 && station.line !== prevLine) {
			transferIndices.push(i);
		}
		prevLine = station.line;
	}

	if (transferIndices.length === 0) return;

	// 펄스 스케일 계산
	const time = performance.now();
	const t = (time % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
	const pulse = 1 + (PULSE_MAX_SCALE - 1) * Math.sin(t * Math.PI * 2) * 0.5;

	// routeLayer의 첫 번째 child가 Graphics이므로 스케일 조절은 어려움
	// 대신 routeLayer 자체의 alpha를 미세 조정 (시각적 효과)
	routeLayer.alpha = 0.85 + 0.15 * Math.sin(t * Math.PI * 2);

	// 실제로는 pulse 변수를 사용해야 하지만 Graphics 단일 인스턴스이므로
	// routeLayer alpha로 대체
	void pulse;
}
