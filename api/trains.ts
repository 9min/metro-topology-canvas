import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchSmssTrains } from "./smssParser.js";

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
	if (req.method !== "POST") {
		res.status(405).json({ error: "POST만 허용됩니다" });
		return;
	}

	const { lines } = req.body as { lines?: number[] };
	if (!Array.isArray(lines) || lines.length === 0) {
		res.status(400).json({ error: "lines 배열이 필요합니다" });
		return;
	}

	const trains = await fetchSmssTrains(lines);
	res.status(200).json({ trains });
}
