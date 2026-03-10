import { useMemo } from "react";
import { HUD } from "@/components/feature/HUD";
import { LineFilter } from "@/components/feature/LineFilter";
import { MapCanvas } from "@/components/feature/MapCanvas";
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
					<HUD />
					<ToolBar />
					<div className="pointer-events-none absolute top-52 left-4">
						<SearchRoutePanel transferMap={transferMap} onStationSelect={handleStationSelect} />
					</div>
					<LineFilter />
					{!isRouteMode && <StationPanel />}
					{!isRouteMode && <TrainPanel />}
				</>
			}
		/>
	);
}
