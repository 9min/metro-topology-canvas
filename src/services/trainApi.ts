import type { SeoulApiResponse, SeoulApiTrainRaw, TrainPosition } from "@/types/train";

const API_TIMEOUT_MS = 10_000;

/** 호선 번호 → API 호선명 매핑 */
const LINE_NAMES: Record<number, string> = {
	1: "1호선",
	2: "2호선",
	3: "3호선",
	4: "4호선",
	5: "5호선",
	6: "6호선",
	7: "7호선",
	8: "8호선",
	9: "9호선",
};

/** subwayId → 호선 번호 매핑 */
const SUBWAY_ID_TO_LINE: Record<string, number> = {
	"1001": 1,
	"1002": 2,
	"1003": 3,
	"1004": 4,
	"1005": 5,
	"1006": 6,
	"1007": 7,
	"1008": 8,
	"1009": 9,
};

/** updnLine → 방향 매핑 */
function parseDirection(updnLine: string): "상행" | "하행" {
	return updnLine === "0" ? "상행" : "하행";
}

/** trainSttus → 상태 매핑 */
function parseStatus(trainSttus: string): "진입" | "도착" | "출발" {
	if (trainSttus === "0") return "진입";
	if (trainSttus === "1") return "도착";
	return "출발";
}

/** API 원시 데이터를 TrainPosition으로 변환한다 */
function parseRawTrain(raw: SeoulApiTrainRaw): TrainPosition | null {
	const line = SUBWAY_ID_TO_LINE[raw.subwayId];
	if (line === undefined) return null;

	return {
		trainNo: raw.trainNo,
		stationId: "", // stationNameResolver로 후속 매핑
		stationName: raw.statnNm,
		line,
		direction: parseDirection(raw.updnLine),
		status: parseStatus(raw.trainSttus),
	};
}

/** 단일 호선의 실시간 열차 위치를 가져온다 (9호선 전용 프록시 사용) */
export async function fetchLineTrains(lineNumber: number): Promise<TrainPosition[]> {
	const lineName = LINE_NAMES[lineNumber];
	if (lineName === undefined) return [];

	// 클라이언트 → 프록시 (서버사이드에서 외부 API 호출하여 Mixed Content/CORS 우회)
	const url = `/api/line9?lineName=${encodeURIComponent(lineName)}`;

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			console.warn(`[trainApi] ${lineName} HTTP ${response.status}`);
			return [];
		}

		const data = (await response.json()) as SeoulApiResponse;
		const list = data.realtimePositionList;
		if (!Array.isArray(list)) return [];

		const trains: TrainPosition[] = [];
		for (const raw of list) {
			const parsed = parseRawTrain(raw);
			if (parsed !== null) {
				trains.push(parsed);
			}
		}
		return trains;
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			console.warn(`[trainApi] ${lineName} 요청 타임아웃`);
		} else {
			console.warn(`[trainApi] ${lineName} 요청 실패:`, error);
		}
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

/** 실시간 열차 위치를 병렬로 가져온다 (9호선 전용) */
export async function fetchAllTrains(lines: number[]): Promise<TrainPosition[]> {
	const results = await Promise.allSettled(lines.map((n) => fetchLineTrains(n)));

	const allTrains: TrainPosition[] = [];
	for (const result of results) {
		if (result.status === "fulfilled") {
			allTrains.push(...result.value);
		}
	}
	return allTrains;
}

/** SMSS 프록시 응답 항목 */
interface SmssTrainRaw {
	trainNo: string;
	stationName: string;
	line: number;
	direction: "상행" | "하행";
	status: "진입" | "도착" | "출발";
}

/** SMSS 프록시를 통해 열차 위치를 가져온다 (1~8호선) */
export async function fetchTrainsFromSmss(lines: number[]): Promise<TrainPosition[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

	try {
		const response = await fetch("/api/trains", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lines }),
			signal: controller.signal,
		});

		if (!response.ok) {
			console.warn(`[trainApi] SMSS 프록시 HTTP ${response.status}`);
			return [];
		}

		const data = (await response.json()) as { trains: SmssTrainRaw[] };
		if (!Array.isArray(data.trains)) return [];

		return data.trains.map((raw) => ({
			trainNo: raw.trainNo,
			stationId: "",
			stationName: raw.stationName,
			line: raw.line,
			direction: raw.direction,
			status: raw.status,
		}));
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			console.warn("[trainApi] SMSS 프록시 요청 타임아웃");
		} else {
			console.warn("[trainApi] SMSS 프록시 요청 실패:", error);
		}
		return [];
	} finally {
		clearTimeout(timeout);
	}
}
