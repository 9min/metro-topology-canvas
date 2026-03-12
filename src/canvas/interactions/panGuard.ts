/** 패닝 감지 임계값 (px) — 이 거리 이상 이동하면 패닝으로 판단한다 */
const PAN_THRESHOLD = 8;

let _panned = false;
let _startX = 0;
let _startY = 0;

/** 포인터 다운 시 패닝 상태를 초기화한다 */
export function resetPanGuard(x: number, y: number): void {
	_panned = false;
	_startX = x;
	_startY = y;
}

/** 포인터 이동 시 총 이동 거리로 패닝 여부를 갱신한다 */
export function updatePanGuard(x: number, y: number): void {
	if (_panned) return;
	const dx = Math.abs(x - _startX);
	const dy = Math.abs(y - _startY);
	if (dx > PAN_THRESHOLD || dy > PAN_THRESHOLD) {
		_panned = true;
	}
}

/** 마지막 포인터 업 직전까지 패닝이 발생했으면 true를 반환한다 */
export function wasPanning(): boolean {
	return _panned;
}
