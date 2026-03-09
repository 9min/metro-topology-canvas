import type { MapBounds } from "@/types/map";

/** 서울 지하철 네트워크 GPS 경계 범위 (수도권 전체) */
export const MAP_BOUNDS: MapBounds = {
	minLon: 126.6,
	maxLon: 127.25,
	minLat: 37.25,
	maxLat: 37.96,
};

/** 기본 캔버스 크기 (가상 월드 좌표계) */
export const CANVAS_WIDTH = 3000;
export const CANVAS_HEIGHT = 2000;

/** 캔버스 여백 (px) */
export const CANVAS_PADDING = 100;

/** 줌 범위 및 속도 */
export const ZOOM_MIN = 0.15;
export const ZOOM_MAX = 6;
export const ZOOM_SPEED = 0.001;

/** 역 원 반지름 (px) */
export const STATION_RADIUS = 4;
export const STATION_RADIUS_HOVER = 7;

/** 노선 두께 (px) */
export const LINE_WIDTH = 2.6;

/** 열차 입자 반지름 (px) */
export const TRAIN_PARTICLE_RADIUS = 3;

/** API 폴링 주기 (ms) — 90초 (하루 ~960건, 1000건 한도 내) */
export const POLLING_INTERVAL_MS = 90_000;

/** 열차 애니메이션 지속 시간 (ms) — 폴링 전체 주기를 채워 연속 이동처럼 보이게 한다 */
export const TRAIN_ANIMATION_DURATION_MS = POLLING_INTERVAL_MS;

/** 신규 열차 페이드인 시간 (ms) */
export const TRAIN_FADEIN_MS = 500;

/** 시뮬레이션 모드 폴링 주기 (ms) — 빠른 업데이트로 활발한 움직임 */
export const SIMULATION_TICK_MS = 12_000;

/** 시뮬레이션 모드 노선별 열차 수 (상행 + 하행) */
export const SIMULATION_TRAINS_PER_LINE: Record<number, number> = {
	1: 14,
	2: 10,
	3: 10,
	4: 10,
	5: 12,
	6: 8,
	7: 10,
	8: 6,
	9: 8,
};

/** 시맨틱 줌: 역 이름 레이블 표시 시작 임계 줌 배율 */
export const LABEL_SHOW_SCALE = 0.7;

/** 시맨틱 줌: 역 이름 레이블 완전 표시 줌 배율 */
export const LABEL_FULL_SCALE = 1.2;
