import { SEGMENT_TRAVEL_MS } from "@/constants/mapConfig";

/** localStorage에 저장되는 열차 위치 스냅샷 */
export interface TrainSnapshot {
	/** 마지막으로 알려진 현재 역 ID */
	stationId: string;
	/** 마지막으로 알려진 다음 역 ID */
	nextStationId: string;
	/** 저장 시점의 열차 상태 */
	status: "진입" | "도착" | "출발";
	/** 저장 시각 (ms, Date.now()) */
	savedAt: number;
}

/** 전체 스냅샷을 단일 키로 저장 */
const SNAPSHOT_KEY = "train_snapshots";
/** 스냅샷 유효 기간: 2분 (SEGMENT_TRAVEL_MS × ~2.6) */
const SNAPSHOT_TTL_MS = 2 * 60 * 1000;

/**
 * 전체 열차 스냅샷 맵을 localStorage에 저장한다.
 * Private 모드 등 실패 시 조용히 무시한다.
 */
export function saveAllSnapshots(
	snapshots: Map<string, TrainSnapshot>,
): void {
	try {
		const obj: Record<string, TrainSnapshot> = {};
		for (const [trainNo, snapshot] of snapshots) {
			obj[trainNo] = snapshot;
		}
		localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(obj));
	} catch {
		// localStorage 쓰기 실패 시 무시 (Private 모드, 용량 초과 등)
	}
}

/**
 * localStorage에서 전체 열차 스냅샷 맵을 로드한다.
 * TTL(2분) 초과 항목은 로드 시 자동 필터링한다.
 */
export function loadAllSnapshots(): Map<string, TrainSnapshot> {
	try {
		const raw = localStorage.getItem(SNAPSHOT_KEY);
		if (raw === null) return new Map();

		const obj = JSON.parse(raw) as Record<string, TrainSnapshot>;
		const now = Date.now();
		const result = new Map<string, TrainSnapshot>();

		for (const [trainNo, snapshot] of Object.entries(obj)) {
			if (now - snapshot.savedAt <= SNAPSHOT_TTL_MS) {
				result.set(trainNo, snapshot);
			}
		}
		return result;
	} catch {
		return new Map();
	}
}

/**
 * 스냅샷에서 simProgress를 역산한다.
 * 같은 구간에서 경과한 시간을 SEGMENT_TRAVEL_MS로 나눠 추정한다.
 *
 * @returns 추정 진행률 [0, 0.99], 추정 불가 시 undefined
 */
export function estimateSimProgress(
	currentStationId: string,
	snapshot: TrainSnapshot,
): number | undefined {
	// 같은 구간인지 확인 (리로드 전과 동일한 역)
	if (snapshot.stationId !== currentStationId) return undefined;

	const elapsed = Date.now() - snapshot.savedAt;
	if (elapsed >= SNAPSHOT_TTL_MS) return undefined;

	return Math.min(elapsed / SEGMENT_TRAVEL_MS, 0.99);
}
