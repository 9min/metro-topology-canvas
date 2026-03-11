/**
 * 5분간 SMSS API 데이터를 수집하는 스크립트.
 * 10초 간격으로 30회 호출하여 1~8호선 열차 위치 데이터를 기록한다.
 *
 * 실행: npx tsx scripts/collectApiData.ts
 * 출력: tests/fixtures/api-responses-5min.json
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchSmssTrains, type SmssTrainRaw } from "../api/smssParser.js";

const LINES = [1, 2, 3, 4, 5, 6, 7, 8];
const POLL_INTERVAL_MS = 10_000;
const TOTAL_POLLS = 30;
const DURATION_MS = POLL_INTERVAL_MS * TOTAL_POLLS;
const OUTPUT_PATH = resolve(import.meta.dirname, "../tests/fixtures/api-responses-5min.json");

interface Snapshot {
	pollIndex: number;
	timestamp: string;
	smss: { source: "smss"; trains: SmssTrainRaw[] } | null;
}

async function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
	console.log(`=== SMSS 5분 데이터 수집 시작 ===`);
	console.log(`호선: ${LINES.join(", ")}`);
	console.log(`간격: ${POLL_INTERVAL_MS / 1000}초, 총 ${TOTAL_POLLS}회 (${DURATION_MS / 1000}초)`);
	console.log(`출력: ${OUTPUT_PATH}\n`);

	const snapshots: Snapshot[] = [];
	const startTime = Date.now();

	for (let i = 1; i <= TOTAL_POLLS; i++) {
		const timestamp = new Date().toISOString();
		try {
			const trains = await fetchSmssTrains(LINES);
			snapshots.push({
				pollIndex: i,
				timestamp,
				smss: { source: "smss", trains },
			});
			console.log(`[${i}/${TOTAL_POLLS}] ${timestamp} — ${trains.length}대 수집`);
		} catch (error) {
			snapshots.push({ pollIndex: i, timestamp, smss: null });
			console.log(`[${i}/${TOTAL_POLLS}] ${timestamp} — 실패: ${error}`);
		}

		if (i < TOTAL_POLLS) {
			await sleep(POLL_INTERVAL_MS);
		}
	}

	const endTime = Date.now();

	const result = {
		collectedAt: new Date().toISOString(),
		durationMs: endTime - startTime,
		pollIntervalMs: POLL_INTERVAL_MS,
		totalSnapshots: snapshots.length,
		snapshots,
	};

	writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf-8");
	console.log(`\n=== 수집 완료 ===`);
	console.log(
		`총 ${snapshots.length}개 스냅샷, 소요 시간: ${((endTime - startTime) / 1000).toFixed(1)}초`,
	);
	console.log(`저장: ${OUTPUT_PATH}`);
}

main().catch((err) => {
	console.error("수집 실패:", err);
	process.exit(1);
});
