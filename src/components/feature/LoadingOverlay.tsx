import { useTrainStore } from "@/stores/useTrainStore";

/**
 * 시뮬레이션 초기화 중에 화면 중앙에 표시되는 로딩 오버레이.
 * isInitializing이 true인 동안에만 렌더링된다.
 */
export function LoadingOverlay() {
	const isInitializing = useTrainStore((s) => s.isInitializing);

	if (!isInitializing) return null;

	return (
		<div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-[#0a0a0f]/80 backdrop-blur-sm">
			<div className="rounded-2xl bg-white/5 border border-white/10 px-12 py-8">
				<div className="flex flex-col items-center gap-4">
					<div className="relative h-12 w-12">
						<div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-400" />
						<div className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-t-purple-400 [animation-direction:reverse] [animation-duration:0.8s]" />
						<div className="absolute inset-0 flex items-center justify-center text-lg">🚇</div>
					</div>
					<p className="text-sm text-gray-400">열차 배치 중...</p>
				</div>
			</div>
		</div>
	);
}
