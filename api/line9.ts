// GET /api/line9?lineName=9호선
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
	if (req.method !== "GET") {
		res.status(405).json({ error: "GET만 허용됩니다" });
		return;
	}

	const apiKey = process.env.VITE_SEOUL_API_KEY;
	if (!apiKey) {
		res.status(500).json({ error: "API 키가 설정되지 않았습니다" });
		return;
	}

	const lineName = String(req.query.lineName ?? "9호선");
	const url = `http://swopenAPI.seoul.go.kr/api/subway/${apiKey}/json/realtimePosition/0/100/${lineName}`;

	try {
		const response = await fetch(url);
		if (!response.ok) {
			res.status(502).json({ error: `서울 API 오류: ${response.status}` });
			return;
		}
		const data = (await response.json()) as unknown;
		res.status(200).json(data);
	} catch {
		res.status(502).json({ error: "서울 API 호출 실패" });
	}
}
