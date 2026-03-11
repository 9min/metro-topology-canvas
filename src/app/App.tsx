import { useMemo } from "react";
import { HUD } from "@/components/feature/HUD";
import { LineFilter } from "@/components/feature/LineFilter";
import { MapCanvas } from "@/components/feature/MapCanvas";
import { MobileTopBar } from "@/components/feature/MobileTopBar";
import { SearchRoutePanel } from "@/components/feature/SearchRoutePanel";
import { StationPanel } from "@/components/feature/StationPanel";
import { ToolBar } from "@/components/feature/ToolBar";
import { TrainPanel } from "@/components/feature/TrainPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import stationsData from "@/data/stations.json";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useRouteStore } from "@/stores/useRouteStore";
import { useStationStore } from "@/stores/useStationStore";
import type { Station } from "@/types/station";
import { buildTransferMap } from "@/utils/transferStation";

const STATIONS = stationsData as Station[];

/** 검색/경로에서 역 선택 시 카메라 이동을 위한 이벤트 발행 */
function useStationSelectHandler() {
	const selectStation = useStationStore((s) => s.selectStation);
	return (station: Station) => {
		selectStation(station);
		// flyToStation은 MapCanvas 내부에서 selectedStation 변경 감지로 처리
	};
}

export function App() {
	useKeyboardShortcuts();

	const transferMap = useMemo(() => buildTransferMap(STATIONS), []);
	const isRouteMode = useRouteStore((s) => s.isRouteMode);
	const handleStationSelect = useStationSelectHandler();

	return (
		<AppLayout
			canvas={<MapCanvas />}
			panel={
				<>
					{/* 모바일 전용: ModeSwitch + ToolBar 통합 상단 바 */}
					<MobileTopBar />

					{/* HUD: 모바일에서 ModeSwitch 숨김 + LineFilter 아래 위치, 데스크톱 기존 유지 */}
					<HUD />

					{/* ToolBar: 모바일 숨김 (MobileTopBar가 대체), 데스크톱만 표시 */}
					<ToolBar />

					{/* LineFilter: 모바일 top-12 (통합 바 아래), 데스크톱 top-4 */}
					<LineFilter />

					{/* SearchRoutePanel: 모바일 하단 고정, 데스크톱 좌측 중단 */}
					<div className="pointer-events-none absolute bottom-4 left-4 sm:bottom-auto sm:top-52">
						<SearchRoutePanel transferMap={transferMap} onStationSelect={handleStationSelect} />
					</div>

					{!isRouteMode && <StationPanel />}
					{!isRouteMode && <TrainPanel />}
				</>
			}
		/>
	);
}
