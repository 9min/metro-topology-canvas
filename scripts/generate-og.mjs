/**
 * OG 이미지 생성 스크립트
 * 실행: node scripts/generate-og.mjs
 * 출력: public/og-image.png (1200×630)
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "../src/data");

// 호선별 컬러
const LINE_COLORS = {
	1: "#0052A4",
	2: "#00A84D",
	3: "#EF7C1C",
	4: "#00A5DE",
	5: "#996CAC",
	6: "#CD7C2F",
	7: "#747F00",
	8: "#E6186C",
	9: "#BDB092",
};

const WIDTH = 1200;
const HEIGHT = 630;
const PADDING = 40;

// 데이터 로드
const stations = JSON.parse(readFileSync(join(dataDir, "stations.json"), "utf-8"));
const links = JSON.parse(readFileSync(join(dataDir, "links.json"), "utf-8"));

// GPS → 픽셀 좌표 변환
const lons = stations.map((s) => s.x);
const lats = stations.map((s) => s.y);
const minLon = Math.min(...lons);
const maxLon = Math.max(...lons);
const minLat = Math.min(...lats);
const maxLat = Math.max(...lats);

function toPixel(lon, lat) {
	const px = PADDING + ((lon - minLon) / (maxLon - minLon)) * (WIDTH - PADDING * 2);
	// 위도는 위쪽이 클수록 화면 위이므로 반전
	const py = PADDING + ((maxLat - lat) / (maxLat - minLat)) * (HEIGHT - PADDING * 2);
	return { px, py };
}

// 역 좌표 맵
const stationMap = {};
for (const s of stations) {
	stationMap[s.id] = { ...s, ...toPixel(s.x, s.y) };
}

// SVG 링크 생성
const svgLines = links
	.map((link) => {
		const src = stationMap[link.source];
		const tgt = stationMap[link.target];
		if (!src || !tgt) return "";
		const color = LINE_COLORS[link.line] ?? "#ffffff";
		return `<line x1="${src.px.toFixed(1)}" y1="${src.py.toFixed(1)}" x2="${tgt.px.toFixed(1)}" y2="${tgt.py.toFixed(1)}" stroke="${color}" stroke-width="1.5" opacity="0.8"/>`;
	})
	.join("\n");

// SVG 역 점 생성
const svgCircles = Object.values(stationMap)
	.map(
		(s) =>
			`<circle cx="${s.px.toFixed(1)}" cy="${s.py.toFixed(1)}" r="1.5" fill="white" opacity="0.7"/>`,
	)
	.join("\n");

// 호선 범례 (우하단)
const legendItems = Object.entries(LINE_COLORS)
	.map(([line, color], i) => {
		const x = WIDTH - PADDING - 130 + (i % 5) * 26;
		const y = HEIGHT - PADDING - 14 + Math.floor(i / 5) * 20;
		return `
      <circle cx="${x}" cy="${y}" r="5" fill="${color}"/>
      <text x="${x + 9}" y="${y + 4}" font-family="Arial, sans-serif" font-size="10" fill="#aaaaaa">${line}호</text>
    `;
	})
	.join("\n");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: ${WIDTH}px; height: ${HEIGHT}px; background: #070b14; overflow: hidden; }
</style>
</head>
<body>
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- 노선 링크 -->
  ${svgLines}
  <!-- 역 점 -->
  ${svgCircles}
  <!-- 제목 -->
  <text x="${PADDING + 10}" y="${HEIGHT / 2 - 20}" font-family="Arial, sans-serif" font-weight="bold" font-size="52" fill="white" opacity="0.95">Seoul Metro Pulse</text>
  <text x="${PADDING + 12}" y="${HEIGHT / 2 + 24}" font-family="Arial, sans-serif" font-size="22" fill="#8899aa" letter-spacing="1">서울 지하철 실시간 관제 대시보드</text>
  <!-- 호선 범례 -->
  ${legendItems}
</svg>
</body>
</html>`;

// Playwright로 스크린샷 촬영
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: WIDTH, height: HEIGHT });
await page.setContent(html, { waitUntil: "load" });

const outputPath = join(__dirname, "../public/og-image.png");
await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
await browser.close();

console.log(`OG 이미지 생성 완료: ${outputPath}`);
