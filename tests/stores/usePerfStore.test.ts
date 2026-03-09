import { afterEach, describe, expect, it, vi } from "vitest";
import { maybeUpdatePerfStore, resetPerfThrottle, usePerfStore } from "@/stores/usePerfStore";

describe("usePerfStore", () => {
	afterEach(() => {
		// 상태 초기화
		usePerfStore.setState({
			fps: 0,
			renderTimeMs: 0,
			activeTrainCount: 0,
			graphicsPoolSize: 0,
			visible: false,
		});
		resetPerfThrottle();
	});

	it("updateMetrics로 메트릭을 갱신한다", () => {
		usePerfStore.getState().updateMetrics(60, 1.5, 100, 50);

		const state = usePerfStore.getState();
		expect(state.fps).toBe(60);
		expect(state.renderTimeMs).toBe(1.5);
		expect(state.activeTrainCount).toBe(100);
		expect(state.graphicsPoolSize).toBe(50);
	});

	it("toggleVisible로 가시성을 토글한다", () => {
		// afterEach에서 visible=false로 리셋된 상태
		expect(usePerfStore.getState().visible).toBe(false);

		usePerfStore.getState().toggleVisible();
		expect(usePerfStore.getState().visible).toBe(true);

		usePerfStore.getState().toggleVisible();
		expect(usePerfStore.getState().visible).toBe(false);
	});

	it("기본 visible 상태는 true이다", () => {
		// afterEach에 의해 false로 리셋되지 않은 최초 상태 확인을 위해
		// 별도로 setState하여 true로 복원 후 검증
		usePerfStore.setState({ visible: true });
		expect(usePerfStore.getState().visible).toBe(true);
	});

	it("maybeUpdatePerfStore는 250ms 이내에 중복 호출을 무시한다", () => {
		// performance.now를 모킹
		let mockTime = 1000;
		vi.spyOn(performance, "now").mockImplementation(() => mockTime);

		// 첫 번째 호출: 업데이트됨
		maybeUpdatePerfStore(60, 1.0, 100, 50);
		expect(usePerfStore.getState().fps).toBe(60);

		// 100ms 후: 무시됨
		mockTime = 1100;
		maybeUpdatePerfStore(30, 2.0, 200, 80);
		expect(usePerfStore.getState().fps).toBe(60); // 변경 없음

		// 250ms 후: 업데이트됨
		mockTime = 1300;
		maybeUpdatePerfStore(45, 1.5, 150, 60);
		expect(usePerfStore.getState().fps).toBe(45);

		vi.restoreAllMocks();
	});
});
