import { type Container, Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { TRAIN_PARTICLE_RADIUS } from "@/constants/mapConfig";
import type { AnimatedTrainState } from "@/types/train";

/** 호선 색상 문자열을 16진수 숫자로 변환한다 */
function colorToHex(color: string): number {
	return Number.parseInt(color.replace("#", ""), 16);
}

/** 단일 열차 Graphics를 생성하고 호선 색상으로 그린다 */
export function createTrainGraphics(line: number): Graphics | null {
	const colorStr = LINE_COLORS[line];
	if (colorStr === undefined) return null;

	const hex = colorToHex(colorStr);
	const gfx = new Graphics();

	// 글로우 효과 (큰 반투명 원) — position (0,0) 기준으로 그린다
	gfx.circle(0, 0, TRAIN_PARTICLE_RADIUS * 2.5).fill({
		color: hex,
		alpha: 0.25,
	});

	// 메인 입자
	gfx.circle(0, 0, TRAIN_PARTICLE_RADIUS).fill({
		color: hex,
		alpha: 0.9,
	});

	// 밝은 중심점
	gfx.circle(0, 0, TRAIN_PARTICLE_RADIUS * 0.4).fill({
		color: 0xffffff,
		alpha: 0.7,
	});

	return gfx;
}

/**
 * 애니메이션 상태 배열로부터 열차 입자를 렌더링한다.
 * Graphics 풀링: 기존 자식을 재활용하고, 부족하면 생성, 남으면 숨긴다.
 */
export function drawAnimatedTrains(
	trainsLayer: Container,
	animatedTrains: AnimatedTrainState[],
): void {
	const existing = trainsLayer.children;

	for (let i = 0; i < animatedTrains.length; i++) {
		const train = animatedTrains[i];
		if (train === undefined) continue;

		let gfx: Graphics;

		if (i < existing.length) {
			// 기존 Graphics 재활용
			gfx = existing[i] as Graphics;
			gfx.visible = true;
		} else {
			// 새 Graphics 생성
			const created = createTrainGraphics(train.line);
			if (created === null) continue;
			gfx = created;
			trainsLayer.addChild(gfx);
		}

		gfx.x = train.currentX;
		gfx.y = train.currentY;
	}

	// 남은 Graphics 숨기기
	for (let i = animatedTrains.length; i < existing.length; i++) {
		const child = existing[i];
		if (child !== undefined) {
			child.visible = false;
		}
	}
}
