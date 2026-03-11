/**
 * 디버그 스냅샷 유틸리티.
 * 디버그 모드에서 S 키를 누르면 파이프라인 전 단계의 상태를 콘솔에 JSON으로 덤프한다.
 *
 * 파이프라인: API 원본(raw) → 보간(interpolated) → 애니메이션(animated)
 * 각 열차를 trainNo 기준으로 join하여 한눈에 비교할 수 있다.
 */

import type { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import { useTrainStore } from "@/stores/useTrainStore";

/** MapCanvas에서 animator를 등록한다 */
let registeredAnimator: TrainAnimator | null = null;

export function registerAnimatorForDebug(animator: TrainAnimator): void {
	registeredAnimator = animator;
}

export function unregisterAnimatorForDebug(): void {
	registeredAnimator = null;
}

/** 단일 열차의 파이프라인 전 단계를 결합한 스냅샷 */
interface TrainSnapshot {
	trainNo: string;
	line: number;
	/** API 원본 */
	raw: {
		stationId: string;
		stationName: string;
		status: string;
		direction: string;
	} | null;
	/** 보간 결과 */
	interpolated: {
		x: number;
		y: number;
		progress: number;
		fromStationId: string;
		toStationId: string;
		trackAngle: number;
		direction: string;
	} | null;
	/** 애니메이션 상태 */
	animated: {
		currentX: number;
		currentY: number;
		targetX: number;
		targetY: number;
		startX: number;
		startY: number;
		fromStationId: string;
		toStationId: string;
		trackAngle: number | undefined;
		direction: string;
		duration: number;
		pathLength: number;
		elapsed: number;
	} | null;
	/** 폴링 이력 */
	pollHistory: {
		missedCount: number;
	} | null;
}

/** 현재 파이프라인 전 단계를 스냅샷으로 수집하여 콘솔에 덤프한다 */
export function dumpDebugSnapshot(): void {
	const store = useTrainStore.getState();
	const { rawPositions, interpolatedTrains, prevPollMap } = store;
	const now = performance.now();

	// trainNo → 각 단계 데이터 맵핑
	const rawMap = new Map(rawPositions.map((t) => [t.trainNo, t]));
	const interpMap = new Map(interpolatedTrains.map((t) => [t.trainNo, t]));

	const animatedStates = registeredAnimator?.getTrainList() ?? [];
	const animMap = new Map(animatedStates.map((t) => [t.trainNo, t]));

	// 모든 trainNo 수집
	const allTrainNos = new Set([
		...rawMap.keys(),
		...interpMap.keys(),
		...animMap.keys(),
	]);

	const snapshots: TrainSnapshot[] = [];

	for (const trainNo of allTrainNos) {
		const raw = rawMap.get(trainNo);
		const interp = interpMap.get(trainNo);
		const anim = animMap.get(trainNo);
		const poll = prevPollMap.get(trainNo);

		snapshots.push({
			trainNo,
			line: raw?.line ?? interp?.line ?? anim?.line ?? 0,
			raw: raw
				? {
						stationId: raw.stationId,
						stationName: raw.stationName,
						status: raw.status,
						direction: raw.direction,
					}
				: null,
			interpolated: interp
				? {
						x: Math.round(interp.x * 10) / 10,
						y: Math.round(interp.y * 10) / 10,
						progress: interp.progress,
						fromStationId: interp.fromStationId,
						toStationId: interp.toStationId,
						trackAngle: Math.round(interp.trackAngle * 1000) / 1000,
						direction: interp.direction,
					}
				: null,
			animated: anim
				? {
						currentX: Math.round(anim.currentX * 10) / 10,
						currentY: Math.round(anim.currentY * 10) / 10,
						targetX: Math.round(anim.targetX * 10) / 10,
						targetY: Math.round(anim.targetY * 10) / 10,
						startX: Math.round(anim.startX * 10) / 10,
						startY: Math.round(anim.startY * 10) / 10,
						fromStationId: anim.fromStationId,
						toStationId: anim.toStationId,
						trackAngle:
							anim.trackAngle !== undefined
								? Math.round(anim.trackAngle * 1000) / 1000
								: undefined,
						direction: anim.direction,
						duration: anim.duration,
						pathLength: anim.path.length,
						elapsed: Math.round(now - anim.startTime),
					}
				: null,
			pollHistory: poll
				? { missedCount: poll.missedCount }
				: null,
		});
	}

	// 호선별 정렬
	snapshots.sort((a, b) => a.line - b.line || a.trainNo.localeCompare(b.trainNo));

	// 요약 통계
	const summary = {
		timestamp: new Date().toISOString(),
		counts: {
			raw: rawPositions.length,
			interpolated: interpolatedTrains.length,
			animated: animatedStates.length,
		},
		byLine: {} as Record<number, number>,
		anomalies: [] as string[],
	};

	for (const s of snapshots) {
		summary.byLine[s.line] = (summary.byLine[s.line] ?? 0) + 1;

		// 이상 징후 감지
		if (s.raw !== null && s.interpolated === null) {
			summary.anomalies.push(`${s.trainNo}: raw 있으나 interpolated 없음 (역 좌표 매핑 실패?)`);
		}
		if (s.interpolated !== null && s.animated === null) {
			summary.anomalies.push(`${s.trainNo}: interpolated 있으나 animated 없음 (animator 미등록?)`);
		}
		if (s.animated !== null && s.interpolated !== null) {
			// 보간 좌표와 애니메이션 목표 좌표 불일치 감지
			const dx = s.animated.targetX - s.interpolated.x;
			const dy = s.animated.targetY - s.interpolated.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist > 50) {
				summary.anomalies.push(
					`${s.trainNo}: 보간↔애니메이션 목표 거리 ${dist.toFixed(0)}px (역방향 보정?)`,
				);
			}
		}
		if (s.animated !== null) {
			// 현재 위치와 목표 위치 방향 vs trackAngle 불일치
			const dx = s.animated.targetX - s.animated.currentX;
			const dy = s.animated.targetY - s.animated.currentY;
			const moveDist = Math.sqrt(dx * dx + dy * dy);
			if (moveDist > 5 && s.animated.trackAngle !== undefined) {
				const moveAngle = Math.atan2(dy, dx);
				const angleDiff = Math.abs(moveAngle - s.animated.trackAngle);
				const normalized = angleDiff > Math.PI ? Math.PI * 2 - angleDiff : angleDiff;
				if (normalized > Math.PI * 0.7) {
					summary.anomalies.push(
						`${s.trainNo}: 이동방향↔trackAngle 역방향 (diff=${(normalized * 180 / Math.PI).toFixed(0)}°)`,
					);
				}
			}
		}
	}

	const output = { summary, trains: snapshots };

	// biome-ignore lint/suspicious/noConsole: 디버그 스냅샷 전용 출력
	console.log(
		`%c[SNAPSHOT] ${summary.counts.raw} raw → ${summary.counts.interpolated} interp → ${summary.counts.animated} anim | 이상: ${summary.anomalies.length}건`,
		"color: #00ff88; font-weight: bold; font-size: 14px",
	);
	if (summary.anomalies.length > 0) {
		// biome-ignore lint/suspicious/noConsole: 디버그 스냅샷 전용 출력
		console.log("%c이상 징후:", "color: #ff4444; font-weight: bold");
		for (const a of summary.anomalies) {
			// biome-ignore lint/suspicious/noConsole: 디버그 스냅샷 전용 출력
			console.log(`  ⚠ ${a}`);
		}
	}
	// biome-ignore lint/suspicious/noConsole: 디버그 스냅샷 전용 출력
	console.log("%c전체 데이터 (copy 가능):", "color: #88aaff");
	// biome-ignore lint/suspicious/noConsole: 디버그 스냅샷 전용 출력
	console.log(JSON.stringify(output, null, 2));
}
