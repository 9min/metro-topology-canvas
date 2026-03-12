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

/** SMSS 폴링 주기 (ms) — 10초 (1~8호선, 한도 없음) */
export const SMSS_POLLING_INTERVAL_MS = 5_000;

/** 서울열린데이터광장 API 폴링 주기 (ms) — 30초 (9호선, 일일 한도 있음) */
export const API_POLLING_INTERVAL_MS = 30_000;

/** 열차 역간 이동 기준 시간 (ms) — 45초에 구간 1개 통과 */
export const SEGMENT_TRAVEL_MS = 45_000;

/** 신규 열차 페이드인 시간 (ms) */
export const TRAIN_FADEIN_MS = 500;

/** 시뮬레이션 모드 폴링 주기 (ms) — 0.5초 주기로 구간 경계 대기 최소화 */
export const SIMULATION_TICK_MS = 500;

/** 시뮬레이션 모드 노선별 열차 수 (상행 + 하행) — 총 300대 */
export const SIMULATION_TRAINS_PER_LINE: Record<number, number> = {
	1: 48,
	2: 36,
	3: 34,
	4: 34,
	5: 38,
	6: 26,
	7: 34,
	8: 22,
	9: 28,
};

/** 열차 캡슐 반길이 (이동 방향 축, px) */
export const TRAIN_CAPSULE_LENGTH = 6;

/** 열차 캡슐 반폭 (수직 축, px) */
export const TRAIN_CAPSULE_WIDTH = 2.4;

/** 시맨틱 줌: 역 이름 레이블 표시 시작 임계 줌 배율 */
export const LABEL_SHOW_SCALE = 0.7;

/** 시맨틱 줌: 역 이름 레이블 완전 표시 줌 배율 */
export const LABEL_FULL_SCALE = 1.2;

/** 초기 줌 애니메이션: 시작 배율 (전체 노선 조감) */
export const INTRO_ZOOM_START = 0.4;

/** 초기 줌 애니메이션: 최종 배율 (열차 상세 관찰) */
export const INTRO_ZOOM_END = 1.5;

/** 초기 줌 애니메이션: 지속 시간 (ms) */
export const INTRO_ZOOM_DURATION_MS = 3_000;

/** 모션 트레일: 최대 포인트 수 */
export const TRAIL_MAX_POINTS = 20;

/** 모션 트레일: 몇 프레임마다 포인트를 추가할지 */
export const TRAIL_FRAME_SKIP = 2;

/** 모션 트레일: 선 최대 alpha */
export const TRAIL_MAX_ALPHA = 0.6;

/** 모션 트레일: 선 최대 두께 (px) */
export const TRAIL_MAX_WIDTH = 3.5;

/** 혼잡도 히트맵: 몇 프레임마다 갱신할지 */
export const CONGESTION_UPDATE_FRAMES = 30;

/** 혼잡도 히트맵: 선 두께 배수 */
export const CONGESTION_LINE_WIDTH_FACTOR = 2.5;

/** 성능 모니터: 업데이트 주기 (ms) */
export const PERF_UPDATE_INTERVAL_MS = 250;

/** 열차 grace period: 폴링에서 누락되어도 유지할 폴 횟수 */
export const TRAIN_GRACE_POLL_COUNT = 2;

/** 열차 페이드아웃 지속 시간 (ms) */
export const TRAIN_FADEOUT_MS = 1500;

/** 모드 전환 시 로딩 오버레이 표시 시간 (ms) */
export const MODE_LOADING_MS = 3_000;

/** 예상 밖 구간 변경 경고 마커 표시 지속 시간 (ms) */
export const UNEXPECTED_MARKER_DURATION_MS = 2_500;
