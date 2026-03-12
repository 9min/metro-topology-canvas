import { Graphics } from "pixi.js";
import { useEffect, useMemo, useRef } from "react";
import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import { handleStationTap } from "@/canvas/interactions/stationClick";
import { handleTrainTap } from "@/canvas/interactions/trainClick";
import { flyToRoute, setupZoomPan } from "@/canvas/interactions/zoomPan";
import { computeLinkCongestion, drawCongestionHeatmap } from "@/canvas/objects/CongestionHeatmap";
import { drawLinks, updateLinksAlpha } from "@/canvas/objects/LineLink";
import { drawRoute, updateRoutePulse } from "@/canvas/objects/RoutePath";
import { drawStationLabels, updateLabelVisibility } from "@/canvas/objects/StationLabel";
import { drawAllStations, updateStationAlpha, updateStationSelectionRing } from "@/canvas/objects/StationNode";
import {
	drawTrails,
	pruneTrails,
	type TrailQueue,
	updateTrailQueues,
} from "@/canvas/objects/TrainTrail";
import {
	CONGESTION_UPDATE_FRAMES,
	INTRO_ZOOM_DURATION_MS,
	INTRO_ZOOM_END,
	INTRO_ZOOM_START,
	LABEL_FULL_SCALE,
	LABEL_SHOW_SCALE,
	TRAIL_FRAME_SKIP,
	TRAIL_MAX_POINTS,
} from "@/constants/mapConfig";
import linksData from "@/data/links.json";
import stationsData from "@/data/stations.json";
import { useCoordTransform } from "@/hooks/useCoordTransform";
import { usePixiApp } from "@/hooks/usePixiApp";
import { useSimulationPolling } from "@/hooks/useSimulationPolling";
import { useTrainPolling } from "@/hooks/useTrainPolling";
import { useMapStore } from "@/stores/useMapStore";
import { maybeUpdatePerfStore } from "@/stores/usePerfStore";
import { useRouteStore } from "@/stores/useRouteStore";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station, StationLink } from "@/types/station";
import { easeInOutCubic } from "@/utils/easing";
import { buildStationGraph } from "@/utils/pathFinder";
import { buildAdjacencyMap } from "@/utils/stationNameResolver";
import { buildTransferMap } from "@/utils/transferStation";
import { LoadingOverlay } from "./LoadingOverlay";

const STATIONS = stationsData as Station[];
const LINKS = linksData as StationLink[];

/** 줌 배율에 따른 레이블 alpha 값을 반환한다 */
function labelAlpha(scale: number): number {
	if (scale < LABEL_SHOW_SCALE) return 0;
	if (scale >= LABEL_FULL_SCALE) return 1;
	return (scale - LABEL_SHOW_SCALE) / (LABEL_FULL_SCALE - LABEL_SHOW_SCALE);
}

/** 인트로 줌 애니메이션을 진행한다 */
function tickIntroZoom(
	introState: { startTime: number; startX: number; startY: number; done: boolean },
	viewport: { scale: { set: (s: number) => void }; x: number; y: number },
	endX: number,
	endY: number,
): void {
	if (introState.done) return;
	const elapsed = performance.now() - introState.startTime;
	const t = Math.min(elapsed / INTRO_ZOOM_DURATION_MS, 1);
	const eased = easeInOutCubic(t);
	const currentScale = INTRO_ZOOM_START + (INTRO_ZOOM_END - INTRO_ZOOM_START) * eased;
	viewport.scale.set(currentScale);
	viewport.x = introState.startX + (endX - introState.startX) * eased;
	viewport.y = introState.startY + (endY - introState.startY) * eased;
	useMapStore.getState().setScale(currentScale);
	if (t >= 1) introState.done = true;
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
	const activeLines = useMapStore((state) => state.activeLines);
	const route = useRouteStore((state) => state.route);

	const adjacencyMap = useMemo(() => buildAdjacencyMap(LINKS), []);
	const stationGraph = useMemo(() => buildStationGraph(LINKS), []);
	const transferMap = useMemo(() => buildTransferMap(STATIONS), []);
	const animatorRef = useRef<TrainAnimator | null>(null);
	const trailMapRef = useRef<Map<string, TrailQueue>>(new Map());
	const frameCountRef = useRef(0);

	// 역/링크 데이터를 스토어에 등록
	useEffect(() => {
		initStations(STATIONS, LINKS);
	}, [initStations]);

	// 실시간 열차 위치 폴링 (live 모드에서만 동작)
	useTrainPolling(STATIONS, stationScreenMap, adjacencyMap);

	// 시뮬레이션 폴링 (simulation 모드에서만 동작)
	useSimulationPolling(LINKS, stationScreenMap);

	// scene이 준비되면 노선/역/레이블 렌더링 + 줌팬 설정 + ticker 등록
	useEffect(() => {
		if (scene === null) return;

		// 초기 뷰포트 스케일을 스토어에 동기화
		useMapStore.getState().setScale(scene.viewport.scale.x);

		// 초기 줌 인트로 애니메이션 상태
		const introState = {
			startTime: performance.now(),
			startX: scene.viewport.x,
			startY: scene.viewport.y,
			done: false,
		};
		// 최종 위치 계산 (화면 중앙 기준, 동일 월드 좌표를 INTRO_ZOOM_END 스케일로 표시)
		const centerWorldX = (window.innerWidth / 2 - introState.startX) / INTRO_ZOOM_START;
		const centerWorldY = (window.innerHeight / 2 - introState.startY) / INTRO_ZOOM_START;
		introState.startX = scene.viewport.x;
		introState.startY = scene.viewport.y;
		const endX = window.innerWidth / 2 - centerWorldX * INTRO_ZOOM_END;
		const endY = window.innerHeight / 2 - centerWorldY * INTRO_ZOOM_END;

		/** 역 클릭 핸들러: 경로 모드일 때는 출발/도착 설정 */
		const onStationTap = (station: Station): void => {
			const routeState = useRouteStore.getState();
			if (routeState.isRouteMode) {
				const { stations, links, stationMap } = useStationStore.getState();
				if (routeState.fromStation === null) {
					routeState.setFromStation(station);
				} else {
					routeState.setToStation(station, stations, links, stationMap);
				}
				// 경로 모드에서도 역 선택은 표시
				handleStationTap(station);
			} else {
				handleStationTap(station);
			}
		};

		drawLinks(scene.linksLayer, LINKS, stationScreenMap);
		drawAllStations(scene.stationsLayer, STATIONS, stationScreenMap, onStationTap, transferMap);
		const stationRingGfx = new Graphics();
		scene.stationsLayer.addChild(stationRingGfx);
		drawStationLabels(scene.labelsLayer, STATIONS, stationScreenMap);
		// 초기 레이블 숨김 (시맨틱 줌)
		scene.labelsLayer.alpha = 0;

		// TrainAnimator 초기화 및 ticker 등록
		const animator = new TrainAnimator();
		animator.setLayer(scene.trainsLayer);
		animator.setTrainLabelsLayer(scene.trainLabelsLayer);
		animator.setOnTrainTap(handleTrainTap);
		animatorRef.current = animator;

		// scene 재생성 시 스토어의 기존 열차 데이터로 즉시 복원
		const existingTrains = useTrainStore.getState().interpolatedTrains;
		if (existingTrains.length > 0) {
			animator.setTargets(existingTrains);
		}

		// 모션 트레일용 Graphics (단일 인스턴스 재사용)
		const trailGfx = new Graphics();
		scene.trailLayer.addChild(trailGfx);

		// 혼잡도 히트맵용 Graphics (단일 인스턴스 재사용)
		const heatmapGfx = new Graphics();
		scene.heatmapLayer.addChild(heatmapGfx);

		const tickerCallback = (): void => {
			const renderStart = performance.now();
			frameCountRef.current += 1;
			const frameCount = frameCountRef.current;

			tickIntroZoom(introState, scene.viewport, endX, endY);
			animator.update();

			// 모션 트레일
			const trainList = animator.getTrainList();
			updateTrailQueues(
				trailMapRef.current,
				trainList,
				frameCount,
				TRAIL_FRAME_SKIP,
				TRAIL_MAX_POINTS,
			);
			pruneTrails(trailMapRef.current, new Set(trainList.map((t) => t.trainNo)));
			const currentActiveLines = useMapStore.getState().activeLines;
			drawTrails(scene.trailLayer, trailGfx, trailMapRef.current, currentActiveLines);

			// 혼잡도 히트맵 (조건부, 30프레임마다)
			const isHeatmapOn = useMapStore.getState().heatmapEnabled;
			const hasActiveLines = currentActiveLines.size > 0;
			scene.heatmapLayer.visible = isHeatmapOn && hasActiveLines;
			if (isHeatmapOn && hasActiveLines && frameCount % CONGESTION_UPDATE_FRAMES === 0) {
				const activeLinks = LINKS.filter((l) => currentActiveLines.has(l.line));
				const congestion = computeLinkCongestion(activeLinks, trainList);
				drawCongestionHeatmap(heatmapGfx, activeLinks, stationScreenMap, congestion);
			}

			// 시맨틱 줌: 줌 배율에 따라 레이블 alpha + 충돌 감지
			const alpha = labelAlpha(scene.viewport.scale.x);
			scene.labelsLayer.alpha = alpha;
			if (alpha > 0) {
				updateLabelVisibility(
					scene.labelsLayer,
					scene.viewport.scale.x,
					scene.viewport.x,
					scene.viewport.y,
					currentActiveLines,
				);
			}

			// 경로 펄스 애니메이션
			const currentRoute = useRouteStore.getState().route;
			if (currentRoute !== null && currentRoute.length > 0) {
				const currentStationMap = useStationStore.getState().stationMap;
				updateRoutePulse(scene.routeLayer, currentRoute, currentStationMap);
			}

			// 역 선택 깜빡이는 외곽선
			const currentSelectedStation = useStationStore.getState().selectedStation;
			updateStationSelectionRing(stationRingGfx, currentSelectedStation, stationScreenMap);

			// 성능 측정 (250ms throttle)
			maybeUpdatePerfStore(
				scene.app.ticker.FPS,
				performance.now() - renderStart,
				animator.count,
				animator.poolSize,
			);
		};
		scene.app.ticker.add(tickerCallback);

		const cleanupZoomPan = setupZoomPan({ viewport: scene.viewport, canvas: scene.canvas });

		return () => {
			scene.app.ticker.remove(tickerCallback);
			animator.clear();
			animatorRef.current = null;
			cleanupZoomPan();
		};
	}, [scene, stationScreenMap, stationGraph, transferMap]);

	// 폴링 데이터가 갱신되면 애니메이터에 새 목표를 전달
	useEffect(() => {
		if (animatorRef.current === null) return;
		animatorRef.current.setTargets(interpolatedTrains);
	}, [interpolatedTrains]);

	// 노선 필터 변경 / 경로 활성 여부에 따라 linksLayer 딤 + 노선 alpha + stationAlpha 업데이트
	// 역 선택은 alpha에 영향을 주지 않는다 (깜빡이는 ring으로만 표시)
	useEffect(() => {
		if (scene === null) return;
		const hasRoute = route !== null && route.length > 0;
		scene.linksLayer.alpha = hasRoute ? 0.1 : 1.0;
		scene.stationsLayer.alpha = hasRoute ? 0.15 : 1.0;
		updateLinksAlpha(scene.linksLayer, activeLines);
		if (!hasRoute) {
			updateStationAlpha(
				scene.stationsLayer,
				STATIONS,
				null,
				activeLines,
				transferMap,
			);
		}
	}, [scene, activeLines, route]);

	// 경로 변경 시 routeLayer에 경로 렌더링 + 전체 경로가 보이도록 카메라 이동
	useEffect(() => {
		if (scene === null) return;
		if (route !== null && route.length > 0) {
			const stationMap = useStationStore.getState().stationMap;
			drawRoute(scene.routeLayer, route, stationScreenMap, stationMap);
			flyToRoute(scene.viewport, route, stationScreenMap);
		} else {
			scene.routeLayer.removeChildren();
		}
	}, [scene, route, stationScreenMap]);

	return (
		<>
			<div ref={containerRef} className="h-full w-full" />
			<LoadingOverlay />
		</>
	);
}
