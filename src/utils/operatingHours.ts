/** 서울 지하철 운행 시간: 05:30 ~ 익일 01:00 */
const OPERATING_START_HOUR = 5;
const OPERATING_START_MINUTE = 30;
const OPERATING_END_HOUR = 1;

/**
 * 현재 시각이 지하철 운행 시간 내인지 판별한다.
 * 운행 시간: 05:30 ~ 익일 01:00 (심야 01:00~05:29은 비운행)
 */
export function isOperatingHours(now: Date = new Date()): boolean {
	const hour = now.getHours();
	const minute = now.getMinutes();
	// 05:30 이상이거나 01:00 미만이면 운행 시간
	return (
		hour > OPERATING_START_HOUR ||
		(hour === OPERATING_START_HOUR && minute >= OPERATING_START_MINUTE) ||
		hour < OPERATING_END_HOUR
	);
}

/**
 * 다음 운행 시작까지 남은 밀리초를 반환한다.
 * 이미 운행 중이면 0을 반환한다.
 */
export function msUntilOperatingStart(now: Date = new Date()): number {
	if (isOperatingHours(now)) return 0;

	const next = new Date(now);
	next.setHours(OPERATING_START_HOUR, OPERATING_START_MINUTE, 0, 0);

	// 이미 05:30이 지났을 수 없으므로 (01:00~05:29 사이) 당일 05:30까지
	return next.getTime() - now.getTime();
}
