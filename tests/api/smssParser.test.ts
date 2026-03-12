import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchSmssTrains } from "../../api/smssParser";

/** SMSS HTML 응답을 생성하는 헬퍼 */
function buildSmssHtml(divs: Array<{ className: string; title: string }>): string {
	const divsHtml = divs
		.map((d) => `<div class="${d.className}" title="${d.title}"></div>`)
		.join("\n");
	return `<html><body>${divsHtml}</body></html>`;
}

describe("fetchSmssTrains — directionFromClass 매핑", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("_1_v2 클래스는 하행으로 파싱된다", async () => {
		const html = buildSmssHtml([
			{
				className: "T0601_Y_1_v2",
				title: "2490열차  안암 출발 봉화산행",
			},
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([6]);

		expect(trains).toHaveLength(1);
		expect(trains[0].direction).toBe("하행");
		expect(trains[0].stationName).toBe("안암");
		expect(trains[0].trainNo).toBe("2490");
		expect(trains[0].status).toBe("출발");
	});

	it("_2_v2 클래스는 상행으로 파싱된다", async () => {
		const html = buildSmssHtml([
			{
				className: "T0602_Y_2_v2",
				title: "2491열차  보문 도착 응암행",
			},
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([6]);

		expect(trains).toHaveLength(1);
		expect(trains[0].direction).toBe("상행");
		expect(trains[0].stationName).toBe("보문");
		expect(trains[0].trainNo).toBe("2491");
		expect(trains[0].status).toBe("도착");
	});

	it("CSS 클래스에 _v2 패턴이 없으면 기본값 상행을 반환한다", async () => {
		const html = buildSmssHtml([
			{
				className: "T0601_Y_unknown",
				title: "2492열차  고려대 접근 봉화산행",
			},
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([6]);

		expect(trains).toHaveLength(1);
		expect(trains[0].direction).toBe("상행");
	});
});

describe("fetchSmssTrains — parseTitle", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("K 접두사(코레일) 열차는 제외된다", async () => {
		const html = buildSmssHtml([
			{
				className: "T0101_Y_1_v2",
				title: "K1234열차  서울역 출발 인천행",
			},
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([1]);
		expect(trains).toHaveLength(0);
	});

	it("이동 상태는 출발로 매핑된다", async () => {
		const html = buildSmssHtml([
			{
				className: "T0301_Y_2_v2",
				title: "3001열차  옥수 이동 대화행",
			},
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([3]);

		expect(trains).toHaveLength(1);
		expect(trains[0].status).toBe("출발");
		expect(trains[0].stationName).toBe("옥수");
	});

	it("유효하지 않은 title은 무시된다", async () => {
		const html = buildSmssHtml([
			{ className: "T0101_Y_1_v2", title: "짧은텍스트" },
			{ className: "T0101_Y_1_v2", title: "" },
		]);

		const mockResponse = {
			ok: true,
			text: () => Promise.resolve(html),
		};
		vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

		const trains = await fetchSmssTrains([1]);
		expect(trains).toHaveLength(0);
	});

	it("유효 범위(1-8) 밖의 호선은 무시된다", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue({
			ok: true,
			text: () => Promise.resolve("<html></html>"),
		} as Response);

		const trains = await fetchSmssTrains([0, 9, 10]);
		expect(trains).toHaveLength(0);
		expect(mockFetch).not.toHaveBeenCalled();
	});
});
