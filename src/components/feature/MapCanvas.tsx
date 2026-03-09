import { useEffect, useMemo, useRef } from "react";
import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import { handleStationTap } from "@/canvas/interactions/stationClick";
import { handleTrainTap } from "@/canvas/interactions/trainClick";
import { setupZoomPan } from "@/canvas/interactions/zoomPan";
import { drawLinks } from "@/canvas/objects/LineLink";
import { drawStationLabels } from "@/canvas/objects/StationLabel";
import { drawAllStations, updateStationAlpha } from "@/canvas/objects/StationNode";
import linksData from "@/data/links.json";
import stationsData from "@/data/stations.json";
import { useCoordTransform } from "@/hooks/useCoordTransform";
import { usePixiApp } from "@/hooks/usePixiApp";
import { useTrainPolling } from "@/hooks/useTrainPolling";
import { LABEL_FULL_SCALE, LABEL_SHOW_SCALE } from "@/constants/mapConfig";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station, StationLink } from "@/types/station";
import { buildAdjacencyMap } from "@/utils/stationNameResolver";

const STATIONS = stationsData as Station[];
const LINKS = linksData as StationLink[];

/** 줌 배율에 따른 레이블 alpha 값을 반환한다 */
function labelAlpha(scale: number): number {
	if (scale < LABEL_SHOW_SCALE) return 0;
	if (scale >= LABEL_FULL_SCALE) return 1;
	return (scale - LABEL_SHOW_SCALE) / (LABEL_FULL_SCALE - LABEL_SHOW_SCALE);
}

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
	const selectedStation = useStationStore((state) => state.selectedStation);
	const selectedTrainNo = useTrainStore((state) => state.selectedTrainNo);

	const adjacencyMap = useMemo(() => buildAdjacencyMap(LINKS), []);
	const animatorRef = useRef<TrainAnimator | null>(null);
	const selectedTrainNoRef = useRef<string | null>(null);

	// 역/링크 데이터를 스토어에 등록
	useEffect(() => {
		initStations(STATIONS, LINKS);
	}, [initStations]);

	// 실시간 열차 위치 폴링
	useTrainPolling(STATIONS, stationScreenMap, adjacencyMap);

	// scene이 준비되면 노선/역/레이블 렌더링 + 줌팬 설정 + ticker 등록
	useEffect(() => {
		if (scene === null) return;

		drawLinks(scene.linksLayer, LINKS, stationScreenMap);
		drawAllStations(scene.stationsLayer, STATIONS, stationScreenMap, handleStationTap);
		drawStationLabels(scene.labelsLayer, STATIONS, stationScreenMap);
		// 초기 레이블 숨김 (시맨틱 줌)
		scene.labelsLayer.alpha = 0;

		// TrainAnimator 초기화 및 ticker 등록
		const animator = new TrainAnimator();
		animator.setLayer(scene.trainsLayer);
		animator.setOnTrainTap(handleTrainTap);
		animatorRef.current = animator;

		// scene 재생성 시 스토어의 기존 열차 데이터로 즉시 복원
		const existingTrains = useTrainStore.getState().interpolatedTrains;
		if (existingTrains.length > 0) {
			animator.setTargets(existingTrains);
		}

		const tickerCallback = (): void => {
			animator.update();

			// 시맨틱 줌: 줌 배율에 따라 레이블 alpha 업데이트
			scene.labelsLayer.alpha = labelAlpha(scene.viewport.scale.x);

			// 선택된 열차 카메라 추적
			const trackedNo = selectedTrainNoRef.current;
			if (trackedNo !== null) {
				const state = animator.getTrainState(trackedNo);
				if (state !== undefined) {
					scene.viewport.x = window.innerWidth / 2 - state.currentX * scene.viewport.scale.x;
					scene.viewport.y = window.innerHeight / 2 - state.currentY * scene.viewport.scale.y;
				}
			}
		};
		scene.app.ticker.add(tickerCallback);

		const cleanupZoomPan = setupZoomPan({ viewport: scene.viewport, canvas: scene.canvas });

		return () => {
			scene.app.ticker.remove(tickerCallback);
			animator.clear();
			animatorRef.current = null;
			cleanupZoomPan();
		};
	}, [scene, stationScreenMap]);

	// selectedTrainNo 변경 시 ref 동기화
	useEffect(() => {
		selectedTrainNoRef.current = selectedTrainNo;
	}, [selectedTrainNo]);

	// 폴링 데이터가 갱신되면 애니메이터에 새 목표를 전달
	useEffect(() => {
		if (animatorRef.current === null) return;
		animatorRef.current.setTargets(interpolatedTrains);
	}, [interpolatedTrains]);

	// 역 선택 변경 시 linksLayer 딤 + stationAlpha 업데이트
	useEffect(() => {
		if (scene === null) return;
		const active = selectedStation !== null;
		scene.linksLayer.alpha = active ? 0.2 : 1.0;
		updateStationAlpha(scene.stationsLayer, STATIONS, selectedStation?.id ?? null);
	}, [scene, selectedStation]);

	return <div ref={containerRef} className="h-full w-full" />;
}
