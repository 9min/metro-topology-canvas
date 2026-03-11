/**
 * 열차 디버그 로거 유틸리티.
 * localStorage("TRAIN_DEBUG") 기반으로 활성화한다.
 * - "true" → 전체 열차 추적
 * - "2184,3021" → 특정 trainNo만 추적
 * - 미설정/"false" → 비활성
 *
 * 2초 캐시로 localStorage 접근을 최소화한다.
 * biome noConsole 규칙에서 warn만 허용하므로 console.warn을 사용한다.
 */

const PREFIX = "[TRAIN-DEBUG]";
const CACHE_TTL_MS = 2000;

let cachedConfig: { enabled: boolean; targets: Set<string> | null } = {
	enabled: false,
	targets: null,
};
let cacheTimestamp = 0;

/** localStorage에서 설정을 읽고 캐시한다 */
function refreshConfig(): void {
	const now = Date.now();
	if (now - cacheTimestamp < CACHE_TTL_MS) return;
	cacheTimestamp = now;

	try {
		const raw = localStorage.getItem("TRAIN_DEBUG");
		if (raw === null || raw === "false" || raw === "") {
			cachedConfig = { enabled: false, targets: null };
			return;
		}
		if (raw === "true") {
			cachedConfig = { enabled: true, targets: null };
			return;
		}
		// 쉼표로 구분된 trainNo 목록
		const targets = new Set(
			raw
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		);
		cachedConfig = { enabled: targets.size > 0, targets };
	} catch {
		cachedConfig = { enabled: false, targets: null };
	}
}

/** 해당 trainNo가 추적 대상인지 확인한다 */
function shouldLog(trainNo: string): boolean {
	refreshConfig();
	if (!cachedConfig.enabled) return false;
	if (cachedConfig.targets === null) return true;
	return cachedConfig.targets.has(trainNo);
}

/** 전체 로깅이 활성화되어 있는지 확인한다 (trainNo 무관 요약 로그용) */
export function isDebugEnabled(): boolean {
	refreshConfig();
	return cachedConfig.enabled;
}

/** 폴링 단계: API 원본 vs 역명 해석 결과 */
export function logPollResult(
	trainNo: string,
	details: {
		stationName: string;
		resolvedId: string | undefined;
		line: number;
		status: string;
	},
): void {
	if (!shouldLog(trainNo)) return;
	const { stationName, resolvedId, line, status } = details;
	const resolved = resolvedId ?? "❌실패";
	console.warn(
		`${PREFIX} [POLL] 열차=${trainNo} 호선=${line} 역명="${stationName}" → ${resolved} 상태=${status}`,
	);
}

/** 폴링 요약: raw 개수 vs resolved 개수 */
export function logPollSummary(source: string, rawCount: number, resolvedCount: number): void {
	if (!isDebugEnabled()) return;
	console.warn(
		`${PREFIX} [POLL-SUMMARY] ${source}: raw=${rawCount} → resolved=${resolvedCount} (드롭=${rawCount - resolvedCount})`,
	);
}

/** 보간 단계: progress, from/to */
export function logInterpolation(
	trainNo: string,
	details: {
		progress: number;
		fromStationId: string;
		toStationId: string;
		x: number;
		y: number;
		status: string;
	},
): void {
	if (!shouldLog(trainNo)) return;
	const { progress, fromStationId, toStationId, x, y, status } = details;
	console.warn(
		`${PREFIX} [INTERP] 열차=${trainNo} 상태=${status} progress=${progress.toFixed(3)} from=${fromStationId} to=${toStationId} pos=(${x.toFixed(1)},${y.toFixed(1)})`,
	);
}

/** 경로 구성 단계: 직선 fallback 이유, BFS 결과 */
export function logPathBuild(
	trainNo: string,
	details: {
		reason: string;
		prevToStation?: string;
		newFromStation?: string;
		pathLength?: number;
		dot?: number;
	},
): void {
	if (!shouldLog(trainNo)) return;
	const { reason, prevToStation, newFromStation, pathLength, dot } = details;
	const extra = [
		prevToStation !== undefined ? `prevTo=${prevToStation}` : "",
		newFromStation !== undefined ? `newFrom=${newFromStation}` : "",
		pathLength !== undefined ? `pathLen=${pathLength}` : "",
		dot !== undefined ? `dot=${dot.toFixed(3)}` : "",
	]
		.filter(Boolean)
		.join(" ");
	console.warn(`${PREFIX} [PATH] 열차=${trainNo} ${reason} ${extra}`);
}

/** 애니메이션 갱신 단계: 텔레포트 판정, 역방향 감지 */
export function logAnimUpdate(
	trainNo: string,
	details: {
		event: string;
		totalDist?: number;
		dot?: number;
		trackAngle?: number;
		moveAngle?: number;
		duration?: number;
	},
): void {
	if (!shouldLog(trainNo)) return;
	const { event, totalDist, dot, trackAngle, moveAngle, duration } = details;
	const extra = [
		totalDist !== undefined ? `dist=${totalDist.toFixed(1)}` : "",
		dot !== undefined ? `dot=${dot.toFixed(3)}` : "",
		trackAngle !== undefined ? `trackAngle=${trackAngle.toFixed(3)}` : "",
		moveAngle !== undefined ? `moveAngle=${moveAngle.toFixed(3)}` : "",
		duration !== undefined ? `duration=${duration}ms` : "",
	]
		.filter(Boolean)
		.join(" ");
	console.warn(`${PREFIX} [ANIM] 열차=${trainNo} ${event} ${extra}`);
}

/** 스토어 단계: pollHistory 상세 */
export function logStoreUpdate(
	trainNo: string,
	details: {
		lastDifferentStationId: string | undefined;
		stationId: string;
		status: string;
	},
): void {
	if (!shouldLog(trainNo)) return;
	const { lastDifferentStationId, stationId, status } = details;
	console.warn(
		`${PREFIX} [STORE] 열차=${trainNo} 역=${stationId} 상태=${status} lastDiff=${lastDifferentStationId ?? "없음"}`,
	);
}
