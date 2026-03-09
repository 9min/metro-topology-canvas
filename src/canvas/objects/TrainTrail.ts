import type { Container, Graphics } from "pixi.js";
import { LINE_COLORS } from "@/constants/lineColors";
import { TRAIL_MAX_ALPHA, TRAIL_MAX_WIDTH } from "@/constants/mapConfig";
import type { AnimatedTrainState } from "@/types/train";

export interface TrailQueue {
	points: Array<{ x: number; y: number }>;
	line: number;
}

/**
 * 열차별 최근 위치 큐를 갱신한다.
 * frameCount % frameSkip === 0일 때만 새 포인트를 추가한다.
 */
export function updateTrailQueues(
	trailMap: Map<string, TrailQueue>,
	animatedTrains: AnimatedTrainState[],
	frameCount: number,
	frameSkip: number,
	maxPoints: number,
): void {
	if (frameCount % frameSkip !== 0) return;

	for (const train of animatedTrains) {
		let queue = trailMap.get(train.trainNo);
		if (queue === undefined) {
			queue = { points: [], line: train.line };
			trailMap.set(train.trainNo, queue);
		}
		queue.points.push({ x: train.currentX, y: train.currentY });
		if (queue.points.length > maxPoints) {
			queue.points.shift();
		}
	}
}

/**
 * 단일 Graphics에 트레일을 연결 선분(segment)으로 그린다.
 * 꼬리(오래된 쪽)에서 머리(최신 쪽)로 갈수록 alpha와 두께가 증가하여
 * 열차 뒤에 자연스러운 잔상 궤적을 만든다.
 */
export function drawTrails(
	_trailLayer: Container,
	trailGraphics: Graphics,
	trailMap: Map<string, TrailQueue>,
	activeLines: Set<number>,
): void {
	trailGraphics.clear();

	for (const queue of trailMap.values()) {
		if (!activeLines.has(queue.line)) continue;

		const colorStr = LINE_COLORS[queue.line];
		if (colorStr === undefined) continue;
		const color = Number.parseInt(colorStr.slice(1), 16);
		const len = queue.points.length;
		if (len < 2) continue;

		// 연속 선분을 세그먼트별로 그려 점진적 페이드 효과 적용
		for (let i = 1; i < len; i++) {
			const prev = queue.points[i - 1];
			const curr = queue.points[i];
			if (prev === undefined || curr === undefined) continue;

			const t = i / (len - 1); // 0→1 (꼬리→머리)
			const alpha = t * TRAIL_MAX_ALPHA;
			const width = Math.max(0.5, t * TRAIL_MAX_WIDTH);

			trailGraphics.moveTo(prev.x, prev.y).lineTo(curr.x, curr.y).stroke({ width, color, alpha });
		}
	}
}

/**
 * 더 이상 활성 상태가 아닌 열차의 트레일 큐를 정리한다.
 */
export function pruneTrails(trailMap: Map<string, TrailQueue>, activeTrainNos: Set<string>): void {
	for (const key of trailMap.keys()) {
		if (!activeTrainNos.has(key)) {
			trailMap.delete(key);
		}
	}
}
