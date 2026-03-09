/** 서울 지하철 운행 시간: 05:00 ~ 익일 01:00 */
const OPERATING_START_HOUR = 5;
const OPERATING_END_HOUR = 1;

/**
 * 현재 시각이 지하철 운행 시간 내인지 판별한다.
 * 운행 시간: 05:00 ~ 익일 01:00 (심야 01:00~05:00은 비운행)
 */
export function isOperatingHours(now: Date = new Date()): boolean {
	const hour = now.getHours();
	// 05:00 이상이거나 01:00 미만이면 운행 시간
	return hour >= OPERATING_START_HOUR || hour < OPERATING_END_HOUR;
}

/**
 * 다음 운행 시작까지 남은 밀리초를 반환한다.
 * 이미 운행 중이면 0을 반환한다.
 */
export function msUntilOperatingStart(now: Date = new Date()): number {
	if (isOperatingHours(now)) return 0;

	const next = new Date(now);
	next.setHours(OPERATING_START_HOUR, 0, 0, 0);

	// 이미 05시가 지났을 수 없으므로 (01~05시 사이) 당일 05시까지
	return next.getTime() - now.getTime();
}
