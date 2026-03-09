import type { Container, Graphics } from "pixi.js";
import { TRAIN_ANIMATION_DURATION_MS } from "@/constants/mapConfig";
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import type { AnimatedTrainState, InterpolatedTrain } from "@/types/train";
import { easeInOutCubic } from "@/utils/easing";
import { drawAnimatedTrains } from "../objects/TrainParticle";

/**
 * 열차 애니메이션 엔진.
 * PixiJS ticker에서 매 프레임 update()를 호출하여 열차 위치를 보간한다.
 * React 외부에서 동작하며, 폴링으로 새 데이터가 도착하면 setTargets()로 갱신한다.
 */
export class TrainAnimator {
	private states: Map<string, AnimatedTrainState> = new Map();
	private trainsLayer: Container | null = null;
	private graphicsPool: Map<string, Graphics> = new Map();
	private onTrainTap: ((trainNo: string) => void) | null = null;

	/** 렌더링 대상 레이어를 설정한다 */
	setLayer(layer: Container): void {
		this.trainsLayer = layer;
	}

	/** 열차 클릭 콜백을 등록한다 */
	setOnTrainTap(callback: (trainNo: string) => void): void {
		this.onTrainTap = callback;
	}

	/** 특정 열차의 현재 애니메이션 상태를 반환한다 */
	getTrainState(trainNo: string): AnimatedTrainState | undefined {
		return this.states.get(trainNo);
	}

	/**
	 * 새 폴링 데이터가 도착하면 호출한다.
	 * 기존 열차는 현재 위치 → 새 목표로 애니메이션을 시작한다.
	 * 신규 열차는 목표 위치에 즉시 배치한다.
	 * 사라진 열차는 제거한다.
	 */
	setTargets(interpolated: InterpolatedTrain[]): void {
		const now = performance.now();
		const newKeys = new Set<string>();

		for (const train of interpolated) {
			newKeys.add(train.trainNo);

			const existing = this.states.get(train.trainNo);
			if (existing !== undefined) {
				// 기존 열차: 현재 위치에서 새 목표로 전환
				existing.startX = existing.currentX;
				existing.startY = existing.currentY;
				existing.targetX = train.x;
				existing.targetY = train.y;
				existing.startTime = now;
				existing.duration = TRAIN_ANIMATION_DURATION_MS;
				existing.fromStationId = train.fromStationId;
				existing.toStationId = train.toStationId;
				existing.direction = train.direction;
				existing.path = [
					{ x: existing.currentX, y: existing.currentY },
					{ x: train.x, y: train.y },
				];
			} else {
				// 신규 열차: 목표 위치에 즉시 배치
				this.states.set(train.trainNo, {
					trainNo: train.trainNo,
					line: train.line,
					direction: train.direction,
					startX: train.x,
					startY: train.y,
					targetX: train.x,
					targetY: train.y,
					currentX: train.x,
					currentY: train.y,
					startTime: now,
					duration: 0,
					fromStationId: train.fromStationId,
					toStationId: train.toStationId,
					path: [{ x: train.x, y: train.y }],
				});
			}
		}

		// 사라진 열차 제거 (states + pool)
		for (const key of this.states.keys()) {
			if (!newKeys.has(key)) {
				this.states.delete(key);
				const gfx = this.graphicsPool.get(key);
				if (gfx !== undefined && this.trainsLayer !== null) {
					this.trainsLayer.removeChild(gfx);
				}
				this.graphicsPool.delete(key);
			}
		}
	}

	/**
	 * 매 프레임 호출 — 이징으로 열차 위치를 보간하고 렌더링한다.
	 * PixiJS ticker의 콜백으로 등록한다.
	 */
	update(): void {
		if (this.trainsLayer === null) return;

		const now = performance.now();
		const trainList: AnimatedTrainState[] = [];

		for (const state of this.states.values()) {
			if (state.duration <= 0) {
				// 즉시 배치된 열차 (신규 또는 애니메이션 완료)
				state.currentX = state.targetX;
				state.currentY = state.targetY;
			} else {
				const elapsed = now - state.startTime;
				const rawT = Math.min(elapsed / state.duration, 1);
				const t = easeInOutCubic(rawT);

				state.currentX = state.startX + (state.targetX - state.startX) * t;
				state.currentY = state.startY + (state.targetY - state.startY) * t;
			}

			trainList.push(state);
		}

		const selectedTrainNo = useTrainStore.getState().selectedTrainNo;
		const selectedStation = useStationStore.getState().selectedStation;

		drawAnimatedTrains(
			this.trainsLayer,
			trainList,
			this.graphicsPool,
			selectedTrainNo,
			selectedStation?.id ?? null,
			this.onTrainTap ?? ((_no: string) => {}),
		);
	}

	/** 전체 상태를 초기화한다 */
	clear(): void {
		this.states.clear();
		this.graphicsPool.clear();
		if (this.trainsLayer !== null) {
			this.trainsLayer.removeChildren();
		}
	}

	/** 현재 애니메이션 중인 열차 수 */
	get count(): number {
		return this.states.size;
	}
}
