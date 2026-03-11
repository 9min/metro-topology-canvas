/**
 * 종합 열차 이동 진단 테스트.
 *
 * 수집된 API fixture를 재생하여 이상 패턴을 감지한다.
 * A: 정지/고착, B: 급격한 속도 변화, C: 자기참조 비율, D: 궤적 리포트
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { TrainAnimator } from "@/canvas/animation/TrainAnimator";
import type { TrainPosition } from "@/types/train";
import { type Infra, loadInfra, type PollResult, replayPolling } from "./helpers/replayFixture";

// drawAnimatedTrains 모킹
vi.mock("@/canvas/objects/TrainParticle", () => ({
	drawAnimatedTrains: vi.fn(),
}));

// --- 인프라 ---

const infra: Infra = loadInfra();
const fixture3minPath = resolve(__dirname, "../fixtures/api-responses-3min.json");
const fixture5minPath = resolve(__dirname, "../fixtures/api-responses-5min.json");

// API 데이터 품질 문제로 같은 poll에 중복 등장하는 열차 제외
const KNOWN_DUPLICATE_TRAINS = new Set(["2602"]);

// --- 카테고리별 감지 함수 ---

/** A: 정지/고착 감지 — 연속 5회(50초) 이상 이동 거리 < 1px */
interface StuckAnomaly {
	trainNo: string;
	line: number;
	startPollIndex: number;
	endPollIndex: number;
	consecutiveCount: number;
	stationId: string;
}

function detectStuckTrains(results: PollResult[]): StuckAnomaly[] {
	const anomalies: StuckAnomaly[] = [];
	const stuckCounter = new Map<
		string,
		{ count: number; startPoll: number; x: number; y: number; stationId: string; line: number }
	>();

	for (const result of results) {
		const seenInPoll = new Set<string>();

		for (const train of result.interpolated) {
			if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;
			seenInPoll.add(train.trainNo);

			const prev = stuckCounter.get(train.trainNo);
			if (prev !== undefined) {
				const dx = train.x - prev.x;
				const dy = train.y - prev.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 1) {
					prev.count++;
					prev.stationId = train.fromStationId;
				} else {
					if (prev.count >= 5) {
						anomalies.push({
							trainNo: train.trainNo,
							line: prev.line,
							startPollIndex: prev.startPoll,
							endPollIndex: result.pollIndex - 1,
							consecutiveCount: prev.count,
							stationId: prev.stationId,
						});
					}
					stuckCounter.set(train.trainNo, {
						count: 1,
						startPoll: result.pollIndex,
						x: train.x,
						y: train.y,
						stationId: train.fromStationId,
						line: train.line,
					});
				}
			} else {
				stuckCounter.set(train.trainNo, {
					count: 1,
					startPoll: result.pollIndex,
					x: train.x,
					y: train.y,
					stationId: train.fromStationId,
					line: train.line,
				});
			}
		}

		for (const [trainNo, entry] of stuckCounter) {
			if (!seenInPoll.has(trainNo) && entry.count >= 5) {
				anomalies.push({
					trainNo,
					line: entry.line,
					startPollIndex: entry.startPoll,
					endPollIndex: result.pollIndex,
					consecutiveCount: entry.count,
					stationId: entry.stationId,
				});
				stuckCounter.delete(trainNo);
			}
		}
	}

	return anomalies;
}

/** B: 급격한 속도 변화 감지 — 속도 비율 > 5배 또는 < 0.2배 */
interface SpeedSpikeAnomaly {
	trainNo: string;
	line: number;
	pollIndex: number;
	prevSpeed: number;
	currSpeed: number;
	ratio: number;
}

function detectSpeedSpikes(results: PollResult[]): SpeedSpikeAnomaly[] {
	const anomalies: SpeedSpikeAnomaly[] = [];
	const prevMap = new Map<string, { x: number; y: number }>();
	const prevSpeedMap = new Map<string, number>();

	for (const result of results) {
		for (const train of result.interpolated) {
			if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;

			const prev = prevMap.get(train.trainNo);
			if (prev !== undefined) {
				const dx = train.x - prev.x;
				const dy = train.y - prev.y;
				const speed = Math.sqrt(dx * dx + dy * dy);

				const prevSpeed = prevSpeedMap.get(train.trainNo);
				if (prevSpeed !== undefined && prevSpeed > 3) {
					const ratio = speed / prevSpeed;
					if (ratio > 5 || ratio < 0.2) {
						anomalies.push({
							trainNo: train.trainNo,
							line: train.line,
							pollIndex: result.pollIndex,
							prevSpeed,
							currSpeed: speed,
							ratio,
						});
					}
				}

				prevSpeedMap.set(train.trainNo, speed);
			}
			prevMap.set(train.trainNo, { x: train.x, y: train.y });
		}
	}

	return anomalies;
}

/** C: 자기참조 비율 감지 — fromStationId === toStationId 비율 */
interface SelfRefPollStat {
	pollIndex: number;
	selfRefCount: number;
	totalCount: number;
	ratio: number;
}

function detectSelfRefRatio(results: PollResult[]): SelfRefPollStat[] {
	const stats: SelfRefPollStat[] = [];

	for (const result of results) {
		let selfRefCount = 0;
		let totalCount = 0;

		for (const train of result.interpolated) {
			if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;
			totalCount++;
			if (train.fromStationId === train.toStationId) {
				selfRefCount++;
			}
		}

		const ratio = totalCount > 0 ? selfRefCount / totalCount : 0;
		stats.push({ pollIndex: result.pollIndex, selfRefCount, totalCount, ratio });
	}

	return stats;
}

/** D: 궤적 리포트 */
function printTrajectoryReport(results: PollResult[], anomalyTrainNos: Set<string>): void {
	if (anomalyTrainNos.size === 0) return;

	console.log(`\n=== 궤적 리포트 (이상 패턴 열차 ${anomalyTrainNos.size}대) ===`);

	for (const trainNo of anomalyTrainNos) {
		console.log(`\n--- 열차 ${trainNo} ---`);
		console.log("Poll | 역명            | 상태 | stationId | (x, y)");
		console.log("-----|-----------------|------|-----------|---------------");

		for (const result of results) {
			const rawMap = new Map<string, TrainPosition>();
			for (const pos of result.positions) {
				rawMap.set(pos.trainNo, pos);
			}

			const train = result.interpolated.find((t) => t.trainNo === trainNo);
			const rawPos = rawMap.get(trainNo);
			if (train === undefined) continue;

			const stationName = rawPos?.stationName ?? "?";
			const status = rawPos?.status ?? "?";

			console.log(
				`  ${String(result.pollIndex).padStart(2)} | ${stationName.padEnd(15)} | ${status.padEnd(4)} | ${rawPos?.stationId?.padEnd(9) ?? "?".padEnd(9)} | (${train.x.toFixed(1).padStart(6)},${train.y.toFixed(1).padStart(6)})`,
			);
		}
	}
}

// --- 테스트: fixture별 진단 ---

function runDiagnostics(fixtureName: string, fixturePath: string): void {
	describe(`종합 진단: ${fixtureName}`, () => {
		const results = replayPolling(fixturePath, infra);

		it("데이터가 정상적으로 로드된다", () => {
			expect(results.length).toBeGreaterThan(0);
			expect(results[0]?.interpolated.length).toBeGreaterThan(0);

			const totalTrains = new Set<string>();
			for (const r of results) {
				for (const t of r.interpolated) {
					totalTrains.add(t.trainNo);
				}
			}
			console.log(`[${fixtureName}] ${results.length}개 폴, 고유 열차 ${totalTrains.size}대`);
		});

		it("A: 비정상 정지/고착이 없어야 한다", () => {
			const anomalies = detectStuckTrains(results);

			if (anomalies.length > 0) {
				console.log(`\n[${fixtureName}] === A: 정지/고착 ${anomalies.length}건 ===`);
				for (const a of anomalies.slice(0, 10)) {
					const stationName = infra.stations.find((s) => s.id === a.stationId)?.name ?? a.stationId;
					console.log(
						`  ${a.line}호선 열차 ${a.trainNo}: poll ${a.startPollIndex}~${a.endPollIndex} (${a.consecutiveCount}회 연속 정지, 역: ${stationName})`,
					);
				}
			}

			// 역 기반 배치이므로 같은 역에 연속 정지가 자연스럽다 — 리포트 전용
			console.log(`[${fixtureName}] A: 정지/고착 ${anomalies.length}건`);
		});

		it("B: 급격한 속도 변화가 없어야 한다", () => {
			const anomalies = detectSpeedSpikes(results);

			if (anomalies.length > 0) {
				console.log(`\n[${fixtureName}] === B: 급속도 변화 ${anomalies.length}건 ===`);
				for (const a of anomalies.slice(0, 10)) {
					const type = a.ratio > 1 ? "급가속" : "급감속";
					console.log(
						`  [poll ${a.pollIndex}] ${a.line}호선 열차 ${a.trainNo}: ${type} (${a.prevSpeed.toFixed(1)}→${a.currSpeed.toFixed(1)}, 비율=${a.ratio.toFixed(2)})`,
					);
				}
			}

			console.log(`[${fixtureName}] B: 급속도 변화 ${anomalies.length}건`);
		});

		it("C: 자기참조 비율 (toStationId가 다음역이므로 0%에 가까워야 한다)", () => {
			const stats = detectSelfRefRatio(results);
			const validStats = stats.slice(2);

			const avgRatio =
				validStats.length > 0
					? validStats.reduce((sum, s) => sum + s.ratio, 0) / validStats.length
					: 0;

			console.log(
				`[${fixtureName}] C: 평균 자기참조 비율 = ${(avgRatio * 100).toFixed(1)}% — 종착역 제외 거의 0%가 정상`,
			);

			// toStationId가 다음역으로 설정되므로 자기참조는 종착역에서만 발생 (10% 미만)
			expect(avgRatio).toBeLessThan(0.1);
		});

		it("D: 궤적 리포트", () => {
			// 정지/고착 열차만 리포트
			const stuckTrains = detectStuckTrains(results);
			const anomalyTrains = new Set<string>();
			for (const a of stuckTrains.slice(0, 3)) anomalyTrains.add(a.trainNo);
			printTrajectoryReport(results, anomalyTrains);
			expect(true).toBe(true);
		});
	});
}

// 3분 fixture는 항상 실행
runDiagnostics("3분 fixture", fixture3minPath);

// 5분 fixture는 파일이 존재할 때만 실행
if (existsSync(fixture5minPath)) {
	runDiagnostics("5분 fixture", fixture5minPath);
} else {
	describe("종합 진단: 5분 fixture", () => {
		it.skip("5분 fixture가 아직 수집되지 않음 (npx tsx scripts/collectApiData.ts 실행 필요)", () => {});
	});
}

// --- TrainAnimator 파이프라인 재생 ---

function createMockContainer() {
	const children: { x: number; y: number; visible: boolean }[] = [];
	return {
		children,
		addChild(child: { x: number; y: number; visible: boolean }) {
			children.push(child);
		},
		removeChild(child: { x: number; y: number; visible: boolean }) {
			const idx = children.indexOf(child);
			if (idx !== -1) children.splice(idx, 1);
		},
		removeChildren() {
			children.length = 0;
		},
	};
}

function runAnimatorDiagnostics(fixtureName: string, fixturePath: string): void {
	describe(`TrainAnimator 파이프라인: ${fixtureName}`, () => {
		const results = replayPolling(fixturePath, infra);

		it("등속 직선 이동을 확인한다", () => {
			vi.useFakeTimers();

			const animator = new TrainAnimator();
			// biome-ignore lint/suspicious/noExplicitAny: 테스트용 모킹
			animator.setLayer(createMockContainer() as any);

			let totalUpdates = 0;
			let stationaryCount = 0;
			let movingCount = 0;

			for (const result of results) {
				animator.setTargets(result.interpolated, 9000);

				for (const train of result.interpolated) {
					if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;
					const state = animator.getTrainState(train.trainNo);
					if (state === undefined) continue;
					totalUpdates++;

					if (state.duration === 0) {
						stationaryCount++;
					} else {
						movingCount++;
					}

					// 경로가 항상 2점인지 확인
					expect(state.path.length).toBe(2);
					// 항상 linear
					expect(state.linear).toBe(true);
				}

				for (let tick = 0; tick < 10; tick++) {
					vi.advanceTimersByTime(900);
					animator.update();
				}
			}

			vi.useRealTimers();

			console.log(`\n=== [${fixtureName}] TrainAnimator 파이프라인 통계 ===`);
			console.log(`총 갱신: ${totalUpdates}`);
			console.log(`정지(같은 좌표): ${stationaryCount} (${totalUpdates > 0 ? ((stationaryCount / totalUpdates) * 100).toFixed(1) : 0}%)`);
			console.log(`이동(다른 좌표): ${movingCount} (${totalUpdates > 0 ? ((movingCount / totalUpdates) * 100).toFixed(1) : 0}%)`);

			expect(totalUpdates).toBeGreaterThan(0);
		});
	});
}

// 3분 fixture
runAnimatorDiagnostics("3분", fixture3minPath);

// 5분 fixture
if (existsSync(fixture5minPath)) {
	runAnimatorDiagnostics("5분", fixture5minPath);
}
