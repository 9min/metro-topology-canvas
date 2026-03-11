import { OVERLAY_TOOLBAR } from "@/constants/overlayStyles";
import { useDebugStore } from "@/stores/useDebugStore";

/** 토글 상태에 따른 뱃지 색상 */
function badgeClass(active: boolean): string {
	return active ? "text-green-400" : "text-gray-500";
}

/**
 * 디버그 모드 HUD — 좌하단 고정.
 * D 키로 디버그 모드를 활성화하면 표시된다.
 */
export function DebugOverlay() {
	const { debugMode, skipAnimation, showTargetMarkers } = useDebugStore();

	if (!debugMode) return null;

	return (
		<div
			className={`pointer-events-auto absolute bottom-4 left-4 ${OVERLAY_TOOLBAR} px-3 py-2 font-mono text-xs`}
		>
			<div className="text-yellow-400">DEBUG</div>
			<div className={badgeClass(debugMode)}>[D] 열차번호: ON</div>
			<div className={badgeClass(skipAnimation)}>[A] 즉시점프: {skipAnimation ? "ON" : "OFF"}</div>
			<div className={badgeClass(showTargetMarkers)}>
				[T] 목표마커: {showTargetMarkers ? "ON" : "OFF"}
			</div>
			<div className="text-gray-500">[S] 스냅샷 덤프</div>
		</div>
	);
}
