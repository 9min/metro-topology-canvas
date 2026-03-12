# CLAUDE.md - Seoul Metro Pulse 프로젝트 규칙

## 프로젝트 개요

서울 지하철 네트워크를 PixiJS 기반의 실시간 관제 대시보드로 시각화하는 초실감형 웹 앱. 공공 API 데이터를 클라이언트 보간 알고리즘으로 보정하여 60fps 매끄러운 열차 모션을 구현한다.

## 기술 스택

- **프론트엔드**: Vite + React + TypeScript
- **렌더링 엔진**: PixiJS (Canvas/WebGL)
- **상태 관리**: Zustand
- **CSS**: Tailwind CSS
- **린트/포매팅**: Biome
- **테스트**: Vitest
- **배포**: Vercel
- **데이터 소스**: 서울메트로 SMSS (1~8호선) + 서울열린데이터광장 공공 API (9호선)
- **버전 관리**: Git (GitHub Flow)

## 핵심 규칙

### 언어

- 코드 내 주석, 커밋 메시지, PR 설명 등 모든 문서는 **한국어**로 작성한다.

### 코드 스타일

- Biome 설정을 따른다. (`biome.json` 참조)
- TypeScript strict 모드를 사용한다.
- `any` 타입 사용을 금지한다. 불가피한 경우 `unknown`을 사용하고 타입 가드를 적용한다.
- 함수형 컴포넌트와 훅을 사용한다. 클래스 컴포넌트는 사용하지 않는다.
- 네이밍 컨벤션:
  - 컴포넌트: `PascalCase`
  - 함수/변수: `camelCase`
  - 상수: `UPPER_SNAKE_CASE`
  - 타입/인터페이스: `PascalCase`
  - 파일명: 컴포넌트는 `PascalCase.tsx`, 그 외는 `camelCase.ts`

### 브랜치 전략

- GitHub Flow 기반: `main` → `feature/*`, `fix/*`, `hotfix/*`
- 직접 `main` 푸시 금지. 반드시 PR을 통해 머지한다.

### 커밋 컨벤션

- Gitmoji + Conventional Commits 형식
- 예: `✨ feat: 사용자 로그인 기능 추가`
- 예: `🐛 fix: 토큰 만료 시 리다이렉트 오류 수정`

### 테스트

- 새로운 기능에는 반드시 테스트 코드를 포함한다.
- Vitest를 사용하며, 테스트 파일은 `*.test.ts` 또는 `*.test.tsx` 형식을 따른다.

### 프로젝트 고유 규칙

- 외부 API 통신은 `src/services/` 디렉토리에서 관리한다. 브라우저에서 직접 호출할 수 없는 API는 `api/` 디렉토리의 Vercel Edge Function을 프록시로 경유한다.
- PixiJS 관련 코드는 `src/canvas/` 디렉토리에 분리한다.
- 지하철역 좌표/노선 정적 데이터는 `src/data/` 디렉토리에 JSON으로 관리한다.
- 실시간 열차 데이터와 UI 상태는 Zustand 스토어로 관리한다.
- 공공 API 키는 환경변수(`VITE_SEOUL_API_KEY`)로 관리하며 코드에 하드코딩하지 않는다.

### 보안

- 환경변수로 시크릿을 관리한다. 코드에 하드코딩 금지.
- 공공 API 키는 클라이언트에 노출 가능하나, 남용 방지를 위해 요청 횟수를 관리한다.
- 사용자 입력은 반드시 검증하고 새니타이즈한다.
- OWASP Top 10을 준수한다.

### 에러 처리

- 프론트엔드: Error Boundary + try-catch 패턴
- API 호출: try-catch로 에러를 처리하고, 실패 시 사용자에게 안내한다.

## 상세 문서 참조

각 항목에 대한 상세 내용은 아래 문서를 참조한다.

| 문서 | 설명 |
|------|------|
| [docs/git-workflow.md](docs/git-workflow.md) | Git 워크플로우 및 브랜치 전략 |
| [docs/commit-convention.md](docs/commit-convention.md) | 커밋 메시지 컨벤션 |
| [docs/project-structure.md](docs/project-structure.md) | 프로젝트 폴더 구조 가이드 |
| [docs/lint-config.md](docs/lint-config.md) | Biome 린트/포매팅 설정 |
| [docs/design-guide.md](docs/design-guide.md) | 디자인 가이드 (UI 컨벤션 + 디자인 시스템) |
| [docs/testing-guide.md](docs/testing-guide.md) | 테스트 코드 가이드 |
| [docs/security-guide.md](docs/security-guide.md) | 보안 가이드 |
| [docs/cicd-guide.md](docs/cicd-guide.md) | CI/CD 설정 가이드 |
| [docs/code-review-checklist.md](docs/code-review-checklist.md) | 코드 리뷰 체크리스트 |
| [docs/error-handling.md](docs/error-handling.md) | 에러 핸들링 가이드 |
| [docs/dev-environment.md](docs/dev-environment.md) | 개발 환경 셋업 가이드 |
| [docs/state-management.md](docs/state-management.md) | 상태 관리 전략 |
| [docs/performance-guide.md](docs/performance-guide.md) | 성능 최적화 가이드 |
| [docs/data-modeling.md](docs/data-modeling.md) | 데이터 모델링 가이드 |
| [docs/prd.md](docs/prd.md) | 제품 요구사항 문서 (PRD) |
