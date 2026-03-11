# 프로젝트 구조 가이드

## 프로젝트 루트 구조

공공 API를 직접 호출하는 프론트엔드 전용 프로젝트이다. 별도 백엔드 서버 없이 운영한다.

```
프로젝트-루트/
├── .vscode/                    # VSCode 설정 (settings.json, extensions.json 등)
├── .github/                    # GitHub Actions 워크플로우
│   └── workflows/
├── api/                        # Vercel Serverless Functions (API 프록시)
├── scripts/                    # 데이터 수집/분석 스크립트
│   ├── captureTrainMovement.ts # 열차 이동 데이터 캡처
│   ├── collectApiData.ts       # 공공 API 데이터 수집
│   └── generate-og.mjs         # OG 이미지 생성
├── src/
│   ├── app/                    # 앱 진입점, 라우팅 설정
│   ├── canvas/                 # PixiJS 렌더링 엔진
│   │   ├── renderer/           # PixiJS Application 초기화, 렌더 루프
│   │   ├── animation/          # 60fps 열차 애니메이션 엔진
│   │   ├── objects/            # 렌더링 객체 (역, 노선, 열차 입자)
│   │   └── interactions/       # 줌/팬, 클릭 이벤트 처리
│   ├── components/             # React 컴포넌트
│   │   ├── ui/                 # 기본 UI 컴포넌트 (Button, Panel 등)
│   │   ├── layout/             # 레이아웃 컴포넌트 (Header, Sidebar 등)
│   │   └── feature/            # 기능별 컴포넌트 (StationInspector, TrainTracker 등)
│   ├── hooks/                  # 커스텀 훅
│   ├── data/                   # 정적 데이터 (지하철역 좌표, 노선 그래프 JSON)
│   ├── lib/                    # 외부 라이브러리 설정
│   ├── services/               # 공공 API 호출 함수
│   ├── stores/                 # Zustand 상태 관리
│   ├── types/                  # TypeScript 타입 정의
│   ├── utils/                  # 유틸리티 함수 (보간 알고리즘 등)
│   └── constants/              # 상수 정의 (호선 색상, API URL 등)
├── tests/                      # 테스트 파일
│   ├── fixtures/               # API 응답 픽스처 데이터
│   └── utils/helpers/          # 테스트 헬퍼 유틸리티
├── docs/                       # 프로젝트 문서
├── public/                     # 정적 파일
├── .env.example                # 환경변수 키 목록 (Git 추적)
├── .env.local                  # 로컬 환경변수 (Git 미추적)
├── index.html
├── biome.json                  # Biome 설정
├── components.json             # shadcn/ui 설정
├── lefthook.yml                # Git 훅 설정
├── package.json
├── tsconfig.json
├── vite.config.ts
└── CLAUDE.md                   # Claude Code 규칙
```

## 주요 디렉토리 설명

### `src/canvas/` — PixiJS 렌더링 엔진

PixiJS 기반의 시각화 렌더링 코드를 포함한다. React 컴포넌트와 분리하여 렌더링 로직을 독립적으로 관리한다.

```
src/canvas/
├── renderer/
│   └── PixiApp.ts              # PixiJS Application 초기화 및 설정
├── animation/
│   └── TrainAnimator.ts        # 60fps 열차 애니메이션 엔진
├── objects/
│   ├── StationNode.ts          # 역 노드 렌더링 객체
│   ├── StationLabel.ts         # 역 레이블 렌더링 객체
│   ├── LineLink.ts             # 노선 연결선 렌더링 객체
│   ├── TrainParticle.ts        # 열차 입자 렌더링 객체
│   ├── TrainTrail.ts           # 열차 모션 트레일
│   ├── CongestionHeatmap.ts    # 혼잡도 히트맵
│   └── RoutePath.ts            # 경로 탐색 결과 렌더링
└── interactions/
    ├── zoomPan.ts              # 줌/팬 인터랙션
    ├── stationClick.ts         # 역 클릭 이벤트
    └── trainClick.ts           # 열차 클릭 이벤트
```

### `src/data/` — 정적 데이터

공공데이터포털에서 다운로드한 지하철역 좌표 및 노선 데이터를 JSON 형태로 관리한다.

```ts
// src/data/stations.json — Node-Link 그래프의 Nodes
[
  { "id": "0150", "name": "서울역", "line": 1, "x": 126.9726, "y": 37.5547 },
  // ...
]

// src/data/links.json — Node-Link 그래프의 Links
[
  { "source": "0150", "target": "0151", "line": 1 },
  // ...
]
```

### `src/services/` — 공공 API 호출

서울열린데이터광장 API를 호출하는 함수를 포함한다.

```ts
// src/services/trainApi.ts
const API_KEY = import.meta.env.VITE_SEOUL_API_KEY;

export async function fetchLineTrains(line: string): Promise<TrainPosition[]> {
  const response = await fetch(
    `http://swopenAPI.seoul.go.kr/api/subway/${API_KEY}/json/realtimePosition/0/100/${line}`
  );

  if (!response.ok) {
    throw new Error(`API 호출 실패: ${response.status}`);
  }

  const data: SeoulApiResponse = await response.json();
  return parseTrainPositions(data.realtimePositionList);
}
```

### `src/stores/` — Zustand 상태 관리

실시간 열차 데이터, 선택된 역/열차 정보, UI 상태를 Zustand 스토어로 관리한다.

```ts
// src/stores/useTrainStore.ts
import { create } from "zustand";

interface TrainState {
  rawPositions: TrainPosition[];
  interpolatedTrains: InterpolatedTrain[];
  selectedTrainNo: string | null;
  updatePositions: (positions: TrainPosition[], ...) => void;
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

### `src/types/` — 타입 정의

```ts
// src/types/station.ts
export interface Station {
  id: string;
  name: string;
  line: number;
  x: number;
  y: number;
}

// src/types/train.ts
export interface TrainPosition {
  trainNo: string;
  stationId: string;
  stationName: string;
  line: number;
  direction: "상행" | "하행";
  status: "진입" | "도착" | "출발";
}

export interface InterpolatedTrain {
  trainNo: string;
  line: number;
  x: number;
  y: number;
  /** 열차가 물리적으로 위치한 역의 화면 X 좌표 */
  stationX: number;
  /** 열차가 물리적으로 위치한 역의 화면 Y 좌표 */
  stationY: number;
  direction: "상행" | "하행";
  progress: number;
  fromStationId: string;
  toStationId: string;
  trackAngle: number;
}
```

## 경로 Alias 설정

`@/` 경로 alias를 설정하여 상대 경로 대신 절대 경로를 사용한다.

### tsconfig.json

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### vite.config.ts

```ts
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
```

사용 예시:

```ts
// 좋은 예: alias 사용
import { useTrainStore } from "@/stores/useTrainStore";

// 나쁜 예: 상대 경로
import { useTrainStore } from "../../../stores/useTrainStore";
```

## 환경변수 파일 구조

| 파일 | 역할 | Git 추적 | 비고 |
|------|------|----------|------|
| `.env.example` | 환경변수 키 목록 (값 없음) | O | 팀원 온보딩용 |
| `.env.local` | 로컬 개발용 실제 값 | X | 각 개발자가 생성 |
| `.env` | 빌드/배포 시 사용 | X | CI/CD에서 주입 |

Vite 프로젝트에서는 클라이언트에서 접근할 환경변수에 `VITE_` 접두사를 붙인다.

상세 설정은 [개발 환경 셋업 가이드](dev-environment.md)를 참조한다.

## 네이밍 컨벤션

### 파일/폴더 이름

| 대상 | 규칙 | 예시 |
|------|------|------|
| React 컴포넌트 파일 | `PascalCase.tsx` | `StationInspector.tsx` |
| 훅 파일 | `camelCase.ts` | `useTrainData.ts` |
| 서비스 파일 | `camelCase.ts` | `trainPositionService.ts` |
| 유틸리티 파일 | `camelCase.ts` | `interpolation.ts` |
| 타입 파일 | `camelCase.ts` | `train.ts` |
| 테스트 파일 | `*.test.ts(x)` | `TrainPulse.test.ts` |
| 상수 파일 | `camelCase.ts` | `lineColors.ts` |
| Canvas 객체 파일 | `PascalCase.ts` | `TrainPulse.ts` |

### 코드 네이밍

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | `PascalCase` | `StationInspector`, `TrainTracker` |
| 함수 | `camelCase` | `fetchTrainPositions`, `interpolatePosition` |
| 변수 | `camelCase` | `trainList`, `isFollowing` |
| 상수 | `UPPER_SNAKE_CASE` | `API_BASE_URL`, `LINE_COLORS` |
| 타입/인터페이스 | `PascalCase` | `Station`, `TrainPosition` |
| 커스텀 훅 | `use` 접두사 + `camelCase` | `useTrainData`, `useStationSelect` |
| 이벤트 핸들러 | `handle` 접두사 | `handleStationClick`, `handleTrainFollow` |
| Boolean 변수 | `is`/`has`/`should` 접두사 | `isFollowing`, `hasArrived` |

### 컴포넌트 구조

하나의 컴포넌트 파일은 다음 순서로 구성한다:

```tsx
// 1. import 문
import { useState } from "react";
import { useTrainStore } from "@/stores/useTrainStore";
import type { Station } from "@/types/station";

// 2. 타입 정의
interface StationInspectorProps {
  station: Station;
  onClose: () => void;
}

// 3. 컴포넌트 함수
export function StationInspector({ station, onClose }: StationInspectorProps) {
  // 3-1. 훅
  const trains = useTrainStore((state) => state.trains);

  // 3-2. 이벤트 핸들러
  const handleClose = () => {
    onClose();
  };

  // 3-3. 렌더링
  return <div>{/* ... */}</div>;
}
```

## 관련 문서

- [디자인 가이드](design-guide.md)
- [린트 설정](lint-config.md)
- [보안 가이드](security-guide.md)
- [개발 환경 셋업](dev-environment.md)
- [상태 관리 전략](state-management.md)
