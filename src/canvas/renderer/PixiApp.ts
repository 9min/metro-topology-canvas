import { Application, Container } from "pixi.js";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/constants/mapConfig";

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

	// 뷰포트 컨테이너 (줌/팬 대상) — 지도를 화면 중앙에 배치
	const viewport = new Container();
	viewport.eventMode = "static";
	viewport.x = Math.round((window.innerWidth - CANVAS_WIDTH) / 2);
	viewport.y = Math.round((window.innerHeight - CANVAS_HEIGHT) / 2);
	app.stage.addChild(viewport);

	const linksLayer = new Container();
	const stationsLayer = new Container();
	stationsLayer.eventMode = "static";
	const trainsLayer = new Container();
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
