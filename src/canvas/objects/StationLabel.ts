import { Text, type Container } from "pixi.js";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";

/** 역 이름 레이블 텍스트 스타일 */
const LABEL_STYLE = {
	fill: 0xcccccc,
	fontSize: 9,
	fontFamily: "sans-serif",
	align: "center" as const,
	dropShadow: {
		color: 0x000000,
		blur: 3,
		distance: 0,
		alpha: 0.8,
	},
};

/**
 * 모든 역 이름 레이블을 labelsLayer에 렌더링한다.
 * 시맨틱 줌: labelsLayer.alpha를 줌 배율에 따라 MapCanvas의 ticker에서 업데이트한다.
 */
export function drawStationLabels(
	labelsLayer: Container,
	stations: Station[],
	stationScreenMap: Map<string, ScreenCoord>,
): void {
	labelsLayer.removeChildren();

	for (const station of stations) {
		const coord = stationScreenMap.get(station.id);
		if (coord === undefined) continue;

		const label = new Text({ text: station.name, style: LABEL_STYLE });
		label.x = coord.x;
		label.y = coord.y + 8;
		label.anchor.set(0.5, 0);
		labelsLayer.addChild(label);
	}
}
