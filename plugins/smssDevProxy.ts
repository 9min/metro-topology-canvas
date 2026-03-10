import type { Plugin } from "vite";
import { fetchSmssTrains } from "../api/smssParser.js";

/**
 * Vite 개발 서버에서 /api/trains 요청을 처리하는 미들웨어 플러그인.
 * Vercel 서버리스 함수와 동일한 파싱 로직을 사용한다.
 */
export function smssDevProxy(): Plugin {
	return {
		name: "smss-dev-proxy",
		configureServer(server) {
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
