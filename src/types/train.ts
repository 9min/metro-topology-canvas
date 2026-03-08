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
}
