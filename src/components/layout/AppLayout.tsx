import type { ReactNode } from "react";
import { PerfMonitor } from "@/components/feature/PerfMonitor";

interface AppLayoutProps {
	canvas: ReactNode;
	panel: ReactNode;
}

/** 전체 레이아웃: 캔버스 영역 + 패널 오버레이 */
export function AppLayout({ canvas, panel }: AppLayoutProps) {
	return (
		<div className="relative h-screen w-screen overflow-hidden bg-[#0a0a0f]">
			<div className="h-full w-full">{canvas}</div>
			<div className="pointer-events-none absolute inset-0">
				{panel}
				<PerfMonitor />
			</div>
		</div>
	);
}
