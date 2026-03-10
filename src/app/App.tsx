import { HUD } from "@/components/feature/HUD";
import { LineFilter } from "@/components/feature/LineFilter";
import { MapCanvas } from "@/components/feature/MapCanvas";
import { StationPanel } from "@/components/feature/StationPanel";
import { ToolBar } from "@/components/feature/ToolBar";
import { TrainPanel } from "@/components/feature/TrainPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function App() {
	useKeyboardShortcuts();

	return (
		<AppLayout
			canvas={<MapCanvas />}
			panel={
				<>
					<HUD />
					<ToolBar />
					<LineFilter />
					<StationPanel />
					<TrainPanel />
				</>
			}
		/>
	);
}
