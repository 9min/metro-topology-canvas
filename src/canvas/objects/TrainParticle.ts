import { type Container, Graphics, Text } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import {
	TRAIN_CAPSULE_LENGTH,
	TRAIN_CAPSULE_WIDTH,
	TRAIN_FADEIN_MS,
	TRAIN_FADEOUT_MS,
	UNEXPECTED_MARKER_DURATION_MS,
} from "@/constants/mapConfig";
import { useMapStore } from "@/stores/useMapStore";
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

/** 열차 본체(글로우 + 캡슐)를 지정 색상으로 그린다. gfx.clear() 호출 후 실행한다. */
function drawTrainBody(gfx: Graphics, hex: number): void {
	const L = TRAIN_CAPSULE_LENGTH;
	const W = TRAIN_CAPSULE_WIDTH;
	gfx.roundRect(-L * 1.25, -W * 1.25, L * 2.5, W * 2.5, W * 1.25).fill({
		color: hex,
		alpha: 0.15,
	});
	gfx
		.roundRect(-L, -W, L * 2, W * 2, W)
		.fill({ color: hex, alpha: 0.9 })
		.stroke({ width: 1.2, color: darkenColor(hex, 0.6) });
}


/** 단일 열차 캡슐 Graphics를 생성하고 호선 색상으로 그린다 */
export function createTrainGraphics(line: number): Graphics | null {
	const colorStr = LINE_COLORS[line];
	if (colorStr === undefined) return null;

	const hex = colorToHex(colorStr);
	const gfx = new Graphics();

	drawTrainBody(gfx, hex);

	const L = TRAIN_CAPSULE_LENGTH;
	const W = TRAIN_CAPSULE_WIDTH;

	// 헤드라이트 그룹 (펄스 애니메이션 대상)
	const headlight = new Graphics();
	headlight.label = "headlight";

	// 헤드라이트 빔 (전방으로 퍼지는 빛) — 매우 은은하게
	headlight
		.moveTo(L, 0)
		.lineTo(L + L * 0.5, -W * 0.4)
		.lineTo(L + L * 0.5, W * 0.4)
		.closePath()
		.fill({ color: 0xffffff, alpha: 0.1 });

	// 헤드라이트 점 (전방에 배치)
	headlight.circle(L * 0.5, 0, W * 0.35).fill({
		color: 0xffffff,
		alpha: 0.95,
	});

	gfx.addChild(headlight);

	// 이동 방향 화살표 (흐르는 애니메이션 대상)
	const movingArrows = new Graphics();
	movingArrows.label = "movingArrows";
	movingArrows.visible = false;
	gfx.addChild(movingArrows);

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

const ALL_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** 선택 상태 및 노선 필터에 따른 열차 alpha 값을 반환한다 (비활성 노선 > 역 선택 > 기본) */
function computeTrainAlpha(
	toStationId: string,
	selectedStationId: string | null,
	line: number,
	activeLines: Set<number>,
): number {
	if (!activeLines.has(line)) return 0;
	if (selectedStationId !== null) return toStationId === selectedStationId ? 1.0 : 0.15;
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

/** 열차 캡슐의 회전을 갱신한다. 항상 trackAngle(다음역 방향)을 목표로 보간한다. */
function updateTrainRotation(gfx: Graphics, train: AnimatedTrainState, isNew: boolean): void {
	const targetAngle = train.trackAngle;
	if (isNew) {
		gfx.rotation = targetAngle;
		return;
	}
	const diff = normalizeAngle(targetAngle - gfx.rotation);
	const MAX_DELTA = Math.PI / 2;
	const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, diff));
	gfx.rotation += clamped * ROTATION_LERP_FACTOR;
}

/** 헤드라이트 펄스 애니메이션을 갱신한다 */
function updateHeadlightPulse(gfx: Graphics): void {
	const hl = gfx.getChildByLabel("headlight");
	if (hl === null) return;
	const t = Math.sin((performance.now() / HEADLIGHT_PULSE_PERIOD_MS) * Math.PI * 2);
	const norm = (t + 1) / 2;
	hl.alpha = HEADLIGHT_PULSE_MIN + norm * (HEADLIGHT_PULSE_MAX - HEADLIGHT_PULSE_MIN);
}

/** 이동 방향 화살표 1사이클 주기 (ms) */
const ARROW_PERIOD_MS = 700;

/** 동시 표시 화살표 수 */
const NUM_ARROWS = 2;

/** 이동 중 흐르는 화살표 애니메이션을 갱신한다 */
function updateMovingArrows(gfx: Graphics, train: AnimatedTrainState, now: number): void {
	const arrowGfx = gfx.getChildByLabel("movingArrows");
	if (arrowGfx === null || !(arrowGfx instanceof Graphics)) return;

	const isMoving = train.isMoving;
	const isFadingOut = train.fadeOutStartedAt !== undefined;

	if (!isMoving || isFadingOut) {
		arrowGfx.visible = false;
		arrowGfx.clear();
		return;
	}

	const L = TRAIN_CAPSULE_LENGTH;
	const W = TRAIN_CAPSULE_WIDTH;
	const offset = (now % ARROW_PERIOD_MS) / ARROW_PERIOD_MS; // 0~1

	arrowGfx.clear();
	arrowGfx.visible = true;

	for (let i = 0; i < NUM_ARROWS; i++) {
		const phase = i / NUM_ARROWS;
		const t = (offset + phase) % 1; // 0→1: 뒤에서 앞으로
		const x = -L * 0.7 + t * L * 1.4; // -L*0.7 → L*0.7
		const alpha = Math.min(t, 1 - t) * 2 * 0.35; // 등장/소멸 페이드 (최대 0.35로 제한)
		const backX = x - W * 0.5; // > 의 뒷점
		const tipX = x + W * 0.3; // > 의 앞점(뾰족한 쪽, 전방)

		arrowGfx
			.moveTo(backX, -W * 0.65)
			.lineTo(tipX, 0)
			.lineTo(backX, W * 0.65)
			.stroke({ width: 0.8, color: 0xffffff, alpha });
	}
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
/** 예상 밖 이동 경고 마커 텍스트 스타일 */
const UNEXPECTED_MARKER_STYLE = {
	fill: 0xff3333,
	fontSize: 18,
	fontWeight: "bold",
	fontFamily: "sans-serif",
	dropShadow: {
		color: 0x000000,
		blur: 4,
		distance: 0,
		alpha: 0.9,
	},
};

/** 예상 밖 이동 경고 마커 풀: trainNo → Text */
const unexpectedMarkerPool = new Map<string, Text>();

/** 열차 번호 텍스트 스타일 */
const TRAIN_LABEL_STYLE = {
	fill: 0xcccccc,
	fontSize: 12,
	fontFamily: "sans-serif",
	dropShadow: {
		color: 0x000000,
		blur: 3,
		distance: 0,
		alpha: 0.8,
	},
};

/** 열차 번호 텍스트 풀: trainNo → Text (한 번 생성 후 위치만 갱신) */
const trainLabelPool = new Map<string, Text>();

/** 열차 번호 레이블의 줌 기준 스케일 — 이 배율 이상에서 원본 크기 */
const TRAIN_LABEL_BASE_SCALE = 1.2;

/** 열차 번호 텍스트를 렌더링한다 */
function renderTrainLabels(labelsLayer: Container, animatedTrains: AnimatedTrainState[]): void {
	const { scale: viewportScale, trainLabelsEnabled } = useMapStore.getState();

	// 비활성 시 풀과 레이어를 비우고 종료
	if (!trainLabelsEnabled) {
		if (trainLabelPool.size > 0) {
			labelsLayer.removeChildren();
			trainLabelPool.clear();
		}
		return;
	}

	// 줌아웃 시 레이블 축소, TRAIN_LABEL_BASE_SCALE 이상이면 원본 크기 유지
	const scaleFactor = Math.min(viewportScale / TRAIN_LABEL_BASE_SCALE, 1);
	const invScale = scaleFactor / viewportScale;

	// 현재 프레임에 존재하는 열차 번호 집합
	const activeTrainNos = new Set<string>();

	for (const train of animatedTrains) {
		activeTrainNos.add(train.trainNo);

		// 열차 번호 텍스트: 풀에서 재사용하거나 새로 생성
		let label = trainLabelPool.get(train.trainNo);
		if (label === undefined) {
			label = new Text({ text: train.trainNo, style: TRAIN_LABEL_STYLE });
			label.anchor.set(0.5, 1);
			trainLabelPool.set(train.trainNo, label);
			labelsLayer.addChild(label);
		}
		label.scale.set(invScale);
		label.x = train.currentX;
		label.y = train.currentY - 5 * invScale;
		label.visible = true;
	}

	// 사라진 열차의 텍스트를 풀에서 제거
	for (const [trainNo, label] of trainLabelPool) {
		if (!activeTrainNos.has(trainNo)) {
			labelsLayer.removeChild(label);
			label.destroy();
			trainLabelPool.delete(trainNo);
		}
	}
}

/** 예상 밖 구간 변경 경고 "!" 마커를 렌더링한다 */
function renderUnexpectedMarkers(
	labelsLayer: Container,
	animatedTrains: AnimatedTrainState[],
	now: number,
): void {
	const { scale: viewportScale } = useMapStore.getState();
	const invScale = 1 / viewportScale;

	const activeTrainNos = new Set<string>();

	for (const train of animatedTrains) {
		if (train.unexpectedSnapAt === undefined) continue;

		const elapsed = now - train.unexpectedSnapAt;
		if (elapsed >= UNEXPECTED_MARKER_DURATION_MS) continue;

		activeTrainNos.add(train.trainNo);

		let marker = unexpectedMarkerPool.get(train.trainNo);
		if (marker === undefined) {
			marker = new Text({ text: "⚠", style: UNEXPECTED_MARKER_STYLE });
			marker.anchor.set(0.5, 0.5);
			unexpectedMarkerPool.set(train.trainNo, marker);
			labelsLayer.addChild(marker);
		}

		marker.scale.set(invScale);
		marker.x = train.unexpectedSnapX ?? train.currentX;
		marker.y = train.unexpectedSnapY ?? train.currentY;

		// 깜빡임: sin 기반 alpha (0.4~1.0)
		const blinkT = Math.sin((elapsed / 300) * Math.PI);
		marker.alpha = 0.7 + 0.3 * blinkT;
		marker.visible = true;
	}

	// 만료되거나 사라진 열차의 마커 제거
	for (const [trainNo, marker] of unexpectedMarkerPool) {
		if (!activeTrainNos.has(trainNo)) {
			labelsLayer.removeChild(marker);
			marker.destroy();
			unexpectedMarkerPool.delete(trainNo);
		}
	}
}

export function drawAnimatedTrains(
	trainsLayer: Container,
	animatedTrains: AnimatedTrainState[],
	pool: Map<string, Graphics>,
	selectedTrainNo: string | null,
	selectedStationId: string | null,
	onTrainTap: (trainNo: string) => void,
	activeLines: Set<number> = ALL_LINES,
	trainLabelsLayer?: Container | null,
): void {
	const now = performance.now();

	for (const train of animatedTrains) {
		const isNew = !pool.has(train.trainNo);
		const gfx = pool.get(train.trainNo) ?? registerTrain(trainsLayer, pool, train, onTrainTap);
		if (gfx === null) continue;

		gfx.x = train.currentX;
		gfx.y = train.currentY;

		updateTrainRotation(gfx, train, isNew);

		let alpha = computeTrainAlpha(train.toStationId, selectedStationId, train.line, activeLines);

		// 페이드아웃 처리
		if (train.fadeOutStartedAt !== undefined) {
			const fadeElapsed = now - train.fadeOutStartedAt;
			const fadeOutProgress = Math.min(fadeElapsed / TRAIN_FADEOUT_MS, 1);
			alpha *= 1 - fadeOutProgress;
			// 회색 틴트 (geometry 미변경 → 배칭 유지, 렌더링 아티팩트 없음)
			if (gfx.tint !== 0x888888) gfx.tint = 0x888888;
		} else {
			// 복귀 시 틴트 초기화
			if (gfx.tint !== 0xffffff) gfx.tint = 0xffffff;
			// 신규 열차 페이드인 (500ms)
			const age = now - train.createdAt;
			if (age < TRAIN_FADEIN_MS) {
				const fadeProgress = age / TRAIN_FADEIN_MS;
				alpha *= fadeProgress;
				// 살짝 커지는 스케일 효과
				const scale = 0.5 + 0.5 * fadeProgress;
				gfx.scale.set(scale);
			} else if (gfx.scale.x !== 1) {
				gfx.scale.set(1);
			}
		}

		gfx.alpha = alpha;

		updateHeadlightPulse(gfx);
		updateMovingArrows(gfx, train, now);
		updateSelectionRing(gfx, train, selectedTrainNo);
	}

	// 열차 번호 레이블 렌더링
	if (trainLabelsLayer != null) {
		renderTrainLabels(trainLabelsLayer, animatedTrains);
		// 예상 밖 텔레포트 경고 마커: 개발 모드 전용 (API 데이터 품질 디버깅용)
		if (import.meta.env.DEV) {
			renderUnexpectedMarkers(trainLabelsLayer, animatedTrains, now);
		}
	}
}
