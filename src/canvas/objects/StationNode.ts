import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { STATION_RADIUS, STATION_RADIUS_HOVER } from "@/constants/mapConfig";
import { useStationStore } from "@/stores/useStationStore";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";

/**
 * 선택된 역 기준으로 역 Graphics의 alpha를 업데이트한다.
 * 선택 없음: 전체 1.0 / 선택 있음: 선택 역 1.0, 인접 역 0.6, 나머지 0.15
 */
export function updateStationAlpha(
	stationsLayer: Container,
	stations: Station[],
	selectedStationId: string | null,
): void {
	if (selectedStationId === null) {
		for (const child of stationsLayer.children) {
			child.alpha = 1.0;
		}
		return;
	}

	const links = useStationStore.getState().links;
	const adjacentIds = new Set<string>();
	for (const link of links) {
		if (link.source === selectedStationId) adjacentIds.add(link.target);
		if (link.target === selectedStationId) adjacentIds.add(link.source);
	}

	for (let i = 0; i < stations.length; i++) {
		const station = stations[i];
		if (station === undefined) continue;
		const child = stationsLayer.children[i];
		if (child === undefined) continue;

		if (station.id === selectedStationId) {
			child.alpha = 1.0;
		} else if (adjacentIds.has(station.id)) {
			child.alpha = 0.6;
		} else {
			child.alpha = 0.15;
		}
	}
}

/**
 * 모든 역을 stationsLayer에 렌더링하고 클릭 이벤트를 연결한다.
 */
export function drawAllStations(
	stationsLayer: Container,
	stations: Station[],
	stationScreenMap: Map<string, ScreenCoord>,
	onTap: (station: Station) => void,
): void {
	stationsLayer.removeChildren();

	for (const station of stations) {
		const coord = stationScreenMap.get(station.id);
		if (coord === undefined) {
			continue;
		}

		const colorHex = LINE_COLORS[station.line];
		const color = colorHex !== undefined ? parseInt(colorHex.replace("#", ""), 16) : 0xffffff;

		const gfx = new Graphics();
		gfx.circle(coord.x, coord.y, STATION_RADIUS).fill({ color, alpha: 1 });
		gfx
			.circle(coord.x, coord.y, STATION_RADIUS)
			.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });

		gfx.eventMode = "static";
		gfx.cursor = "pointer";

		const stationRef = station;

		gfx.on("pointerover", () => {
			gfx.clear();
			gfx.circle(coord.x, coord.y, STATION_RADIUS_HOVER).fill({ color, alpha: 1 });
			gfx
				.circle(coord.x, coord.y, STATION_RADIUS_HOVER)
				.stroke({ width: 2, color: 0xffffff, alpha: 1 });
		});

		gfx.on("pointerout", () => {
			gfx.clear();
			gfx.circle(coord.x, coord.y, STATION_RADIUS).fill({ color, alpha: 1 });
			gfx
				.circle(coord.x, coord.y, STATION_RADIUS)
				.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
		});

		gfx.on("pointertap", () => {
			onTap(stationRef);
		});

		stationsLayer.addChild(gfx);
	}
}
