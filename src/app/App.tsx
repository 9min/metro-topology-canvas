import { MapCanvas } from "@/components/feature/MapCanvas";
import { StationPanel } from "@/components/feature/StationPanel";
import { TrainPanel } from "@/components/feature/TrainPanel";
import { AppLayout } from "@/components/layout/AppLayout";

export function App() {
	return (
		<AppLayout
			canvas={<MapCanvas />}
			panel={
				<>
					<StationPanel />
					<TrainPanel />
				</>
			}
		/>
	);
}
