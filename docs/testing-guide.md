# 테스트 코드 가이드

## 테스트 도구

- **테스트 프레임워크**: Vitest
- **컴포넌트 테스트**: @testing-library/react
- **E2E 테스트**: Playwright (필요 시)

## 테스트 파일 위치 및 네이밍

### 파일 위치

테스트 파일은 `tests/` 디렉토리에 소스 구조를 미러링하여 배치한다.

```
프로젝트-루트/
├── src/
│   ├── canvas/animation/TrainAnimator.ts
│   ├── canvas/objects/TrainParticle.ts
│   ├── hooks/useKeyboardShortcuts.ts
│   ├── services/trainApi.ts
│   ├── stores/useTrainStore.ts
│   └── utils/trainInterpolation.ts
└── tests/
    ├── canvas/animation/TrainAnimator.test.ts
    ├── canvas/objects/TrainParticle.test.ts
    ├── hooks/useKeyboardShortcuts.test.ts
    ├── services/trainApi.test.ts
    ├── stores/useTrainStore.test.ts
    └── utils/trainInterpolation.test.ts
```

### 파일 네이밍

- 단위/통합 테스트: `*.test.ts` 또는 `*.test.tsx`
- E2E 테스트: `*.e2e.test.ts`

## 테스트 종류 및 범위

### 단위 테스트 (Unit Test)

- **대상**: 유틸리티 함수, 커스텀 훅, 서비스 함수, 순수 함수
- **목표**: 개별 함수/모듈의 입출력 검증
- **비율**: 전체 테스트의 약 70%

```ts
import { describe, it, expect } from "vitest";
import { formatDate } from "@/utils/formatDate";

describe("formatDate", () => {
  it("Date 객체를 YYYY-MM-DD 형식으로 변환한다", () => {
    const date = new Date("2024-01-15");
    expect(formatDate(date)).toBe("2024-01-15");
  });

  it("유효하지 않은 날짜에 대해 빈 문자열을 반환한다", () => {
    expect(formatDate(new Date("invalid"))).toBe("");
  });
});
```

### 통합 테스트 (Integration Test)

- **대상**: 컴포넌트, API 엔드포인트, 여러 모듈의 연동
- **목표**: 모듈 간 상호작용 검증
- **비율**: 전체 테스트의 약 20%

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "@/components/LoginForm";

describe("LoginForm", () => {
  it("유효한 입력으로 폼을 제출하면 onSubmit이 호출된다", async () => {
    const handleSubmit = vi.fn();
    render(<LoginForm onSubmit={handleSubmit} isLoading={false} />);

    await userEvent.type(screen.getByLabelText("이메일"), "test@example.com");
    await userEvent.type(screen.getByLabelText("비밀번호"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "로그인" }));

    expect(handleSubmit).toHaveBeenCalledWith("test@example.com", "password123");
  });
});
```

### E2E 테스트 (End-to-End Test)

- **대상**: 핵심 사용자 시나리오 (로그인, 결제 등)
- **목표**: 전체 시스템의 동작 검증
- **비율**: 전체 테스트의 약 10%

## 테스트 커버리지

### 목표

| 항목 | 최소 목표 |
|------|----------|
| 전체 커버리지 | 70% |
| 비즈니스 로직 (services) | 90% |
| 유틸리티 함수 (utils) | 90% |
| 컴포넌트 | 60% |
| API 라우트 | 80% |

### 커버리지 실행

```bash
npx vitest run --coverage
```

## 테스트 작성 규칙

### describe/it 네이밍

- `describe`: 테스트 대상을 명시한다.
- `it`: 기대 동작을 한국어로 서술한다.

```ts
describe("AuthService", () => {
  describe("login", () => {
    it("올바른 자격 증명으로 토큰을 반환한다", () => {});
    it("잘못된 비밀번호로 에러를 던진다", () => {});
    it("존재하지 않는 사용자로 에러를 던진다", () => {});
  });
});
```

### AAA 패턴

모든 테스트는 Arrange-Act-Assert 패턴을 따른다.

```ts
it("사용자 이름을 업데이트한다", async () => {
  // Arrange: 테스트 데이터 및 환경 설정
  const user = createTestUser({ name: "기존이름" });

  // Act: 테스트 대상 실행
  const result = await updateUserName(user.id, "새이름");

  // Assert: 결과 검증
  expect(result.name).toBe("새이름");
});
```

### 테스트 격리

- 각 테스트는 독립적으로 실행 가능해야 한다.
- 테스트 간 상태를 공유하지 않는다.
- `beforeEach`에서 상태를 초기화한다.

## 모킹 전략

### 외부 의존성 모킹

API 호출, 데이터베이스 등 외부 의존성은 모킹한다.

```ts
import { vi } from "vitest";
import { fetchUser } from "@/services/userService";

vi.mock("@/services/userService");

const mockedFetchUser = vi.mocked(fetchUser);

it("사용자 정보를 정상적으로 표시한다", async () => {
  mockedFetchUser.mockResolvedValue({ id: "1", name: "홍길동" });
  // ...
});
```

### 모킹 최소화 원칙

- 외부 시스템 (API, DB, 파일 시스템)만 모킹한다.
- 내부 모듈의 모킹은 최소화한다.
- 모킹이 과도하면 테스트 대상의 설계를 재검토한다.

### 타이머 모킹

```ts
import { vi, beforeEach, afterEach } from "vitest";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it("5초 후에 자동으로 알림을 닫는다", () => {
  // ...
  vi.advanceTimersByTime(5000);
  // ...
});
```

## 공공 API 모킹 전략

이 프로젝트는 서울열린데이터광장 공공 API를 사용한다. Supabase는 사용하지 않는다.

### fetch 모킹

서울 API 호출은 `vi.stubEnv` + `fetch` 모킹으로 격리한다.

```ts
import { vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.stubEnv("VITE_SEOUL_API_KEY", "test-key");
  vi.stubGlobal("fetch", vi.fn());
});

it("API 응답을 파싱한다", async () => {
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    json: async () => ({ realtimePositionList: [...] }),
  } as Response);

  const result = await fetchLineTrains("1호선");
  expect(result).toHaveLength(/* ... */);
});
```

---

> 아래는 Supabase 기반 프로젝트를 위한 참고 가이드이다. 이 프로젝트에서는 사용하지 않는다.

## Supabase 모킹 전략 (참고용)

### supabase-js 클라이언트 모킹

Supabase 클라이언트의 체이닝 메서드를 모킹한다.

```ts
import { vi } from "vitest";

// supabase 클라이언트 모킹
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    auth: {
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));
```

### 모킹 헬퍼 패턴

재사용 가능한 모킹 헬퍼를 `tests/helpers/supabaseMock.ts`에 작성한다.

```ts
// tests/helpers/supabaseMock.ts
import { vi } from "vitest";
import { supabase } from "@/lib/supabase";

export function mockSupabaseSelect<T>(table: string, data: T[], error: null | { message: string } = null) {
  const mockChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then: vi.fn((resolve) => resolve({ data, error })),
  };

  // select 이후 체이닝 지원
  Object.assign(mockChain.select, mockChain);

  vi.mocked(supabase.from).mockReturnValue(mockChain as never);
  return mockChain;
}
```

사용 예시:

```ts
import { mockSupabaseSelect } from "../helpers/supabaseMock";

it("할 일 목록을 조회한다", async () => {
  const mockTodos = [{ id: "1", title: "테스트", is_completed: false }];
  mockSupabaseSelect("todos", mockTodos);

  const result = await getTodos();
  expect(result).toEqual(mockTodos);
});
```

### 인증 상태 모킹

```ts
import { vi } from "vitest";
import { supabase } from "@/lib/supabase";

// 인증된 상태
function mockAuthenticated(user = { id: "user-1", email: "test@example.com" }) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user, access_token: "token", refresh_token: "refresh" } as never },
    error: null,
  });
}

// 미인증 상태
function mockUnauthenticated() {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: null },
    error: null,
  });
}
```

### 테스트 데이터 팩토리

`tests/factories/` 디렉토리에 팩토리 함수를 작성한다.

```ts
// tests/factories/todoFactory.ts
import type { Todo } from "@/types/todo";

export function createTestTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    user_id: "test-user-id",
    title: "테스트 할 일",
    is_completed: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

export function createTestTodos(count: number, overrides: Partial<Todo> = {}): Todo[] {
  return Array.from({ length: count }, (_, i) =>
    createTestTodo({ title: `테스트 할 일 ${i + 1}`, ...overrides })
  );
}
```

### Supabase 에러 시뮬레이션

```ts
it("Supabase 에러 시 예외를 던진다", async () => {
  const mockError = { message: "테이블을 찾을 수 없습니다", code: "42P01" };

  vi.mocked(supabase.from).mockReturnValue({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: null, error: mockError }),
  } as never);

  await expect(getTodos()).rejects.toThrow();
});
```

### RLS 정책 테스트

Supabase 로컬 환경에서 실제 RLS 정책을 테스트한다.

```ts
// tests/rls/todos.rls.test.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "http://localhost:54321";
const SERVICE_ROLE_KEY = "서비스_롤_키"; // supabase start 출력값

// 특정 사용자로 인증된 클라이언트 생성
function createAuthenticatedClient(userId: string) {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${generateJwt(userId)}`,
      },
    },
  });
}

describe("todos RLS 정책", () => {
  it("본인의 할 일만 조회할 수 있다", async () => {
    const client = createAuthenticatedClient("user-1");
    const { data } = await client.from("todos").select("*");

    for (const todo of data ?? []) {
      expect(todo.user_id).toBe("user-1");
    }
  });
});
```

## 관련 문서

- [프로젝트 구조](project-structure.md)
- [CI/CD 가이드](cicd-guide.md)
- [데이터 모델링 가이드](data-modeling.md)
