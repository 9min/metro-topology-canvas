import { type Container, Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { TRAIN_PARTICLE_RADIUS } from "@/constants/mapConfig";
import type { InterpolatedTrain } from "@/types/train";

/** 호선 색상 문자열을 16진수 숫자로 변환한다 */
function colorToHex(color: string): number {
	return Number.parseInt(color.replace("#", ""), 16);
}

/**
 * 보간된 열차 데이터를 PixiJS 입자로 렌더링한다.
 * 매 폴링마다 전체 재생성 방식 (v0.2 단순 구현).
 */
export function drawTrains(trainsLayer: Container, interpolatedTrains: InterpolatedTrain[]): void {
	trainsLayer.removeChildren();

	for (const train of interpolatedTrains) {
		const colorStr = LINE_COLORS[train.line];
		if (colorStr === undefined) continue;

		const hex = colorToHex(colorStr);
		const gfx = new Graphics();

		// 글로우 효과 (큰 반투명 원)
		gfx.circle(train.x, train.y, TRAIN_PARTICLE_RADIUS * 2.5).fill({
			color: hex,
			alpha: 0.25,
		});

		// 메인 입자
		gfx.circle(train.x, train.y, TRAIN_PARTICLE_RADIUS).fill({
			color: hex,
			alpha: 0.9,
		});

		// 밝은 중심점
		gfx.circle(train.x, train.y, TRAIN_PARTICLE_RADIUS * 0.4).fill({
			color: 0xffffff,
			alpha: 0.7,
		});

		trainsLayer.addChild(gfx);
	}
}
