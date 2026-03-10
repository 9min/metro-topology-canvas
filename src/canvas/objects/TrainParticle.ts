import { type Container, Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { TRAIN_CAPSULE_LENGTH, TRAIN_CAPSULE_WIDTH } from "@/constants/mapConfig";
import type { AnimatedTrainState } from "@/types/train";

/** 호선 색상 문자열을 16진수 숫자로 변환한다 */
function colorToHex(color: string): number {
	return Number.parseInt(color.replace("#", ""), 16);
}

/** 16진수 색상을 지정 비율만큼 어둡게 만든다 (0.7 = 30% 어둡게) */
function darkenColor(hex: number, factor: number): number {
	const r = Math.floor(((hex >> 16) & 0xff) * factor);
	const g = Math.floor(((hex >> 8) & 0xff) * factor);
	const b = Math.floor((hex & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

/** 단일 열차 캡슐 Graphics를 생성하고 호선 색상으로 그린다 */
export function createTrainGraphics(line: number): Graphics | null {
	const colorStr = LINE_COLORS[line];
	if (colorStr === undefined) return null;

	const hex = colorToHex(colorStr);
	const gfx = new Graphics();
	const L = TRAIN_CAPSULE_LENGTH;
	const W = TRAIN_CAPSULE_WIDTH;

	// 글로우 효과 (은은한 반투명 캡슐)
	gfx.roundRect(-L * 1.25, -W * 1.25, L * 2.5, W * 2.5, W * 1.25).fill({
		color: hex,
		alpha: 0.15,
	});

	// 본체 캡슐 (borderRadius=W → 양 끝 반원)
	gfx
		.roundRect(-L, -W, L * 2, W * 2, W)
		.fill({ color: hex, alpha: 0.9 })
		.stroke({ width: 1.2, color: darkenColor(hex, 0.6) });

	// 헤드라이트 그룹 (펄스 애니메이션 대상)
	const headlight = new Graphics();
	headlight.label = "headlight";

	// 헤드라이트 빔 (전방으로 퍼지는 빛)
	headlight
		.moveTo(L, 0)
		.lineTo(L + L * 0.8, -W * 0.7)
		.lineTo(L + L * 0.8, W * 0.7)
		.closePath()
		.fill({ color: 0xffffff, alpha: 0.25 });

	// 헤드라이트 빔 내부 (더 밝은 중심부)
	headlight
		.moveTo(L, 0)
		.lineTo(L + L * 0.5, -W * 0.35)
		.lineTo(L + L * 0.5, W * 0.35)
		.closePath()
		.fill({ color: 0xffffff, alpha: 0.4 });

	// 헤드라이트 점 (전방에 배치)
	headlight.circle(L * 0.5, 0, W * 0.35).fill({
		color: 0xffffff,
		alpha: 0.95,
	});

	gfx.addChild(headlight);

	// 선택 외곽선 (깜빡임 애니메이션 대상)
	const selectionRing = new Graphics();
	selectionRing.label = "selectionRing";
	selectionRing.roundRect(-L, -W, L * 2, W * 2, W).stroke({ width: 1.8, color: 0xffffff });
	selectionRing.visible = false;
	gfx.addChild(selectionRing);

	return gfx;
}

/** 각도를 [-π, π] 범위로 정규화한다 */
function normalizeAngle(a: number): number {
	let r = a % (Math.PI * 2);
	if (r > Math.PI) r -= Math.PI * 2;
	if (r < -Math.PI) r += Math.PI * 2;
	return r;
}

/** 헤드라이트 펄스 주기 (ms) */
const HEADLIGHT_PULSE_PERIOD_MS = 2_000;

/** 헤드라이트 펄스 alpha 범위 [min, max] */
const HEADLIGHT_PULSE_MIN = 0.55;
const HEADLIGHT_PULSE_MAX = 1.0;

/** 프레임별 회전 보간 계수 (60fps 기준 약 8~10프레임에 90% 수렴) */
const ROTATION_LERP_FACTOR = 0.12;

/** 열차 이동 방향 각도(라디안)를 반환한다. 정지 시 NaN. */
function computeTrainAngle(train: AnimatedTrainState): number {
	const dx = train.targetX - train.startX;
	const dy = train.targetY - train.startY;
	if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return Number.NaN;
	return Math.atan2(dy, dx);
}

const ALL_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** 선택 상태 및 노선 필터에 따른 열차 alpha 값을 반환한다 (비활성 노선 > 역 선택 > 열차 선택 > 기본) */
function computeTrainAlpha(
	trainNo: string,
	toStationId: string,
	selectedTrainNo: string | null,
	selectedStationId: string | null,
	line: number,
	activeLines: Set<number>,
): number {
	if (!activeLines.has(line)) return 0;
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

/** 열차 캡슐의 회전을 갱신한다 */
function updateTrainRotation(gfx: Graphics, train: AnimatedTrainState, isNew: boolean): void {
	if (isNew && train.trackAngle !== undefined) {
		gfx.rotation = train.trackAngle;
		return;
	}
	const angle = train.trackAngle !== undefined ? train.trackAngle : computeTrainAngle(train);
	if (!Number.isNaN(angle)) {
		const diff = normalizeAngle(angle - gfx.rotation);
		const MAX_DELTA = Math.PI / 2;
		const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, diff));
		gfx.rotation += clamped * ROTATION_LERP_FACTOR;
	}
}

/** 헤드라이트 펄스 애니메이션을 갱신한다 */
function updateHeadlightPulse(gfx: Graphics): void {
	const hl = gfx.getChildByLabel("headlight");
	if (hl === null) return;
	const t = Math.sin((performance.now() / HEADLIGHT_PULSE_PERIOD_MS) * Math.PI * 2);
	const norm = (t + 1) / 2;
	hl.alpha = HEADLIGHT_PULSE_MIN + norm * (HEADLIGHT_PULSE_MAX - HEADLIGHT_PULSE_MIN);
}

/** 선택 외곽선 깜빡임을 갱신한다 */
function updateSelectionRing(
	gfx: Graphics,
	train: AnimatedTrainState,
	selectedTrainNo: string | null,
): void {
	const ring = gfx.getChildByLabel("selectionRing");
	if (ring === null || !(ring instanceof Graphics)) return;
	const isSelected = selectedTrainNo !== null && train.trainNo === selectedTrainNo;
	ring.visible = isSelected;
	if (isSelected) {
		const blinkT = Math.sin((performance.now() / 300) * Math.PI);
		const lineHex = colorToHex(LINE_COLORS[train.line] ?? "#ffffff");
		const strokeColor = blinkT > 0 ? 0xffffff : darkenColor(lineHex, 0.6);
		const L = TRAIN_CAPSULE_LENGTH;
		const W = TRAIN_CAPSULE_WIDTH;
		ring.clear();
		ring.roundRect(-L, -W, L * 2, W * 2, W).stroke({ width: 1.8, color: strokeColor });
	}
}

/**
 * 애니메이션 상태 배열로부터 열차 캡슐을 렌더링한다.
 * Graphics 풀링: trainNo → Graphics 맵으로 안정적인 열차 identity를 보장한다.
 * 역/열차 선택 및 노선 필터에 따라 alpha를 조정한다.
 * 이동 방향에 따라 캡슐을 회전시킨다.
 */
export function drawAnimatedTrains(
	trainsLayer: Container,
	animatedTrains: AnimatedTrainState[],
	pool: Map<string, Graphics>,
	selectedTrainNo: string | null,
	selectedStationId: string | null,
	onTrainTap: (trainNo: string) => void,
	activeLines: Set<number> = ALL_LINES,
): void {
	for (const train of animatedTrains) {
		const isNew = !pool.has(train.trainNo);
		const gfx = pool.get(train.trainNo) ?? registerTrain(trainsLayer, pool, train, onTrainTap);
		if (gfx === null) continue;

		gfx.x = train.currentX;
		gfx.y = train.currentY;

		updateTrainRotation(gfx, train, isNew);

		gfx.alpha = computeTrainAlpha(
			train.trainNo,
			train.toStationId,
			selectedTrainNo,
			selectedStationId,
			train.line,
			activeLines,
		);

		updateHeadlightPulse(gfx);
		updateSelectionRing(gfx, train, selectedTrainNo);
	}
}
