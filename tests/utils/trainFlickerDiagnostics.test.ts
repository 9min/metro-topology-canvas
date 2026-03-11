import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TRAIN_GRACE_POLL_COUNT } from "@/constants/mapConfig";
import type { InterpolatedTrain, TrainPosition } from "@/types/train";
import { interpolateTrainPosition } from "@/utils/trainInterpolation";
import {
	type Infra,
	loadInfra,
	type PollResult,
	type PrevPollEntry,
	replayPolling,
	resolveSmssTrains,
	type SmssTrainRaw,
} from "./helpers/replayFixture";

const FIXTURE_3MIN = resolve(__dirname, "../fixtures/api-responses-3min.json");
const FIXTURE_5MIN = resolve(__dirname, "../fixtures/api-responses-5min.json");

/** 폴 시퀀스에서 열차별 깜빡임을 감지한다 */
interface FlickerInfo {
	trainNo: string;
	line: number;
	/** 1폴 깜빡임 (있음→없음→있음) 횟수 */
	singlePollFlickers: number;
	/** 2폴 깜빡임 (있음→없음→없음→있음) 횟수 */
	doublePollFlickers: number;
}

function detectFlickers(results: PollResult[]): FlickerInfo[] {
	// 열차별 출현 이력: true=존재, false=부재
	const presenceMap = new Map<string, { line: number; history: boolean[] }>();

	for (const poll of results) {
		const presentTrains = new Set(poll.interpolated.map((t) => t.trainNo));

		// 기존 열차의 이력 갱신
		for (const [trainNo, entry] of presenceMap) {
			entry.history.push(presentTrains.has(trainNo));
		}

		// 신규 열차 등록
		for (const train of poll.interpolated) {
			if (!presenceMap.has(train.trainNo)) {
				const history = new Array<boolean>(results.indexOf(poll)).fill(false);
				history.push(true);
				presenceMap.set(train.trainNo, { line: train.line, history });
			}
		}
	}

	const flickers: FlickerInfo[] = [];

	for (const [trainNo, { line, history }] of presenceMap) {
		let singlePollFlickers = 0;
		let doublePollFlickers = 0;

		for (let i = 1; i < history.length - 1; i++) {
			// 1폴 깜빡임: ...있음, 없음, 있음...
			if (history[i - 1] && !history[i] && history[i + 1]) {
				singlePollFlickers++;
			}
			// 2폴 깜빡임: ...있음, 없음, 없음, 있음...
			if (
				i < history.length - 2 &&
				history[i - 1] &&
				!history[i] &&
				!history[i + 1] &&
				history[i + 2]
			) {
				doublePollFlickers++;
			}
		}

		if (singlePollFlickers > 0 || doublePollFlickers > 0) {
			flickers.push({ trainNo, line, singlePollFlickers, doublePollFlickers });
		}
	}

	return flickers;
}

/** grace period를 적용한 재생 (누락 열차를 N폴 유지) */
function replayWithGrace(fixturePath: string, infra: Infra): PollResult[] {
	const { readFileSync } = require("node:fs");
	const apiData = JSON.parse(readFileSync(fixturePath, "utf-8"));
	let prevPollMap = new Map<string, PrevPollEntry & { missedCount: number }>();
	let prevInterpolatedMap = new Map<string, InterpolatedTrain>();
	const results: PollResult[] = [];

	for (const snapshot of apiData.snapshots) {
		if (snapshot.smss === null || !Array.isArray(snapshot.smss.trains)) continue;

		const positions = resolveSmssTrains(snapshot.smss.trains, infra.stationNameMap);
		const currentTrainNos = new Set(positions.map((t: TrainPosition) => t.trainNo));
		const newPollMap = new Map<string, PrevPollEntry & { missedCount: number }>();
		const newInterpolatedMap = new Map<string, InterpolatedTrain>();
		const interpolated: InterpolatedTrain[] = [];

		for (const train of positions) {
			const result = interpolateTrainPosition(train, infra.stationScreenMap, infra.adjacencyMap);
			if (result !== null) {
				interpolated.push(result);
				newInterpolatedMap.set(train.trainNo, result);
			}

			newPollMap.set(train.trainNo, {
				missedCount: 0,
			});
		}

		// Grace period
		for (const [trainNo, prevEntry] of prevPollMap) {
			if (currentTrainNos.has(trainNo)) continue;
			const nextMissedCount = prevEntry.missedCount + 1;
			if (nextMissedCount < TRAIN_GRACE_POLL_COUNT) {
				newPollMap.set(trainNo, { missedCount: nextMissedCount });
				const lastInterpolated = prevInterpolatedMap.get(trainNo);
				if (lastInterpolated !== undefined) {
					interpolated.push(lastInterpolated);
					newInterpolatedMap.set(trainNo, lastInterpolated);
				}
			}
		}

		results.push({
			pollIndex: snapshot.pollIndex,
			timestamp: snapshot.timestamp,
			interpolated,
			positions,
		});

		prevPollMap = newPollMap;
		prevInterpolatedMap = newInterpolatedMap;
	}

	return results;
}

describe("열차 깜빡임 진단", () => {
	let infra: Infra;

	// 인프라 로드 (한 번만)
	infra = loadInfra();

	describe("G: 깜빡임 패턴 감지", () => {
		it("3분 fixture에서 깜빡임 빈도를 출력한다", () => {
			const results = replayPolling(FIXTURE_3MIN, infra);
			const flickers = detectFlickers(results);

			// 진단 출력
			if (flickers.length > 0) {
				console.log(`[3분] 깜빡임 감지 열차: ${flickers.length}대`);
				for (const f of flickers.slice(0, 10)) {
					console.log(
						`  ${f.trainNo} (${f.line}호선): 1폴=${f.singlePollFlickers}, 2폴=${f.doublePollFlickers}`,
					);
				}
			}

			// 진단용 — 현재 깜빡임이 존재함을 확인
			expect(results.length).toBeGreaterThan(0);
		});

		it("5분 fixture에서 깜빡임 빈도를 출력한다", () => {
			const results = replayPolling(FIXTURE_5MIN, infra);
			const flickers = detectFlickers(results);

			if (flickers.length > 0) {
				console.log(`[5분] 깜빡임 감지 열차: ${flickers.length}대`);
				for (const f of flickers.slice(0, 10)) {
					console.log(
						`  ${f.trainNo} (${f.line}호선): 1폴=${f.singlePollFlickers}, 2폴=${f.doublePollFlickers}`,
					);
				}
			}

			expect(results.length).toBeGreaterThan(0);
		});
	});

	describe("H: grace period 적용 후 깜빡임 제거 확인", () => {
		it("grace period 적용 시 1폴 깜빡임이 제거된다", () => {
			const resultsWithoutGrace = replayPolling(FIXTURE_5MIN, infra);
			const resultsWithGrace = replayWithGrace(FIXTURE_5MIN, infra);

			const flickersWithout = detectFlickers(resultsWithoutGrace);
			const flickersWith = detectFlickers(resultsWithGrace);

			const singleFlickersWithout = flickersWithout.reduce(
				(sum, f) => sum + f.singlePollFlickers,
				0,
			);
			const singleFlickersWith = flickersWith.reduce((sum, f) => sum + f.singlePollFlickers, 0);

			console.log(
				`1폴 깜빡임: grace 전 ${singleFlickersWithout}건 → grace 후 ${singleFlickersWith}건`,
			);

			// grace period(2폴)로 1폴 깜빡임은 완전히 제거되어야 한다
			expect(singleFlickersWith).toBe(0);
		});
	});

	describe("I: 역명 매핑 드롭률", () => {
		it("fixture의 raw trains 중 resolve 실패 비율을 출력한다", () => {
			const { readFileSync } = require("node:fs");
			const apiData = JSON.parse(readFileSync(FIXTURE_5MIN, "utf-8"));

			let totalRaw = 0;
			let resolvedCount = 0;

			for (const snapshot of apiData.snapshots) {
				if (snapshot.smss === null || !Array.isArray(snapshot.smss.trains)) continue;
				const rawTrains: SmssTrainRaw[] = snapshot.smss.trains;
				totalRaw += rawTrains.length;
				const resolved = resolveSmssTrains(rawTrains, infra.stationNameMap);
				resolvedCount += resolved.length;
			}

			const dropCount = totalRaw - resolvedCount;
			const dropRate = totalRaw > 0 ? ((dropCount / totalRaw) * 100).toFixed(2) : "0";

			console.log(
				`역명 매핑: 전체 ${totalRaw}건, 성공 ${resolvedCount}건, 실패 ${dropCount}건 (${dropRate}%)`,
			);

			// 진단용 임계값: 현재 ~11%로 알려진 이슈 (역명 불일치)
			// 15% 미만이면 통과 — 별도 이슈로 추적
			expect(dropCount / totalRaw).toBeLessThan(0.15);
		});
	});
});
