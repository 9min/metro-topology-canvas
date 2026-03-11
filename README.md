# Seoul Metro Pulse

> 도시의 혈관을 흐르는 맥박을 시각화하다.

서울 지하철 네트워크 전체를 PixiJS 기반으로 렌더링하고, 실제 운행 중인 수백 대의 열차가 역과 역 사이를 빛의 입자처럼 60fps로 매끄럽게 흘러가는 초실감형 실시간 관제 대시보드.

[![Deploy](https://img.shields.io/badge/demo-seoul--metro--pulse.vercel.app-000?style=flat&logo=vercel)](https://seoul-metro-pulse.vercel.app)

![Seoul Metro Pulse](public/og-image.png)

---

## 주요 기능

### 라이브 펄스 네트워크 맵

수백 개의 빛나는 입자(열차)가 1~9호선 노선을 따라 실시간으로 이동한다. 시맨틱 줌을 적용하여 줌아웃 시 전체 노선 흐름을, 줌인 시 역 이름과 열차 상세 정보를 확인할 수 있다.

### 스테이션 인스펙터

역을 클릭하면 화면이 어두워지며 해당 역에 연결된 열차만 하이라이트된다. 우측 패널에 실시간 도착 예정 정보가 전광판 스타일로 표시된다.

### 트레인 트래커

열차를 클릭하면 카메라가 해당 열차를 자동 추적한다. 다음 역까지의 진행 상황을 프로그레스 바로 확인할 수 있다.

### 경로 탐색

출발역과 도착역을 선택하면 최적 경로를 시각화하고 환승 정보와 예상 소요 시간을 제공한다.

### 시뮬레이션 모드

운행 시간 외에도 300대의 가상 열차가 전 노선을 순환하며 대시보드를 체험할 수 있다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | React 19 · TypeScript · Vite 7 |
| 렌더링 엔진 | PixiJS 8 (WebGL/Canvas) |
| 상태 관리 | Zustand |
| 스타일링 | Tailwind CSS 4 |
| 린트/포매팅 | Biome |
| 테스트 | Vitest |
| 배포 | Vercel (Edge Functions) |
| 데이터 소스 | 서울메트로 SMSS (1~8호선) · 서울열린데이터광장 API (9호선) |

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│  브라우저 (React + PixiJS)                                │
│                                                         │
│  ┌──────────┐  폴링(5s)   ┌──────────┐    ┌──────────┐  │
│  │ useTrainPolling ──────▸│ Vercel   │───▸│ SMSS     │  │
│  │          │             │ Edge Fn  │    │ 1~8호선   │  │
│  └────┬─────┘             └──────────┘    └──────────┘  │
│       │                                                 │
│       │  보간 알고리즘      ┌──────────┐    ┌──────────┐  │
│       ├─────────────────▸│ 공공 API  │───▸│ 9호선    │  │
│       │                  │ (30s)    │    │          │  │
│       │                  └──────────┘    └──────────┘  │
│       ▼                                                 │
│  ┌──────────┐  60fps     ┌──────────┐                   │
│  │ Train    │ ──────────▸│ PixiJS   │                   │
│  │ Animator │  등속 보간   │ Canvas   │                   │
│  └──────────┘             └──────────┘                   │
└─────────────────────────────────────────────────────────┘
```

### 클라이언트 추측 항법

API의 5~30초 업데이트 주기를 극복하기 위해 클라이언트에서 열차 위치를 수학적으로 보간한다. 이전/현재 API 응답과 역 간 거리를 기반으로 등속 직선 보간을 적용하여 60fps의 매끄러운 모션을 구현한다.

---

## 시작하기

### 사전 요구사항

- **Node.js** 20+
- **npm** 10+
- [서울열린데이터광장](https://data.seoul.go.kr/) API 키 (9호선 데이터용, 선택)

### 설치

```bash
git clone https://github.com/9min/seoul-metro-pulse.git
cd seoul-metro-pulse
npm install
```

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일을 열고 API 키를 설정한다:

```
VITE_SEOUL_API_KEY=<서울열린데이터광장 API 키>
VITE_SEOUL_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway
```

> API 키 없이도 1~8호선 데이터는 SMSS를 통해 정상 동작한다.

### 개발 서버 실행

```bash
npm run dev
```

http://localhost:5173 에서 확인한다.

---

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `npm run dev` | Vite 개발 서버 실행 (HMR 지원) |
| `npm run build` | TypeScript 컴파일 + 프로덕션 빌드 |
| `npm run preview` | 빌드 결과물 로컬 프리뷰 |
| `npm run lint` | Biome 린트/포매팅 자동 수정 |
| `npm run lint:check` | Biome 린트 검사만 (수정 없음) |
| `npm run test` | Vitest 단위 테스트 실행 |
| `npm run test:coverage` | 코드 커버리지 보고서 생성 |

---

## 키보드 단축키

| 키 | 동작 |
|----|------|
| `Esc` | 선택 해제 |
| `/` | 역 검색 |
| `R` | 경로 탐색 |
| `P` | 성능 모니터 토글 |
| `H` | 혼잡도 히트맵 토글 |
| `D` | 디버그 모드 (열차 번호 표시) |
| `T` | 보간 목표점 마커 토글 |
| `A` | 애니메이션 즉시 이동 |

---

## 프로젝트 구조

```
seoul-metro-pulse/
├── api/                    # Vercel Edge Functions (API 프록시)
├── plugins/                # Vite 커스텀 플러그인 (개발 프록시)
├── scripts/                # 데이터 수집/분석 스크립트
├── src/
│   ├── app/                # 앱 진입점 (main.tsx, App.tsx)
│   ├── canvas/             # PixiJS 렌더링 엔진
│   │   ├── animation/      # 60fps 열차 애니메이션 (TrainAnimator)
│   │   ├── objects/        # 렌더링 객체 (역, 노선, 열차, 트레일)
│   │   ├── interactions/   # 줌/팬, 클릭 이벤트
│   │   └── renderer/       # PixiJS Application 초기화
│   ├── components/         # React UI 컴포넌트
│   ├── constants/          # 상수 (호선 색상, 폴링 주기 등)
│   ├── data/               # 정적 데이터 (역 좌표, 노선 링크 JSON)
│   ├── hooks/              # 커스텀 훅 (폴링, 좌표 변환, 키보드)
│   ├── services/           # API 클라이언트, 시뮬레이터
│   ├── stores/             # Zustand 스토어
│   ├── types/              # TypeScript 타입 정의
│   └── utils/              # 유틸리티 (보간, 경로 탐색, 이징)
├── tests/                  # 테스트 파일
│   ├── fixtures/           # API 응답 픽스처 데이터
│   └── utils/helpers/      # 테스트 헬퍼
└── docs/                   # 프로젝트 문서
```

---

## 데이터 소스

| 소스 | 대상 | 주기 | 방식 |
|------|------|------|------|
| 서울메트로 SMSS | 1~8호선 실시간 열차 위치 | 5초 | Vercel Edge Function → HTML 스크래핑 |
| 서울열린데이터광장 API | 9호선 실시간 열차 위치 | 30초 | 클라이언트 직접 호출 |
| 정적 JSON | 역 좌표, 노선 링크 | - | 빌드 시 번들링 |

---

## 배포

Vercel에 자동 배포된다. `main` 브랜치에 머지하면 프로덕션 배포가 트리거된다.

**CI 파이프라인** (GitHub Actions):

1. 린트 검사 (`npx biome check .`)
2. 타입 검사 (`tsc --noEmit`)
3. 테스트 (`vitest run --coverage`)
4. 빌드 (`tsc && vite build`)

모든 체크가 통과해야 PR 머지가 가능하다.
