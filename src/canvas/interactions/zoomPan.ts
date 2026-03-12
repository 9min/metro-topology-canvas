import type { Container } from "pixi.js";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_SPEED } from "@/constants/mapConfig";
import { useMapStore } from "@/stores/useMapStore";
import type { ScreenCoord } from "@/types/map";
import { easeInOutCubic } from "@/utils/easing";
import { resetPanGuard, updatePanGuard } from "./panGuard";

interface ZoomPanOptions {
	viewport: Container;
	canvas: HTMLCanvasElement;
}

/**
 * 마우스 휠 줌 및 드래그 팬 인터랙션을 설정한다.
 * @returns cleanup 함수
 */
export function setupZoomPan({ viewport, canvas }: ZoomPanOptions): () => void {
	let isDragging = false;
	let dragStartX = 0;
	let dragStartY = 0;
	let viewportStartX = 0;
	let viewportStartY = 0;

	// 핀치 줌용 활성 포인터 추적
	const activePointers = new Map<number, { x: number; y: number }>();
	let prevPinchDist = 0;

	const { setScale, setOffset, setIsDragging } = useMapStore.getState();

	/** 두 포인터 거리를 계산한다 */
	function getPinchDist(a: { x: number; y: number }, b: { x: number; y: number }): number {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}

	/** 피벗 기준으로 viewport 스케일을 적용한다 */
	function applyScale(newScale: number, pivotX: number, pivotY: number): void {
		const oldScale = viewport.scale.x;
		const worldX = (pivotX - viewport.x) / oldScale;
		const worldY = (pivotY - viewport.y) / oldScale;
		viewport.scale.set(newScale);
		viewport.x = pivotX - worldX * newScale;
		viewport.y = pivotY - worldY * newScale;
		setScale(newScale);
		setOffset(viewport.x, viewport.y);
	}

	const onWheel = (event: WheelEvent): void => {
		event.preventDefault();

		const rect = canvas.getBoundingClientRect();
		const mouseX = event.clientX - rect.left;
		const mouseY = event.clientY - rect.top;

		const oldScale = viewport.scale.x;
		const delta = event.deltaY * ZOOM_SPEED;
		const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldScale * (1 - delta)));
		applyScale(newScale, mouseX, mouseY);
	};

	const onPointerDown = (event: PointerEvent): void => {
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (activePointers.size === 1) {
			// 단일 터치: 드래그 시작
			isDragging = true;
			dragStartX = event.clientX;
			dragStartY = event.clientY;
			resetPanGuard(event.clientX, event.clientY);
			viewportStartX = viewport.x;
			viewportStartY = viewport.y;
			canvas.setPointerCapture(event.pointerId);
			setIsDragging(true);
		} else if (activePointers.size === 2) {
			// 두 번째 터치 진입 시 드래그 중단하고 핀치 시작
			isDragging = false;
			setIsDragging(false);
			const pts = [...activePointers.values()];
			if (pts[0] !== undefined && pts[1] !== undefined) {
				prevPinchDist = getPinchDist(pts[0], pts[1]);
			}
		}
	};

	const onPointerMove = (event: PointerEvent): void => {
		if (!activePointers.has(event.pointerId)) return;
		activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

		if (activePointers.size === 2) {
			// 핀치 줌 처리
			const pts = [...activePointers.values()];
			const p1 = pts[0];
			const p2 = pts[1];
			if (p1 === undefined || p2 === undefined) return;
			const dist = getPinchDist(p1, p2);
			if (prevPinchDist > 0) {
				const ratio = dist / prevPinchDist;
				const oldScale = viewport.scale.x;
				const newScale = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, oldScale * ratio));
				// 핀치 중점을 피벗으로 사용
				const rect = canvas.getBoundingClientRect();
				const pivotX = (p1.x + p2.x) / 2 - rect.left;
				const pivotY = (p1.y + p2.y) / 2 - rect.top;
				applyScale(newScale, pivotX, pivotY);
			}
			prevPinchDist = dist;
		} else if (isDragging) {
			// 단일 터치 드래그
			const dx = event.clientX - dragStartX;
			const dy = event.clientY - dragStartY;
			viewport.x = viewportStartX + dx;
			viewport.y = viewportStartY + dy;
			setOffset(viewport.x, viewport.y);
			updatePanGuard(event.clientX, event.clientY);
		}
	};

	/** 포인터가 모두 해제된 경우 드래그 상태를 정리한다 */
	function handleAllPointersUp(pointerId: number): void {
		if (isDragging) {
			isDragging = false;
			setIsDragging(false);
		}
		try {
			canvas.releasePointerCapture(pointerId);
		} catch {
			// 이미 해제된 경우 무시
		}
	}

	/** 핀치에서 단일 터치로 전환 시 드래그를 재시작한다 */
	function handlePinchToSingleTouch(): void {
		const firstEntry = [...activePointers.entries()][0];
		if (firstEntry === undefined) return;
		const [remainingId, remainingPos] = firstEntry;
		isDragging = true;
		dragStartX = remainingPos.x;
		dragStartY = remainingPos.y;
		viewportStartX = viewport.x;
		viewportStartY = viewport.y;
		try {
			canvas.setPointerCapture(remainingId);
		} catch {
			// 캡처 실패 시 무시
		}
		setIsDragging(true);
	}

	const onPointerUp = (event: PointerEvent): void => {
		activePointers.delete(event.pointerId);

		if (activePointers.size < 2) {
			prevPinchDist = 0;
		}

		if (activePointers.size === 0) {
			handleAllPointersUp(event.pointerId);
		} else if (activePointers.size === 1) {
			handlePinchToSingleTouch();
		}
	};

	canvas.addEventListener("wheel", onWheel, { passive: false });
	canvas.addEventListener("pointerdown", onPointerDown);
	canvas.addEventListener("pointermove", onPointerMove);
	canvas.addEventListener("pointerup", onPointerUp);
	canvas.addEventListener("pointercancel", onPointerUp);

	return (): void => {
		canvas.removeEventListener("wheel", onWheel);
		canvas.removeEventListener("pointerdown", onPointerDown);
		canvas.removeEventListener("pointermove", onPointerMove);
		canvas.removeEventListener("pointerup", onPointerUp);
		canvas.removeEventListener("pointercancel", onPointerUp);
	};
}

/** flyToStation 애니메이션 지속 시간 (ms) */
const FLY_DURATION_MS = 800;

/** 목표 줌 레벨 */
const FLY_TARGET_SCALE = 2.0;

/**
 * 카메라를 특정 월드 좌표로 부드럽게 이동한다.
 * @param viewport - PixiJS viewport Container
 * @param targetX - 목표 월드 X 좌표
 * @param targetY - 목표 월드 Y 좌표
 * @param targetScale - 목표 줌 배율 (기본 2.0)
 */
export function flyToStation(
	viewport: Container,
	targetX: number,
	targetY: number,
	targetScale = FLY_TARGET_SCALE,
): void {
	const startX = viewport.x;
	const startY = viewport.y;
	const startScale = viewport.scale.x;
	const startTime = performance.now();

	const endX = window.innerWidth / 2 - targetX * targetScale;
	const endY = window.innerHeight / 2 - targetY * targetScale;

	const { setScale, setOffset } = useMapStore.getState();

	const animate = (): void => {
		const elapsed = performance.now() - startTime;
		const t = Math.min(elapsed / FLY_DURATION_MS, 1);
		const eased = easeInOutCubic(t);

		const currentScale = startScale + (targetScale - startScale) * eased;
		viewport.scale.set(currentScale);
		viewport.x = startX + (endX - startX) * eased;
		viewport.y = startY + (endY - startY) * eased;

		setScale(currentScale);
		setOffset(viewport.x, viewport.y);

		if (t < 1) {
			requestAnimationFrame(animate);
		}
	};

	requestAnimationFrame(animate);
}

/** 경로 바운딩 박스 여백 비율 */
const FLY_ROUTE_PADDING = 0.15;

/**
 * 카메라를 경로 전체가 보이도록 부드럽게 이동한다.
 * 경로 내 모든 역의 바운딩 박스를 계산하여 적절한 줌 레벨과 중심점으로 이동.
 */
export function flyToRoute(
	viewport: Container,
	routeStationIds: string[],
	stationScreenMap: Map<string, ScreenCoord>,
): void {
	if (routeStationIds.length === 0) return;

	// 경로 내 역 좌표의 바운딩 박스 계산
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	let count = 0;

	for (const id of routeStationIds) {
		const coord = stationScreenMap.get(id);
		if (coord === undefined) continue;
		if (coord.x < minX) minX = coord.x;
		if (coord.y < minY) minY = coord.y;
		if (coord.x > maxX) maxX = coord.x;
		if (coord.y > maxY) maxY = coord.y;
		count++;
	}

	if (count === 0) return;

	const routeWidth = maxX - minX;
	const routeHeight = maxY - minY;
	const centerX = (minX + maxX) / 2;
	const centerY = (minY + maxY) / 2;

	// 화면 크기 대비 적절한 줌 레벨 계산 (패딩 포함)
	const screenW = window.innerWidth;
	const screenH = window.innerHeight;
	const padW = screenW * (1 - FLY_ROUTE_PADDING * 2);
	const padH = screenH * (1 - FLY_ROUTE_PADDING * 2);

	let targetScale: number;
	if (routeWidth === 0 && routeHeight === 0) {
		targetScale = FLY_TARGET_SCALE;
	} else {
		const scaleX = routeWidth > 0 ? padW / routeWidth : FLY_TARGET_SCALE;
		const scaleY = routeHeight > 0 ? padH / routeHeight : FLY_TARGET_SCALE;
		targetScale = Math.min(scaleX, scaleY, ZOOM_MAX);
		targetScale = Math.max(targetScale, ZOOM_MIN);
	}

	flyToStation(viewport, centerX, centerY, targetScale);
}
