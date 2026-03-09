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

/** 선택 상태에 따른 열차 alpha 값을 반환한다 (역 선택 > 열차 선택 > 기본) */
function computeTrainAlpha(
	trainNo: string,
	toStationId: string,
	selectedTrainNo: string | null,
	selectedStationId: string | null,
): number {
	if (selectedStationId !== null) return toStationId === selectedStationId ? 1.0 : 0.15;
	if (selectedTrainNo !== null) return trainNo === selectedTrainNo ? 1.0 : 0.15;
	return 1.0;
}

/** 신규 열차 Graphics를 초기화하고 풀/레이어에 등록한다 */
function registerTrain(
	trainsLayer: Container,
	pool: Map<string, Graphics>,
	train: AnimatedTrainState,
	onTrainTap: (trainNo: string) => void,
): Graphics | null {
	const created = createTrainGraphics(train.line);
	if (created === null) return null;
	created.label = train.trainNo;
	created.eventMode = "static";
	created.cursor = "pointer";
	const trainNo = train.trainNo;
	created.on("pointertap", () => onTrainTap(trainNo));
	pool.set(train.trainNo, created);
	trainsLayer.addChild(created);
	return created;
}

/**
 * 애니메이션 상태 배열로부터 열차 입자를 렌더링한다.
 * Graphics 풀링: trainNo → Graphics 맵으로 안정적인 열차 identity를 보장한다.
 * 역/열차 선택 시 나머지 열차의 alpha를 0.15로 dimming한다.
 */
export function drawAnimatedTrains(
	trainsLayer: Container,
	animatedTrains: AnimatedTrainState[],
	pool: Map<string, Graphics>,
	selectedTrainNo: string | null,
	selectedStationId: string | null,
	onTrainTap: (trainNo: string) => void,
): void {
	for (const train of animatedTrains) {
		const gfx = pool.get(train.trainNo) ?? registerTrain(trainsLayer, pool, train, onTrainTap);
		if (gfx === null) continue;

		gfx.x = train.currentX;
		gfx.y = train.currentY;
		gfx.alpha = computeTrainAlpha(
			train.trainNo,
			train.toStationId,
			selectedTrainNo,
			selectedStationId,
		);
	}
}
