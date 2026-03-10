import * as cheerio from "cheerio";

const SMSS_URL = "https://smss.seoulmetro.co.kr/traininfo/traininfoUserMap.do";
const TIMEOUT_MS = 10_000;

export interface SmssTrainRaw {
	trainNo: string;
	stationName: string;
	line: number;
	direction: "상행" | "하행";
	status: "진입" | "도착" | "출발";
}

/**
 * title 텍스트에서 열차 정보를 파싱한다.
 * 형식: "2490열차  구의 도착 신도림행"
 *       "{trainNo}열차  {stationName} {status} {destination}"
 */
function parseTitle(title: string, line: number): SmssTrainRaw | null {
	const parts = title.trim().split(/\s+/);
	if (parts.length < 4) return null;

	const trainPart = parts[0];
	if (!trainPart || !trainPart.endsWith("열차")) return null;

	const trainNo = trainPart.replace("열차", "");

	// K 접두사 열차(코레일)는 제외
	if (trainNo.startsWith("K")) return null;

	const statusPart = parts[parts.length - 2];
	const stationName = parts.slice(1, parts.length - 2).join(" ");
	if (!statusPart || !stationName) return null;

	let status: "진입" | "도착" | "출발";
	if (statusPart === "접근") status = "진입";
	else if (statusPart === "도착") status = "도착";
	else if (statusPart === "출발") status = "출발";
	else if (statusPart === "이동") status = "출발";
	else return null;

	const destination = parts[parts.length - 1] ?? "";
	const direction = parseDirection(destination, line);

	return { trainNo, stationName, line, direction, status };
}

/** 행선지 텍스트에서 방향을 판별한다 (2호선 순환선 전용 분기) */
function parseDirection(destination: string, line: number): "상행" | "하행" {
	if (line === 2) {
		if (destination.includes("내선")) return "상행";
		if (destination.includes("외선")) return "하행";
	}
	return "상행";
}

/** CSS 클래스에서 방향을 추출한다 (T0213_Y_1_v2 → "1" = 상행) */
function directionFromClass(className: string): "상행" | "하행" {
	const match = className.match(/_(\d)_v2/);
	if (match?.[1] === "2") return "하행";
	return "상행";
}

/** 단일 호선의 SMSS HTML을 가져와 열차 정보를 파싱한다 */
async function fetchSmssLine(line: number): Promise<SmssTrainRaw[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

	try {
		const response = await fetch(SMSS_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"User-Agent": "Mozilla/5.0",
			},
			body: `line=${line}`,
			signal: controller.signal,
		});

		if (!response.ok) return [];

		const html = await response.text();
		const $ = cheerio.load(html);
		const trains: SmssTrainRaw[] = [];

		$("div[class^=T]").each((_, el) => {
			const title = $(el).attr("title");
			const className = $(el).attr("class") ?? "";
			if (!title) return;

			const parsed = parseTitle(title, line);
			if (parsed === null) return;

			parsed.direction = directionFromClass(className);
			trains.push(parsed);
		});

		return trains;
	} catch {
		return [];
	} finally {
		clearTimeout(timeout);
	}
}

/** 여러 호선의 SMSS 열차 정보를 병렬로 가져온다 */
export async function fetchSmssTrains(lines: number[]): Promise<SmssTrainRaw[]> {
	const validLines = lines.filter((l) => l >= 1 && l <= 8);

	const results = await Promise.allSettled(validLines.map((l) => fetchSmssLine(l)));

	const allTrains: SmssTrainRaw[] = [];
	for (const result of results) {
		if (result.status === "fulfilled") {
			allTrains.push(...result.value);
		}
	}
	return allTrains;
}
