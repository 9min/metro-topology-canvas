# 에러 핸들링 가이드

## 프론트엔드 에러 처리

### Error Boundary

React Error Boundary를 사용하여 컴포넌트 트리의 에러를 포착한다.

```tsx
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("에러 발생:", error, errorInfo);
    // 에러 리포팅 서비스로 전송
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
```

### Error Boundary 배치 전략

```
App
├── ErrorBoundary (전체 앱 - 치명적 에러)
│   ├── Layout
│   │   ├── ErrorBoundary (페이지 단위)
│   │   │   └── Page
│   │   │       ├── ErrorBoundary (위젯/섹션 단위)
│   │   │       │   └── Widget
```

- **전체 앱**: 예상치 못한 치명적 에러 포착
- **페이지 단위**: 페이지별 에러 격리
- **위젯/섹션 단위**: 독립 기능의 에러가 전체 페이지에 영향을 주지 않도록 격리

## Supabase 에러 처리

### 기본 패턴: `{ data, error }` 응답 처리

Supabase Client의 모든 메서드는 `{ data, error }` 객체를 반환한다. **`error`를 항상 확인**한다.

```ts
// 기본 패턴
const { data, error } = await supabase
  .from("todos")
  .select("*");

if (error) {
  // 에러 처리
  throw error;
}

// data 사용
```

### 서비스 함수에서의 에러 처리

서비스 함수는 Supabase 에러를 의미 있는 앱 에러로 변환한다.

```ts
import { supabase } from "@/lib/supabase";
import type { AppError } from "@/types/error";

export async function getTodoById(id: string) {
  const { data, error } = await supabase
    .from("todos")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      throw createAppError("NOT_FOUND", "할 일을 찾을 수 없습니다.");
    }
    throw createAppError("SERVER_ERROR", "데이터를 불러오는 중 오류가 발생했습니다.");
  }

  return data;
}
```

### 앱 에러 타입 및 헬퍼

```ts
// src/types/error.ts
export interface AppError {
  code: string;
  message: string;
  details?: string;
}

// src/utils/error.ts
export function createAppError(
  code: string,
  message: string,
  details?: string,
): AppError {
  return { code, message, details };
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return "알 수 없는 오류가 발생했습니다.";
}

function isAppError(error: unknown): error is AppError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error
  );
}
```

### Supabase 주요 에러 코드

| 에러 코드 | 상황 | 처리 방법 |
|----------|------|----------|
| `PGRST116` | `.single()` 결과 없음 | 리소스 없음 안내 |
| `23505` | 유니크 제약 위반 (중복) | 중복 데이터 안내 |
| `23503` | 외래 키 제약 위반 | 참조 무결성 오류 안내 |
| `42501` | RLS 정책 위반 (권한 없음) | 접근 권한 없음 안내 |
| `PGRST301` | JWT 만료 | 재로그인 유도 |

```ts
export function handleSupabaseError(error: { code: string; message: string }): AppError {
  const errorMap: Record<string, AppError> = {
    PGRST116: createAppError("NOT_FOUND", "요청한 데이터를 찾을 수 없습니다."),
    "23505": createAppError("DUPLICATE", "이미 존재하는 데이터입니다."),
    "23503": createAppError("REFERENCE_ERROR", "참조하는 데이터가 존재하지 않습니다."),
    "42501": createAppError("FORBIDDEN", "접근 권한이 없습니다."),
    PGRST301: createAppError("SESSION_EXPIRED", "세션이 만료되었습니다. 다시 로그인해주세요."),
  };

  return errorMap[error.code] ?? createAppError("SERVER_ERROR", "서버 오류가 발생했습니다.");
}
```

### 인증 에러 처리

```ts
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.message === "Invalid login credentials") {
      throw createAppError("AUTH_FAILED", "이메일 또는 비밀번호가 올바르지 않습니다.");
    }
    if (error.message === "Email not confirmed") {
      throw createAppError("EMAIL_NOT_CONFIRMED", "이메일 인증을 완료해주세요.");
    }
    throw createAppError("AUTH_ERROR", "로그인 중 오류가 발생했습니다.");
  }

  return data;
}
```

### 컴포넌트에서의 에러 처리

```tsx
function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTodos() {
      try {
        const data = await getTodos();
        setTodos(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    loadTodos();
  }, []);

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  return <ul>{/* 렌더링 */}</ul>;
}
```

## Edge Functions 에러 처리

> 이 프로젝트는 Vercel Serverless Functions(`api/*.ts`)를 사용한다. 아래 Supabase Edge Function 예시는 범용 참고 가이드이다. Vercel 함수의 에러 처리도 동일한 원칙을 따른다.

Edge Functions에서는 HTTP 응답으로 에러를 반환한다.

```ts
// supabase/functions/process-payment/index.ts
serve(async (req) => {
  try {
    const body = await req.json();

    // 입력 검증
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({
          error: { code: "VALIDATION_ERROR", message: "유효하지 않은 금액입니다." },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // 비즈니스 로직 처리
    const result = await processPayment(body);

    return new Response(
      JSON.stringify({ data: result }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "서버 내부 오류가 발생했습니다." },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
```

## 에러 응답 형식

앱 전체에서 일관된 에러 형식을 사용한다:

```ts
// 앱 에러 (서비스 → 컴포넌트)
interface AppError {
  code: string;
  message: string;       // 사용자에게 표시할 메시지
  details?: string;      // 추가 정보 (선택)
}

// Edge Functions 응답
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "이메일 형식이 올바르지 않습니다."
  }
}
```

## 로깅 전략

### 로그 레벨

| 레벨 | 용도 | 예시 |
|------|------|------|
| `error` | 즉시 대응이 필요한 오류 | Supabase 연결 실패, Edge Function 에러 |
| `warn` | 잠재적 문제 | RLS 정책 위반 시도, 느린 쿼리 |
| `info` | 주요 이벤트 | 사용자 로그인, 결제 완료 |
| `debug` | 디버깅용 상세 정보 | 쿼리 결과, 요청 데이터 |

### 로깅 규칙

- 프로덕션에서는 `info` 이상만 출력한다.
- 개인정보(비밀번호, 토큰 등)를 로그에 포함하지 않는다.
- 클라이언트에서는 에러 리포팅 서비스(Sentry 등)를 사용한다.
- Edge Functions에서는 구조화된 로그를 사용한다.

```ts
// 좋은 예
console.error("할 일 조회 실패", { todoId, errorCode: error.code });

// 나쁜 예
console.error(`에러: ${error}`);                    // 구조화되지 않음
console.error("로그인 실패", { password: "..." });   // 민감 정보 포함
```

## 사용자 에러 메시지 가이드라인

### 원칙

1. **사용자 친화적**: 기술 용어 대신 이해하기 쉬운 표현을 사용한다.
2. **구체적**: 무엇이 잘못되었는지 명확히 설명한다.
3. **해결 방법 제시**: 가능하면 사용자가 취할 수 있는 행동을 안내한다.
4. **내부 구현 숨김**: Supabase 에러 코드, 스택 트레이스 등을 노출하지 않는다.

### 예시

| 상황 | 나쁜 메시지 | 좋은 메시지 |
|------|-----------|-----------|
| Supabase 연결 실패 | `FetchError: request failed` | `일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.` |
| RLS 정책 위반 | `new row violates row-level security` | `이 작업을 수행할 권한이 없습니다.` |
| 유니크 제약 위반 | `duplicate key value violates unique constraint` | `이미 등록된 이메일 주소입니다.` |
| JWT 만료 | `JWT expired` | `세션이 만료되었습니다. 다시 로그인해주세요.` |

## 관련 문서

- [보안 가이드](security-guide.md)
- [테스트 가이드](testing-guide.md)
- [코드 리뷰 체크리스트](code-review-checklist.md)
