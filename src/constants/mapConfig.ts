import type { MapBounds } from "@/types/map";

/** 서울 지하철 네트워크 GPS 경계 범위 (수도권 전체) */
export const MAP_BOUNDS: MapBounds = {
	minLon: 126.6,
	maxLon: 127.25,
	minLat: 37.25,
	maxLat: 37.96,
};

/** 기본 캔버스 크기 */
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;

/** 캔버스 여백 (px) */
export const CANVAS_PADDING = 60;

/** 줌 범위 및 속도 */
export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 6;
export const ZOOM_SPEED = 0.001;

/** 역 원 반지름 (px) */
export const STATION_RADIUS = 6;
export const STATION_RADIUS_HOVER = 9;

/** 노선 두께 (px) */
export const LINE_WIDTH = 3;

/** 열차 입자 반지름 (px) */
export const TRAIN_PARTICLE_RADIUS = 4;

/** API 폴링 주기 (ms) — 90초 (하루 ~960건, 1000건 한도 내) */
export const POLLING_INTERVAL_MS = 90_000;

/** 열차 애니메이션 지속 시간 (ms) — 폴링 간격의 대부분을 부드럽게 채운다 */
export const TRAIN_ANIMATION_DURATION_MS = 2_000;

/** 신규 열차 페이드인 시간 (ms) */
export const TRAIN_FADEIN_MS = 500;
