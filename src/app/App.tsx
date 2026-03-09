import { MapCanvas } from "@/components/feature/MapCanvas";
import { HUD } from "@/components/feature/HUD";
import { StationPanel } from "@/components/feature/StationPanel";
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
					<StationPanel />
					<TrainPanel />
				</>
			}
		/>
	);
}
