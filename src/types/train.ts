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
	x: number;
	y: number;
	direction: "상행" | "하행";
	progress: number;
	fromStationId: string;
	toStationId: string;
	/** 트랙 방향 각도 (라디안). 신규 열차 초기 회전에 사용 */
	trackAngle: number;
}

/** 경로 상의 한 점 (화면 좌표) */
export interface PathPoint {
	x: number;
	y: number;
}

/** 동적 예측률 계산에 필요한 이전 폴링 정보 */
export interface TrainPollHistory {
	prevStatus: "진입" | "도착" | "출발";
	prevStationId: string;
	/** 동일 (stationId + status) 연속 폴링 횟수. 1=첫 등장 */
	repeatCount: number;
}

/** 애니메이션 중인 열차 상태 (TrainAnimator 내부용) */
export interface AnimatedTrainState {
	trainNo: string;
	line: number;
	direction: "상행" | "하행";
	/** 애니메이션 시작 좌표 */
	startX: number;
	startY: number;
	/** 애니메이션 목표 좌표 */
	targetX: number;
	targetY: number;
	/** 현재 렌더링 좌표 */
	currentX: number;
	currentY: number;
	/** 애니메이션 시작 시각 (ms) */
	startTime: number;
	/** 애니메이션 지속 시간 (ms) */
	duration: number;
	/** 출발/도착 역 ID */
	fromStationId: string;
	toStationId: string;
	/**
	 * 선로를 따르는 이동 경로 (시작점 → 경유역 → 목표점).
	 * 직선 구간은 2개, 역을 경유하면 3개 이상의 점으로 구성된다.
	 */
	path: PathPoint[];
	/** path 각 세그먼트의 누적 거리 (polyline 보간용). 길이 = path.length */
	pathCumulativeDist: number[];
	/** true이면 이징 없이 선형 보간한다 (시뮬레이션 모드용) */
	linear?: boolean;
	/** 트랙 방향 각도 (라디안). 신규 열차 초기 회전에 사용 */
	trackAngle?: number;
}
