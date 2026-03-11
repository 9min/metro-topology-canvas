import type { Container } from "pixi.js";
import { Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { STATION_RADIUS, STATION_RADIUS_HOVER } from "@/constants/mapConfig";
import { useStationStore } from "@/stores/useStationStore";
import type { ScreenCoord } from "@/types/map";
import type { Station } from "@/types/station";
import type { TransferMap } from "@/utils/transferStation";

/** 선택 역 기준으로 인접 역 ID 집합을 반환한다 */
function buildAdjacentIds(selectedStationId: string): Set<string> {
	const links = useStationStore.getState().links;
	const adjacentIds = new Set<string>();
	for (const link of links) {
		if (link.source === selectedStationId) adjacentIds.add(link.target);
		if (link.target === selectedStationId) adjacentIds.add(link.source);
	}
	return adjacentIds;
}

/** 역의 선택 상태에 따른 alpha 값을 반환한다 */
function stationAlpha(
	stationId: string,
	selectedStationId: string,
	adjacentIds: Set<string>,
): number {
	if (stationId === selectedStationId) return 1.0;
	if (adjacentIds.has(stationId)) return 0.6;
	return 0.15;
}

const ALL_LINES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

/** 노선 필터 + 역 선택 상태를 조합하여 단일 역의 alpha를 반환한다 */
function resolveStationAlpha(
	station: Station,
	selectedStationId: string | null,
	adjacentIds: Set<string> | null,
	activeLines: Set<number>,
	transferMap?: TransferMap,
): number {
	// 환승역: 그룹 내 활성 호선이 하나라도 있으면 line 비활성 무시
	if (transferMap !== undefined) {
		const group = transferMap.get(station.name);
		if (group !== undefined && group.length >= 2) {
			const anyActive = group.some((s) => activeLines.has(s.line));
			if (anyActive) {
				if (selectedStationId === null) return 1.0;
				return stationAlpha(station.id, selectedStationId, adjacentIds ?? new Set());
			}
			return 0.2; // 그룹 전체 비활성
		}
	}
	if (!activeLines.has(station.line)) return 0.2;
	if (selectedStationId === null) return 1.0;
	return stationAlpha(station.id, selectedStationId, adjacentIds ?? new Set());
}

/**
 * 선택된 역 기준으로 역 Graphics의 alpha를 업데이트한다.
 * activeLines에 없는 호선의 역은 숨긴다.
 * 선택 없음: 활성 노선 1.0, 비활성 0 / 선택 있음: 선택 역 1.0, 인접 역 0.6, 나머지 0.15
 */
export function updateStationAlpha(
	stationsLayer: Container,
	stations: Station[],
	selectedStationId: string | null,
	activeLines: Set<number> = ALL_LINES,
	transferMap?: TransferMap,
): void {
	const adjacentIds = selectedStationId !== null ? buildAdjacentIds(selectedStationId) : null;

	for (let i = 0; i < stations.length; i++) {
		const station = stations[i];
		if (station === undefined) continue;
		const child = stationsLayer.children[i];
		if (child === undefined) continue;
		child.alpha = resolveStationAlpha(
			station,
			selectedStationId,
			adjacentIds,
			activeLines,
			transferMap,
		);
	}
}

/** 호선 색상 hex 문자열을 숫자로 변환한다 */
function lineColorNum(line: number): number {
	const hex = LINE_COLORS[line];
	return hex !== undefined ? parseInt(hex.replace("#", ""), 16) : 0xffffff;
}

/** 환승역 반지름 배수 (비환승역 대비) */
const TRANSFER_RADIUS_SCALE = 1.5;

/** 환승역 파이 차트(균등 분할 arc) 렌더링 */
function drawTransferStation(
	gfx: Graphics,
	x: number,
	y: number,
	lines: number[],
	radius: number,
): void {
	const count = lines.length;
	const angleStep = (Math.PI * 2) / count;

	for (let i = 0; i < count; i++) {
		const line = lines[i];
		if (line === undefined) continue;
		const color = lineColorNum(line);
		const startAngle = i * angleStep - Math.PI / 2; // 12시 방향 시작
		const endAngle = startAngle + angleStep;

		// 파이 조각: moveTo 중심 → arc → closePath → fill
		gfx.moveTo(x, y);
		gfx.arc(x, y, radius, startAngle, endAngle);
		gfx.closePath();
		gfx.fill({ color, alpha: 1 });
	}

	// 외곽 흰색 테두리
	gfx.circle(x, y, radius).stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
}

/**
 * 모든 역을 stationsLayer에 렌더링하고 클릭 이벤트를 연결한다.
 * transferMap이 제공되면 환승역에 파이 차트 색상으로 그린다.
 * 같은 좌표의 환승역 중복 렌더링을 방지: 첫 ID만 시각적으로 그리고 나머지는 투명 히트박스.
 */
export function drawAllStations(
	stationsLayer: Container,
	stations: Station[],
	stationScreenMap: Map<string, ScreenCoord>,
	onTap: (station: Station) => void,
	transferMap?: TransferMap,
): void {
	stationsLayer.removeChildren();

	// 환승역 중 이미 렌더링된 이름 추적 (중복 방지)
	const renderedTransferNames = new Set<string>();

	for (const station of stations) {
		const coord = stationScreenMap.get(station.id);
		if (coord === undefined) {
			continue;
		}

		const color = lineColorNum(station.line);
		const transferLines = transferMap?.get(station.name);
		const isTransfer = transferLines !== undefined && transferLines.length >= 2;

		// 환승역의 두 번째 이후 항목은 투명 히트박스만 추가 (시각적 렌더링 없음)
		if (isTransfer && renderedTransferNames.has(station.name)) {
			const gfx = new Graphics();
			const hitRadius = STATION_RADIUS * TRANSFER_RADIUS_SCALE;
			gfx.circle(coord.x, coord.y, hitRadius).fill({ color: 0x000000, alpha: 0.001 });
			gfx.eventMode = "static";
			gfx.cursor = "pointer";
			const stationRef = station;
			gfx.on("pointertap", () => {
				onTap(stationRef);
			});
			stationsLayer.addChild(gfx);
			continue;
		}

		if (isTransfer) {
			renderedTransferNames.add(station.name);
		}

		const lines = isTransfer ? transferLines.map((s) => s.line) : [];
		const baseRadius = isTransfer ? STATION_RADIUS * TRANSFER_RADIUS_SCALE : STATION_RADIUS;
		const hoverRadius = isTransfer
			? STATION_RADIUS_HOVER * TRANSFER_RADIUS_SCALE
			: STATION_RADIUS_HOVER;

		const gfx = new Graphics();

		if (isTransfer) {
			drawTransferStation(gfx, coord.x, coord.y, lines, baseRadius);
		} else {
			gfx.circle(coord.x, coord.y, STATION_RADIUS).fill({ color, alpha: 1 });
			gfx
				.circle(coord.x, coord.y, STATION_RADIUS)
				.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
		}

		gfx.eventMode = "static";
		gfx.cursor = "pointer";

		const stationRef = station;

		gfx.on("pointerover", () => {
			gfx.clear();
			if (isTransfer) {
				drawTransferStation(gfx, coord.x, coord.y, lines, hoverRadius);
			} else {
				gfx.circle(coord.x, coord.y, STATION_RADIUS_HOVER).fill({ color, alpha: 1 });
				gfx
					.circle(coord.x, coord.y, STATION_RADIUS_HOVER)
					.stroke({ width: 2, color: 0xffffff, alpha: 1 });
			}
		});

		gfx.on("pointerout", () => {
			gfx.clear();
			if (isTransfer) {
				drawTransferStation(gfx, coord.x, coord.y, lines, baseRadius);
			} else {
				gfx.circle(coord.x, coord.y, STATION_RADIUS).fill({ color, alpha: 1 });
				gfx
					.circle(coord.x, coord.y, STATION_RADIUS)
					.stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
			}
		});

		gfx.on("pointertap", () => {
			onTap(stationRef);
		});

		stationsLayer.addChild(gfx);
	}
}
