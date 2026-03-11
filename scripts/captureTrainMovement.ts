/**
 * 열차 이동 관찰용 스크린샷 캡처 스크립트.
 * 줌인한 상태에서 작은 영역만 클리핑하여 빠르게 캡처한다.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(__dirname, "../screenshots/train-movement");
const INTERVAL_MS = 200;
const DURATION_MS = 2 * 60 * 1000;
const TOTAL_SHOTS = Math.floor(DURATION_MS / INTERVAL_MS);

async function main() {
	mkdirSync(OUTPUT_DIR, { recursive: true });

	// 기존 파일 삭제
	const { readdirSync, unlinkSync } = await import("node:fs");
	for (const f of readdirSync(OUTPUT_DIR)) {
		if (f.endsWith(".png")) unlinkSync(resolve(OUTPUT_DIR, f));
	}

	console.log(`스크린샷 저장 경로: ${OUTPUT_DIR}`);
	console.log(`간격: ${INTERVAL_MS}ms, 총 ${TOTAL_SHOTS}장`);

	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

	await page.goto("http://localhost:5173", { waitUntil: "networkidle" });
	console.log("페이지 로드 완료");
	await page.waitForTimeout(3000);

	const canvasEl = await page.$("canvas");
	if (!canvasEl) {
		console.error("Canvas 요소를 찾을 수 없습니다");
		await browser.close();
		return;
	}

	const canvasBBox = await canvasEl.boundingBox();
	if (!canvasBBox) {
		console.error("Canvas 바운딩 박스 없음");
		await browser.close();
		return;
	}

	const centerX = canvasBBox.x + canvasBBox.width / 2;
	const centerY = canvasBBox.y + canvasBBox.height / 2;

	// 많이 줌인 — 열차가 크게 보이도록
	await page.mouse.move(centerX, centerY);
	console.log("줌인 중 (15단계)...");
	for (let i = 0; i < 15; i++) {
		await page.mouse.wheel(0, -300);
		await page.waitForTimeout(80);
	}
	await page.waitForTimeout(1000);

	// 실시간 데이터 대기
	console.log("실시간 데이터 대기 중 (15초)...");
	await page.waitForTimeout(15000);

	// 전체 화면 캡처 (클리핑 없이 전체 viewport)
	console.log(`캡처 시작: ${new Date().toISOString()}`);
	const startTime = Date.now();

	for (let i = 0; i < TOTAL_SHOTS; i++) {
		const elapsed = Date.now() - startTime;
		const filename = `frame_${String(i).padStart(4, "0")}_${elapsed}ms.png`;

		await page.screenshot({
			path: resolve(OUTPUT_DIR, filename),
			type: "png",
		});

		if (i % 100 === 0) {
			console.log(`  ${i}/${TOTAL_SHOTS} (${(elapsed / 1000).toFixed(1)}초 경과)`);
		}

		const nextTime = startTime + (i + 1) * INTERVAL_MS;
		const sleepMs = nextTime - Date.now();
		if (sleepMs > 0) {
			await page.waitForTimeout(sleepMs);
		}
	}

	const totalElapsed = Date.now() - startTime;
	console.log(`캡처 완료: ${TOTAL_SHOTS}장, 실제 소요시간: ${(totalElapsed / 1000).toFixed(1)}초`);

	await browser.close();
}

main().catch(console.error);
