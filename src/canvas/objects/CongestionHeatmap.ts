import type { Graphics } from "pixi.js";
import { CONGESTION_LINE_WIDTH_FACTOR, LINE_WIDTH } from "@/constants/mapConfig";
import type { ScreenCoord } from "@/types/map";
import type { StationLink } from "@/types/station";
import type { AnimatedTrainState } from "@/types/train";

/** link의 고유 키를 생성한다 (방향 무관 — 정렬) */
function linkKey(source: string, target: string): string {
	return source < target ? `${source}-${target}` : `${target}-${source}`;
}

/**
 * 각 구간(link)에 있는 열차 수를 집계한다.
 * 열차의 fromStation/toStation과 link의 source/target을 방향 무관으로 매칭한다.
 */
export function computeLinkCongestion(
	links: StationLink[],
	animatedTrains: AnimatedTrainState[],
): Map<string, number> {
	// 유효한 link 키 집합을 만든다
	const validLinks = new Set<string>();
	for (const link of links) {
		validLinks.add(linkKey(link.source, link.target));
	}

	const congestion = new Map<string, number>();

	for (const train of animatedTrains) {
		const key = linkKey(train.fromStationId, train.toStationId);
		if (!validLinks.has(key)) continue;
		congestion.set(key, (congestion.get(key) ?? 0) + 1);
	}

	return congestion;
}

/**
 * 혼잡도에 따른 색상을 반환한다.
 * 0대: 진파랑(0x1a3a5c), 1대: 파랑(0x2196f3), 2대: 노랑(0xffc107), 3대+: 빨강(0xf44336)
 */
export function congestionColor(count: number): number {
	if (count <= 0) return 0x1a3a5c;
	if (count === 1) return 0x2196f3;
	if (count === 2) return 0xffc107;
	return 0xf44336;
}

/**
 * 혼잡도 히트맵을 단일 Graphics에 그린다.
 * 열차가 있는 구간만 두꺼운 반투명 선으로 표시한다.
 */
export function drawCongestionHeatmap(
	heatmapGraphics: Graphics,
	links: StationLink[],
	stationScreenMap: Map<string, ScreenCoord>,
	congestionMap: Map<string, number>,
): void {
	heatmapGraphics.clear();

	for (const link of links) {
		const key = linkKey(link.source, link.target);
		const count = congestionMap.get(key);
		if (count === undefined || count <= 0) continue;

		const from = stationScreenMap.get(link.source);
		const to = stationScreenMap.get(link.target);
		if (from === undefined || to === undefined) continue;

		const color = congestionColor(count);
		const width = LINE_WIDTH * CONGESTION_LINE_WIDTH_FACTOR;

		heatmapGraphics.moveTo(from.x, from.y).lineTo(to.x, to.y).stroke({ width, color, alpha: 0.5 });
	}
}
