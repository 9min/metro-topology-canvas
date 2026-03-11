# 개발 환경 셋업 가이드

## 사전 요구사항

| 도구 | 최소 버전 | 비고 |
|------|----------|------|
| Node.js | >= 20 | LTS 권장 |
| npm | >= 10 | Node.js 20과 함께 설치됨 |

## 환경변수 설정

### 파일 역할

| 파일 | 역할 | Git 추적 |
|------|------|----------|
| `.env.example` | 환경변수 키 목록 (값 없음). 팀원 온보딩용 | O |
| `.env.local` | 로컬 개발용 실제 값. 각 개발자가 생성 | X |
| `.env` | 빌드/배포 시 사용. CI/CD에서 주입 | X |

### .env.local 구성 예시

```
VITE_SEOUL_API_KEY=서울열린데이터광장에서_발급받은_인증키
VITE_SEOUL_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway
```

서울열린데이터광장(https://data.seoul.go.kr)에서 회원가입 후 인증키를 발급받는다.

### 환경별 관리

| 환경 | API_KEY | 관리 방식 |
|------|---------|----------|
| 로컬 | 개인 발급 키 | `.env.local` |
| Preview | 테스트용 키 | Vercel 환경변수 |
| Production | 프로덕션 키 | Vercel 환경변수 |

## IDE 설정

### VSCode 필수 확장

| 확장 | ID | 용도 |
|------|----|------|
| Biome | `biomejs.biome` | 린트/포매팅 |
| Tailwind CSS IntelliSense | `bradlc.vscode-tailwindcss` | Tailwind 자동완성 |
| ES7+ React Snippets | `dsznajder.es7-react-js-snippets` | React 스니펫 |

### .vscode/settings.json 예제

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cn\\(([^)]*)\\)", "'([^']*)'"]
  ]
}
```

### .vscode/extensions.json 예제

```json
{
  "recommendations": [
    "biomejs.biome",
    "bradlc.vscode-tailwindcss",
    "dsznajder.es7-react-js-snippets"
  ]
}
```

### 디버깅 설정 (.vscode/launch.json)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Vite 디버깅",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/src"
    }
  ]
}
```

## 로컬 개발 실행

### 실행 순서

```bash
# 1. .env.local 파일 확인 (없으면 .env.example 복사 후 값 입력)
cp .env.example .env.local

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm run dev
```

### package.json scripts 예제

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "biome check --write .",
    "lint:check": "biome check .",
    "test": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| `.env.local` 미인식 | Vite 환경변수 접두사 누락 | `VITE_` 접두사 확인 |
| API 호출 실패 | 인증키 미설정 또는 만료 | 서울열린데이터광장에서 키 확인 |
| PixiJS 렌더링 안 됨 | WebGL 미지원 브라우저 | Chrome/Edge 최신 버전 사용 |
| Tailwind 클래스 미적용 | `tailwind.config.js` content 경로 확인 | `src/**/*.{ts,tsx}` 포함 확인 |

## 관련 문서

- [프로젝트 구조](project-structure.md)
- [린트 설정](lint-config.md)
- [CI/CD 가이드](cicd-guide.md)
