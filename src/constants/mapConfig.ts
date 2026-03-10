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

/** API 폴링 주기 (ms) — 30초 */
export const POLLING_INTERVAL_MS = 30_000;

/** 열차 애니메이션 지속 시간 (ms) — 폴링 전체 주기를 채워 연속 이동처럼 보이게 한다 */
export const TRAIN_ANIMATION_DURATION_MS = POLLING_INTERVAL_MS;

/** 신규 열차 페이드인 시간 (ms) */
export const TRAIN_FADEIN_MS = 500;

/** 시뮬레이션 모드 폴링 주기 (ms) — 짧은 주기로 끊김 없는 연속 이동 */
export const SIMULATION_TICK_MS = 6_000;

/** 시뮬레이션 모드 노선별 열차 수 (상행 + 하행) — 총 250대 */
export const SIMULATION_TRAINS_PER_LINE: Record<number, number> = {
	1: 40,
	2: 30,
	3: 28,
	4: 28,
	5: 32,
	6: 22,
	7: 28,
	8: 18,
	9: 24,
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

/** 시뮬레이션: 일반 역 정차 틱 수 (1틱 = 3초) */
export const SIM_DWELL_TICKS = 1;

/** 시뮬레이션: 종점 정차 틱 수 (2틱 = 6초, 방향 전환 대기) */
export const SIM_TERMINAL_DWELL_TICKS = 2;

/** 열차 애니메이션 최대 허용 거리 (px) — 초과 시 즉시 텔레포트 */
export const MAX_TRAIN_ANIM_DIST = 500;
