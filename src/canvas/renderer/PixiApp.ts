import { Application, Container } from "pixi.js";
import { CANVAS_HEIGHT, CANVAS_PADDING, CANVAS_WIDTH, MAP_BOUNDS } from "@/constants/mapConfig";

export interface PixiScene {
	app: Application;
	/** createPixiApp에 전달된 canvas 엘리먼트 */
	canvas: HTMLCanvasElement;
	viewport: Container;
	linksLayer: Container;
	stationsLayer: Container;
	trainsLayer: Container;
	labelsLayer: Container;
	destroy: () => void;
}

/**
 * PixiJS Application을 비동기로 초기화하고 레이어 구조를 생성한다.
 * resizeTo: canvas의 부모 요소로 자동 크기 조정한다.
 */
export async function createPixiApp(canvas: HTMLCanvasElement): Promise<PixiScene> {
	const app = new Application();

	await app.init({
		canvas,
		width: window.innerWidth,
		height: window.innerHeight,
		backgroundColor: 0x0a0a0f,
		antialias: true,
		autoDensity: true,
		resolution: window.devicePixelRatio || 1,
	});

	// 뷰포트 컨테이너 (줌/팬 대상) — 용산역을 화면 중앙에 배치
	const viewport = new Container();
	viewport.eventMode = "static";

	// 초기 줌 배율 (레이블이 보이기 시작하는 정도)
	const initScale = 0.78;
	viewport.scale.set(initScale);

	// 용산역 GPS(126.964, 37.53)를 월드 좌표로 변환하여 화면 중앙에 배치
	const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
	const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
	const drawW = CANVAS_WIDTH - CANVAS_PADDING * 2;
	const drawH = CANVAS_HEIGHT - CANVAS_PADDING * 2;
	const yongsanWorldX = ((126.964 - MAP_BOUNDS.minLon) / lonRange) * drawW + CANVAS_PADDING;
	const yongsanWorldY = ((MAP_BOUNDS.maxLat - 37.53) / latRange) * drawH + CANVAS_PADDING;

	viewport.x = Math.round(window.innerWidth / 2 - yongsanWorldX * initScale);
	viewport.y = Math.round(window.innerHeight / 2 - yongsanWorldY * initScale);
	app.stage.addChild(viewport);

	const linksLayer = new Container();
	const stationsLayer = new Container();
	stationsLayer.eventMode = "static";
	const trainsLayer = new Container();
	trainsLayer.eventMode = "static";
	const labelsLayer = new Container();

	viewport.addChild(linksLayer);
	viewport.addChild(stationsLayer);
	viewport.addChild(trainsLayer);
	viewport.addChild(labelsLayer);

	const destroy = (): void => {
		app.destroy(false, { children: true });
	};

	return { app, canvas, viewport, linksLayer, stationsLayer, trainsLayer, labelsLayer, destroy };
}
