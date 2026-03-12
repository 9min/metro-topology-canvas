/** 서울열린데이터광장 실시간 열차 위치 API 원시 응답 항목 */
export interface SeoulApiTrainRaw {
	subwayId: string;
	subwayNm: string;
	statnNm: string;
	trainNo: string;
	updnLine: string;
	trainSttus: string;
	directAt: string;
	lstcarAt: string;
}

/** 서울열린데이터광장 API 응답 래퍼 */
export interface SeoulApiResponse {
	realtimePositionList: SeoulApiTrainRaw[];
}

/** 파싱된 열차 위치 정보 */
export interface TrainPosition {
	trainNo: string;
	stationId: string;
	stationName: string;
	line: number;
	direction: "상행" | "하행";
	status: "진입" | "도착" | "출발";
}

/** 보간된 열차 렌더링 좌표 */
export interface InterpolatedTrain {
	trainNo: string;
	line: number;
	direction: "상행" | "하행";
	/** API 상태 — TrainAnimator가 직접 사용 */
	status: "진입" | "도착" | "출발";
	/** 현재 역 ID */
	stationId: string;
	/** 현재 역 화면 X 좌표 */
	stationX: number;
	/** 현재 역 화면 Y 좌표 */
	stationY: number;
	/** 다음 역 ID (히트맵용) */
	nextStationId: string;
	/** 다음 역 화면 X 좌표 */
	nextX: number;
	/** 다음 역 화면 Y 좌표 */
	nextY: number;
	/** 트랙 방향 각도 (라디안). 현재역→다음역 방향 */
	trackAngle: number;
	/** 시뮬레이션 전용: 열차 속도 배율 (0.85~1.15). 애니메이터 속도 동기화용 */
	speedFactor?: number;
	/** 시뮬레이션 전용: 구간 내 현재 진행률 (0~1). 신규 열차 초기 배치에만 사용 */
	simProgress?: number;
}

/** 애니메이션 중인 열차 상태 (TrainAnimator 내부용) */
export interface AnimatedTrainState {
	trainNo: string;
	line: number;
	direction: "상행" | "하행";
	/** 현재 렌더링 좌표 (매 프레임 advanceTrainState가 갱신) */
	currentX: number;
	currentY: number;
	/** 현재 구간 출발역 ID (히트맵용) */
	stationId: string;
	/** 현재 구간 도착역 ID (히트맵용) */
	toStationId: string;
	/** 구간 출발 좌표 (progress=0 위치) */
	fromX: number;
	fromY: number;
	/** 구간 도착 좌표 (progress=1 위치) */
	toX: number;
	toY: number;
	/** 구간 진행률 [0.0, 1.0] — 절대 감소하지 않음 */
	progress: number;
	/** 이동 중 여부. 출발=true, 도착/진입=false */
	isMoving: boolean;
	/** 트랙 방향 각도 (라디안). 항상 다음 역 방향 */
	trackAngle: number;
	/** 열차 생성 시각 (ms). 페이드인 애니메이션에 사용 */
	createdAt: number;
	/** 마지막 폴 수신 시각 (ms) */
	lastPollAt: number;
	/** 페이드아웃 시작 시각 (ms). 설정되면 점진적으로 사라진다 */
	fadeOutStartedAt?: number;
	/** 스냅 발생 시 true — updateTrailQueues가 큐를 비우고 즉시 false로 초기화 */
	trailDirty?: boolean;
	/** 열차 속도 배율 (0.85~1.15). 시뮬레이션 모드에서 사용, 실시간 모드는 1.0 */
	speedFactor: number;
	/** Waypoint: 자동 전환 시 stationId (B역 ID) */
	pendingStationId?: string;
	/** Waypoint: 자동 전환 시 toStationId (C역 ID) */
	pendingToStationId?: string;
	/** Waypoint: 다음 구간 목표 X 좌표 (C역) */
	pendingToX?: number;
	/** Waypoint: 다음 구간 목표 Y 좌표 (C역) */
	pendingToY?: number;
	/** 예상 밖 구간 변경(텔레포트) 발생 시각 (ms). 경고 마커 표시용 */
	unexpectedSnapAt?: number;
	/** 텔레포트 직전 X 좌표. 경고 마커 위치 고정용 */
	unexpectedSnapX?: number;
	/** 텔레포트 직전 Y 좌표. 경고 마커 위치 고정용 */
	unexpectedSnapY?: number;
}
