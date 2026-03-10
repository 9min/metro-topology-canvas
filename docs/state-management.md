# 상태 관리 전략

## 상태 분류

| 구분 | 정의 | 예시 | 관리 도구 |
|------|------|------|----------|
| 서버 상태 | 공공 API에서 가져오는 비동기 데이터 | 실시간 열차 위치 | fetch + Zustand |
| 클라이언트 상태 | 클라이언트에서만 존재하는 전역 상태 | 선택된 역/열차, 줌 레벨, 테마 | Zustand |
| UI 상태 | 특정 컴포넌트의 로컬 상태 | 패널 열림, 입력값 | useState / useReducer |

## Zustand 스토어 설계

이 프로젝트에서는 실시간 열차 데이터, 역/열차 선택 상태, UI 상태 등 전역 상태가 다수이고 업데이트가 빈번하므로 **Zustand**를 주 상태 관리 도구로 사용한다.

### 스토어 분리 원칙

도메인별로 스토어를 분리하여 관리한다.

```
src/stores/
├── useTrainStore.ts        # 실시간 열차 위치 데이터, 선택된 열차
├── useStationStore.ts      # 역 선택 상태, 스테이션 인스펙터
├── useMapStore.ts          # 줌/팬 상태, 활성 노선 필터, 히트맵 토글
├── useSimulationStore.ts   # 시뮬레이션/실제운행 모드 상태 (AppMode)
└── usePerfStore.ts         # 성능 모니터링 메트릭 (FPS, 렌더 시간 등)
```

### 열차 상태 스토어

```ts
// src/stores/useTrainStore.ts
import { create } from "zustand";
import type { TrainPosition, InterpolatedTrain } from "@/types/train";

interface TrainState {
  // 원본 API 데이터
  rawPositions: TrainPosition[];
  // 보간된 열차 위치 (렌더링용)
  interpolatedTrains: InterpolatedTrain[];
  // 선택된 열차 번호
  selectedTrainNo: string | null;

  updatePositions: (
    positions: TrainPosition[],
    stationScreenMap: Map<string, ScreenCoord>,
    adjacencyMap: Map<string, AdjacencyInfo>,
  ) => void;
  selectTrain: (trainNo: string | null) => void;
  clearPositions: () => void;
}

export const useTrainStore = create<TrainState>((set, get) => ({
  rawPositions: [],
  interpolatedTrains: [],
  selectedTrainNo: null,
  // ...
}));
```

### 역 선택 스토어

```ts
// src/stores/useStationStore.ts
import { create } from "zustand";
import type { Station } from "@/types/station";

interface StationState {
  selectedStation: Station | null;
  selectStation: (station: Station | null) => void;
}

export const useStationStore = create<StationState>()((set) => ({
  selectedStation: null,
  selectStation: (station) => set({ selectedStation: station }),
}));
```

### 맵 상태 스토어

```ts
// src/stores/useMapStore.ts
import { create } from "zustand";

interface MapState {
  scale: number;
  offsetX: number;
  offsetY: number;
  isDragging: boolean;
  activeLines: Set<number>;
  heatmapEnabled: boolean;
  setScale: (scale: number) => void;
  setOffset: (x: number, y: number) => void;
  toggleLine: (line: number, enabledLines: Set<number>) => void;
  toggleHeatmap: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  isDragging: false,
  activeLines: new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  heatmapEnabled: false,
  // ...
}));
```

### 시뮬레이션 모드 스토어

```ts
// src/stores/useSimulationStore.ts
import { create } from "zustand";

export type AppMode = "simulation" | "live";

interface SimulationState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export const useSimulationStore = create<SimulationState>((set) => ({
  mode: "simulation",
  setMode: (mode) => set({ mode }),
}));
```

## Zustand 사용 패턴

### selector로 리렌더링 최적화

필요한 상태만 선택하여 불필요한 리렌더링을 방지한다.

```tsx
// 좋은 예: 필요한 상태만 구독
const selectedTrainNo = useTrainStore((state) => state.selectedTrainNo);

// 나쁜 예: 전체 스토어 구독 (불필요한 리렌더링 발생)
const trainStore = useTrainStore();
```

### PixiJS와 Zustand 연동

PixiJS 렌더 루프에서는 React 리렌더링 없이 `getState()`로 직접 접근한다.

```ts
// src/canvas/animation/TrainAnimator.ts (update 메서드 내부)
import { useTrainStore } from "@/stores/useTrainStore";

// PixiJS ticker 콜백 — React 리렌더링 없이 상태 직접 접근
update(): void {
  const selectedTrainNo = useTrainStore.getState().selectedTrainNo;
  // 열차 위치 보간 및 렌더링
}
```

### 스토어 간 의존성

스토어 간 직접 의존은 피하고, 컴포넌트나 훅에서 여러 스토어를 조합한다.

```tsx
// 여러 스토어를 컴포넌트에서 조합하는 예시
import { useStationStore } from "@/stores/useStationStore";
import { useTrainStore } from "@/stores/useTrainStore";
import { useMapStore } from "@/stores/useMapStore";

function StationPanel() {
  const selectedStation = useStationStore((s) => s.selectedStation);
  const trains = useTrainStore((s) => s.interpolatedTrains);
  const activeLines = useMapStore((s) => s.activeLines);

  const stationTrains = trains.filter(
    (t) => t.fromStationId === selectedStation?.id || t.toStationId === selectedStation?.id,
  );

  return { selectedStation, stationTrains, activeLines };
}
```

## UI 상태 관리

| 도구 | 사용 시점 | 예시 |
|------|----------|------|
| `useState` | 단순 토글, 단일 값 | 패널 열림, 탭 선택 |
| `useReducer` | 복잡한 상태 로직, 여러 필드 연관 | 다단계 필터 |

## 관련 문서

- [프로젝트 구조](project-structure.md)
- [성능 최적화 가이드](performance-guide.md)
