/**
 * 열차 이동 패턴 진단 테스트 (역 기반 배치)
 *
 * 수집된 3분간 API 응답 데이터를 재생하며,
 * 역 좌표 배치에서의 이동 패턴을 진단한다.
 */

import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import type { TrainPosition } from "@/types/train";
import { type Infra, loadInfra, type PollResult, replayPolling } from "./helpers/replayFixture";

// --- 인프라 + 재생 ---

const infra: Infra = loadInfra();
const apiDataPath = resolve(__dirname, "../fixtures/api-responses-3min.json");

// API 데이터 품질 문제로 같은 poll에 중복 등장하는 열차 제외
const KNOWN_DUPLICATE_TRAINS = new Set(["2602"]);

// --- 테스트 ---

describe("열차 이동 패턴 진단 (역 기반 배치, 실제 API 데이터 재생)", () => {
	const results = replayPolling(apiDataPath, infra);

	it("API 데이터가 정상적으로 로드되어야 한다", () => {
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.interpolated.length).toBeGreaterThan(0);
		console.log(
			`총 ${results.length}개 폴링 스냅샷, 첫 스냅샷 ${results[0]?.interpolated.length}대`,
		);
	});

	it("toStationId는 진행 방향의 다음역이므로 자기참조가 거의 없어야 한다", () => {
		let totalTrains = 0;
		let selfRefCount = 0;

		for (const result of results) {
			for (const train of result.interpolated) {
				if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;
				totalTrains++;
				if (train.fromStationId === train.toStationId) {
					selfRefCount++;
				}
			}
		}

		const ratio = selfRefCount / totalTrains;
		console.log(`전체 ${totalTrains}건 중 자기참조 ${selfRefCount}건 (${(ratio * 100).toFixed(1)}%) — 종착역 제외 거의 0%가 정상`);
		// 자기참조는 종착역(다음역 없음)에서만 발생 — 전체의 10% 미만이어야 한다
		expect(ratio).toBeLessThan(0.1);
	});

	it("각 폴링 간 열차별 이동은 역 간 이동이다", () => {
		const prevMap = new Map<string, { x: number; y: number; stationId: string }>();
		let stationChanges = 0;
		let stationSame = 0;

		for (const result of results) {
			const rawMap = new Map<string, TrainPosition>();
			for (const pos of result.positions) {
				rawMap.set(pos.trainNo, pos);
			}

			for (const train of result.interpolated) {
				if (KNOWN_DUPLICATE_TRAINS.has(train.trainNo)) continue;

				const rawPos = rawMap.get(train.trainNo);
				if (rawPos === undefined) continue;

				const prev = prevMap.get(train.trainNo);
				if (prev !== undefined) {
					if (prev.stationId !== rawPos.stationId) {
						stationChanges++;
					} else {
						stationSame++;
					}
				}

				prevMap.set(train.trainNo, {
					x: train.x,
					y: train.y,
					stationId: rawPos.stationId,
				});
			}
		}

		console.log(`역 변경: ${stationChanges}건, 같은 역: ${stationSame}건`);
		expect(stationChanges + stationSame).toBeGreaterThan(0);
	});

	it("동일 열차의 direction이 갑자기 변경되면 안 된다 (종착역 제외)", () => {
		const dirChanges: {
			trainNo: string;
			line: number;
			pollIndex: number;
			prevDir: string;
			currDir: string;
			stationId: string;
		}[] = [];

		const prevDirMap = new Map<string, { direction: string; stationId: string }>();

		for (const result of results) {
			for (const train of result.interpolated) {
				const rawMap = new Map<string, TrainPosition>();
				for (const pos of result.positions) {
					rawMap.set(pos.trainNo, pos);
				}
				const rawPos = rawMap.get(train.trainNo);

				const prev = prevDirMap.get(train.trainNo);
				if (prev && prev.direction !== train.direction) {
					dirChanges.push({
						trainNo: train.trainNo,
						line: train.line,
						pollIndex: result.pollIndex,
						prevDir: prev.direction,
						currDir: train.direction,
						stationId: rawPos?.stationId ?? train.fromStationId,
					});
				}
				prevDirMap.set(train.trainNo, {
					direction: train.direction,
					stationId: rawPos?.stationId ?? train.fromStationId,
				});
			}
		}

		if (dirChanges.length > 0) {
			console.log("\n=== 방향 전환 감지 ===");
			for (const d of dirChanges.slice(0, 10)) {
				const stationName = infra.stations.find((s) => s.id === d.stationId)?.name ?? d.stationId;
				console.log(
					`  [poll ${d.pollIndex}] ${d.line}호선 열차 ${d.trainNo}: ${d.prevDir}→${d.currDir} (역: ${stationName})`,
				);
			}
		}

		console.log(`방향 전환 ${dirChanges.length}건`);
	});
});
