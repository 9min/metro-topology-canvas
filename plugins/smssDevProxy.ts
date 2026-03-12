import type { Plugin } from "vite";
import { fetchSmssTrains } from "../api/smssParser.js";

const SEOUL_API_BASE = "http://swopenAPI.seoul.go.kr/api/subway";

/**
 * Vite 개발 서버에서 /api/trains, /api/line9 요청을 처리하는 미들웨어 플러그인.
 * Vercel 서버리스 함수와 동일한 로직을 사용한다.
 */
export function smssDevProxy(): Plugin {
	return {
		name: "smss-dev-proxy",
		configureServer(server) {
			// 9호선 서울 공공 API 프록시 (Mixed Content/CORS 우회)
			server.middlewares.use("/api/line9", async (req, res) => {
				if (req.method !== "GET") {
					res.writeHead(405, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "GET만 허용됩니다" }));
					return;
				}

				const apiKey = server.config.env.VITE_SEOUL_API_KEY;
				if (!apiKey) {
					res.writeHead(500, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "API 키가 설정되지 않았습니다" }));
					return;
				}

				const urlObj = new URL(req.url ?? "", "http://localhost");
				const lineName = urlObj.searchParams.get("lineName") ?? "9호선";
				const upstreamUrl = `${SEOUL_API_BASE}/${apiKey}/json/realtimePosition/0/100/${lineName}`;

				try {
					const upstream = await fetch(upstreamUrl);
					if (!upstream.ok) {
						res.writeHead(502, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: `서울 API 오류: ${upstream.status}` }));
						return;
					}
					const data = await upstream.json();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify(data));
				} catch {
					res.writeHead(502, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "서울 API 호출 실패" }));
				}
			});

			server.middlewares.use("/api/trains", async (req, res) => {
				if (req.method !== "POST") {
					res.writeHead(405, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "POST만 허용됩니다" }));
					return;
				}

				// body 읽기
				const chunks: Buffer[] = [];
				for await (const chunk of req) {
					chunks.push(chunk as Buffer);
				}

				let lines: number[] = [];
				try {
					const body = JSON.parse(Buffer.concat(chunks).toString()) as {
						lines?: number[];
					};
					if (Array.isArray(body.lines)) {
						lines = body.lines;
					}
				} catch {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "잘못된 JSON 형식입니다" }));
					return;
				}

				if (lines.length === 0) {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ error: "lines 배열이 필요합니다" }));
					return;
				}

				const trains = await fetchSmssTrains(lines);

				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ trains }));
			});
		},
	};
}
