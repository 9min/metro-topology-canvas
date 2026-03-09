import { type Container, Text } from "pixi.js";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";

/** 역 이름 레이블 텍스트 스타일 */
const LABEL_STYLE = {
	fill: 0xcccccc,
	fontSize: 14,
	fontFamily: "sans-serif",
	align: "center" as const,
	dropShadow: {
		color: 0x000000,
		blur: 3,
		distance: 0,
		alpha: 0.8,
	},
};

/** 충돌 감지 그리드 셀 크기 (스크린 픽셀) — 레이블 간 여유 간격 확보 */
const GRID_CELL_W = 140;
const GRID_CELL_H = 32;

/** 한 글자당 추정 너비 (px, fontSize 14 기준) */
const CHAR_WIDTH = 9;

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
		// label에 "이름:호선" 형식으로 저장하여 필터링에 활용
		label.label = `${station.name}:${station.line}`;
		labelsLayer.addChild(label);
	}
}

/** 스크린 좌표가 화면 밖인지 판정한다 */
function isOffScreen(sx: number, sy: number): boolean {
	const sw = globalThis.innerWidth ?? 1200;
	const sh = globalThis.innerHeight ?? 800;
	return sx < -120 || sx > sw + 120 || sy < -30 || sy > sh + 30;
}

/** 지정된 열 범위가 이미 점유된 그리드 셀과 충돌하는지 확인한다 */
function hasGridCollision(
	occupied: Set<string>,
	colStart: number,
	colEnd: number,
	row: number,
): boolean {
	for (let c = colStart; c <= colEnd; c++) {
		if (occupied.has(`${c},${row}`)) return true;
	}
	return false;
}

/** 지정된 열 범위를 점유 상태로 마킹한다 */
function markOccupied(occupied: Set<string>, colStart: number, colEnd: number, row: number): void {
	for (let c = colStart; c <= colEnd; c++) {
		occupied.add(`${c},${row}`);
	}
}

/** label 태그에서 호선 번호를 추출한다 ("역이름:호선" 형식) */
function parseLine(tag: string): number {
	const colonIdx = tag.lastIndexOf(":");
	if (colonIdx === -1) return -1;
	return Number(tag.slice(colonIdx + 1));
}

/** label 태그에서 역 이름 부분의 글자 수를 반환한다 */
function parseNameLength(tag: string): number {
	const name = tag.split(":")[0] ?? "";
	return name.length || 3;
}

/** 이전 프레임의 레이블 visible 상태를 기억하여 히스테리시스를 적용한다 */
const prevVisible = new Map<string, boolean>();

/** 레이블 목록을 그리드 충돌 검사하여 visible 상태를 결정한다 */
function placeLabelsOnGrid(
	children: Container["children"],
	occupied: Set<string>,
	scale: number,
	viewportX: number,
	viewportY: number,
): void {
	for (const child of children) {
		const tag = child.label ?? "";
		const sx = child.x * scale + viewportX;
		const sy = child.y * scale + viewportY;

		const labelW = parseNameLength(tag) * CHAR_WIDTH;
		const colStart = Math.floor((sx - labelW / 2) / GRID_CELL_W);
		const colEnd = Math.floor((sx + labelW / 2) / GRID_CELL_W);
		const row = Math.floor(sy / GRID_CELL_H);

		if (hasGridCollision(occupied, colStart, colEnd, row)) {
			child.visible = false;
			prevVisible.set(tag, false);
		} else {
			child.visible = true;
			prevVisible.set(tag, true);
			markOccupied(occupied, colStart, colEnd, row);
		}
	}
}

/**
 * 화면 공간 그리드 기반 충돌 감지로 겹치는 레이블을 숨긴다.
 * 히스테리시스: 이전 프레임에서 visible이었던 레이블이 그리드를 선점하여
 * 셀 경계 근처에서의 불안정한 토글(깜빡임)을 방지한다.
 * 매 프레임 ticker에서 호출하며, labelsLayer.alpha > 0일 때만 실행한다.
 */
export function updateLabelVisibility(
	labelsLayer: Container,
	scale: number,
	viewportX: number,
	viewportY: number,
	activeLines?: Set<number>,
): void {
	const occupied = new Set<string>();
	const invScale = 1 / scale;

	// 레이블을 이전 visible 여부로 분류
	const prevVisibleChildren: typeof labelsLayer.children = [];
	const prevHiddenChildren: typeof labelsLayer.children = [];

	for (const child of labelsLayer.children) {
		const tag = child.label ?? "";

		// 비활성 노선 레이블 숨김
		if (activeLines !== undefined) {
			const line = parseLine(tag);
			if (line !== -1 && !activeLines.has(line)) {
				child.visible = false;
				prevVisible.set(tag, false);
				continue;
			}
		}

		// 줌에 관계없이 레이블을 일정한 스크린 크기로 유지
		child.scale.set(invScale);

		const sx = child.x * scale + viewportX;
		const sy = child.y * scale + viewportY;

		if (isOffScreen(sx, sy)) {
			child.visible = false;
			prevVisible.set(tag, false);
			continue;
		}

		// 이전 프레임에서 visible이었던 레이블 우선 처리
		if (prevVisible.get(tag) === true) {
			prevVisibleChildren.push(child);
		} else {
			prevHiddenChildren.push(child);
		}
	}

	// 1차: 이전에 visible이었던 레이블 → 그리드 선점
	placeLabelsOnGrid(prevVisibleChildren, occupied, scale, viewportX, viewportY);
	// 2차: 이전에 hidden이었던 레이블 → 남은 그리드에 배치 시도
	placeLabelsOnGrid(prevHiddenChildren, occupied, scale, viewportX, viewportY);
}
