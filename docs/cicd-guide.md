# CI/CD 설정 가이드

## Vercel 자동 배포

### 기본 설정

- `main` 브랜치 푸시 시 프로덕션 자동 배포
- PR 생성 시 Preview 배포 자동 생성
- Preview URL은 PR 코멘트에 자동 첨부

### 배포 환경 구분

| 환경 | 트리거 | URL 패턴 |
|------|--------|---------|
| Production | `main` 머지 | `project.vercel.app` |
| Preview | PR 생성/업데이트 | `project-{hash}.vercel.app` |
| Development | 로컬 | `localhost:5173` |

### Preview 배포 활용

- PR 리뷰 시 Preview URL로 실제 동작을 확인한다.
- QA 팀과 Preview URL을 공유하여 사전 검증한다.
- Preview 배포에는 테스트용 환경변수를 사용한다.

## 환경변수 관리

### Vercel 환경변수 설정

각 환경변수에 적용 범위를 지정한다:

| 스코프 | 용도 |
|--------|------|
| Production | 프로덕션 환경에만 적용 |
| Preview | Preview 배포에만 적용 |
| Development | `vercel dev` 실행 시 적용 |

### 민감 정보 관리

- 시크릿은 Vercel 대시보드에서 직접 설정한다.
- `vercel env pull`로 로컬에 동기화할 수 있다.
- `.env*.local` 파일은 `.gitignore`에 포함한다.

## GitHub Actions 연동

### 기본 워크플로우

PR 생성 및 업데이트 시 다음을 자동 실행한다:

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  lint:
    name: 린트 검사
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npx biome check .

  type-check:
    name: 타입 검사
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npx tsc --noEmit

  test:
    name: 테스트
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npx vitest run --coverage

  build:
    name: 빌드
    runs-on: ubuntu-latest
    needs: [lint, type-check, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"
      - run: npm ci
      - run: npm run build
```

### 워크플로우 구성

| Job | 설명 | 필수 |
|-----|------|------|
| `lint` | Biome 린트/포매팅 검사 | O |
| `type-check` | TypeScript 타입 검사 | O |
| `test` | Vitest 테스트 실행 | O |
| `build` | 빌드 성공 확인 | O |

### 브랜치 보호 규칙과 연동

GitHub 저장소 설정에서 다음 상태 체크를 필수로 지정한다:

- `lint`
- `type-check`
- `test`
- `build`

모든 체크가 통과해야 PR 머지가 가능하다.

## 배포 체크리스트

### 프로덕션 배포 전 확인 사항

- [ ] 모든 CI 체크 통과
- [ ] PR 리뷰 승인 완료
- [ ] Preview 배포에서 기능 검증 완료
- [ ] Vercel 환경변수 설정 확인 (`VITE_SEOUL_API_KEY`)
- [ ] 롤백 계획 수립

## 관련 문서

- [Git 워크플로우](git-workflow.md)
- [테스트 가이드](testing-guide.md)
- [린트 설정](lint-config.md)
- [보안 가이드](security-guide.md)
