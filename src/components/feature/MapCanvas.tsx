import { useEffect, useMemo, useRef } from "react";
import { handleStationTap } from "@/canvas/interactions/stationClick";
import { setupZoomPan } from "@/canvas/interactions/zoomPan";
import { drawLinks } from "@/canvas/objects/LineLink";
import { drawAllStations } from "@/canvas/objects/StationNode";
import { drawTrains } from "@/canvas/objects/TrainParticle";
import linksData from "@/data/links.json";
import stationsData from "@/data/stations.json";
import { useCoordTransform } from "@/hooks/useCoordTransform";
import { usePixiApp } from "@/hooks/usePixiApp";
import { useTrainPolling } from "@/hooks/useTrainPolling";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station, StationLink } from "@/types/station";
import { buildAdjacencyMap } from "@/utils/stationNameResolver";

const STATIONS = stationsData as Station[];
const LINKS = linksData as StationLink[];

/**
 * PixiJS 지도 캔버스 오케스트레이터 컴포넌트.
 * canvas 엘리먼트는 usePixiApp 내부에서 생성하여 containerRef div에 추가된다.
 */
export function MapCanvas() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const scene = usePixiApp(containerRef);
	const { stationScreenMap } = useCoordTransform(STATIONS);
	const initStations = useStationStore((state) => state.initStations);
	const interpolatedTrains = useTrainStore((state) => state.interpolatedTrains);

	const adjacencyMap = useMemo(() => buildAdjacencyMap(LINKS), []);

	// 역/링크 데이터를 스토어에 등록
	useEffect(() => {
		initStations(STATIONS, LINKS);
	}, [initStations]);

	// 실시간 열차 위치 폴링
	useTrainPolling(STATIONS, stationScreenMap, adjacencyMap);

	// scene이 준비되면 노선/역 렌더링 + 줌팬 설정
	useEffect(() => {
		if (scene === null) return;

		drawLinks(scene.linksLayer, LINKS, stationScreenMap);
		drawAllStations(scene.stationsLayer, STATIONS, stationScreenMap, handleStationTap);

		const cleanupZoomPan = setupZoomPan({ viewport: scene.viewport, canvas: scene.canvas });
		return cleanupZoomPan;
	}, [scene, stationScreenMap]);

	// 열차 위치 갱신 시 입자 재렌더링
	useEffect(() => {
		if (scene === null) return;
		drawTrains(scene.trainsLayer, interpolatedTrains);
	}, [scene, interpolatedTrains]);

	return <div ref={containerRef} className="h-full w-full" />;
}
