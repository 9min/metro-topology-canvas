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
