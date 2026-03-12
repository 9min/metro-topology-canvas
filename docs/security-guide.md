# 보안 가이드

## OWASP Top 10 체크리스트

### 1. 인젝션 방지

- Supabase Client 메서드(`.from().select()` 등)를 사용하여 쿼리를 작성한다.
- RPC(Database Functions)를 사용할 때도 파라미터 바인딩을 사용한다.
- 사용자 입력을 절대 직접 쿼리에 삽입하지 않는다.

```ts
// 좋은 예: Supabase Client 사용
const { data } = await supabase
  .from("users")
  .select("*")
  .eq("id", userId);

// 좋은 예: RPC 사용 시 파라미터 전달
const { data } = await supabase
  .rpc("get_user_stats", { target_user_id: userId });

// 나쁜 예: 직접 SQL 문자열 결합
const { data } = await supabase
  .rpc("raw_query", { query: `SELECT * FROM users WHERE id = '${userId}'` });
```

### 2. 인증 취약점 방지

- Supabase Auth를 사용하여 인증을 처리한다.
- 자체 인증 로직을 구현하지 않는다.
- 세션 관리는 Supabase가 제공하는 메커니즘을 따른다.
- `onAuthStateChange`로 인증 상태 변화를 감지한다.

```ts
// 인증 상태 리스너
supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") {
    // 로그아웃 처리
  }
});
```

### 3. XSS 방지

- React의 기본 이스케이핑을 활용한다.
- `dangerouslySetInnerHTML` 사용을 금지한다. 불가피한 경우 DOMPurify로 새니타이즈한다.
- CSP(Content Security Policy) 헤더를 설정한다.

```ts
// 좋은 예
<p>{userInput}</p>

// 나쁜 예
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

### 4. CSRF 방지

- Supabase는 JWT 기반 인증을 사용하므로 CSRF 위험이 낮다.
- 쿠키 기반 세션을 사용할 경우 SameSite 속성을 설정한다.

### 5. 보안 설정 오류 방지

- 프로덕션에서 디버그 모드를 비활성화한다.
- 불필요한 HTTP 헤더를 제거한다.
- 보안 관련 HTTP 헤더를 설정한다.

```ts
// 권장 보안 헤더 (Vercel vercel.json 또는 미들웨어에서 설정)
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

## RLS (Row Level Security)

### 필수 규칙

- **모든 테이블에 RLS를 활성화**한다. 예외 없음.
- RLS를 활성화하지 않은 테이블은 `anon` 키로 모든 데이터에 접근 가능하므로 치명적이다.
- 테이블 생성 마이그레이션에 RLS 정책을 반드시 포함한다.

```sql
-- 테이블 생성 시 반드시 함께 작성
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
```

### RLS 정책 패턴

#### 본인 데이터만 접근 (가장 일반적)

```sql
CREATE POLICY "본인 데이터 조회" ON todos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 데이터 생성" ON todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 데이터 수정" ON todos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인 데이터 삭제" ON todos
  FOR DELETE USING (auth.uid() = user_id);
```

#### 공개 읽기 + 본인만 쓰기

```sql
CREATE POLICY "전체 공개 조회" ON posts
  FOR SELECT USING (true);

CREATE POLICY "본인만 생성" ON posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);
```

#### 역할 기반 접근

```sql
CREATE POLICY "관리자 전체 접근" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );
```

### RLS 검증

- 새 테이블을 추가할 때마다 RLS 정책이 있는지 확인한다.
- 다른 사용자의 데이터에 접근할 수 없는지 테스트한다.

## 입력 검증 및 새니타이제이션

### 원칙

- **클라이언트 측 + RLS 이중 검증** 구조를 사용한다.
- 클라이언트 측 검증은 UX를 위해, RLS는 보안을 위해 적용한다.
- 검증 라이브러리(zod, valibot 등)를 사용한다.

```ts
import { z } from "zod";

const CreateTodoSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// 서비스 함수에서 검증 후 Supabase에 전달
export async function createTodo(input: unknown) {
  const validated = CreateTodoSchema.parse(input);
  const { data, error } = await supabase
    .from("todos")
    .insert(validated)
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 파일 업로드 검증 (Supabase Storage)

- Supabase Storage 버킷에 파일 크기 및 MIME 타입 제한을 설정한다.
- 업로드 경로에 사용자 ID를 포함하여 격리한다.
- Storage RLS 정책을 설정한다.

```ts
// 파일 업로드
const filePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
const { error } = await supabase.storage
  .from("avatars")
  .upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
```

## 인증/인가 보안 패턴

### Supabase Auth 사용 규칙

- 인증은 Supabase Auth를 통해서만 처리한다.
- 지원 방식: 이메일/비밀번호, OAuth (Google, GitHub 등), Magic Link
- 인증 상태는 `supabase.auth.getSession()`으로 확인한다.

```ts
// 현재 사용자 확인
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // 로그인 페이지로 리다이렉트
}
```

### 보호된 라우트 패턴

```tsx
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!session) return <Navigate to="/login" />;

  return children;
}
```

### 권한 검증

- RLS 정책으로 데이터 수준의 권한을 관리한다.
- UI 수준의 권한 분기는 사용자 역할 정보를 기반으로 처리한다.
- `service_role` 키는 서버 측(Edge Functions)에서만 사용한다.

## 환경변수 및 시크릿 관리

### 프로젝트 환경변수

```
# .env.example
VITE_SEOUL_API_KEY=
VITE_SEOUL_API_BASE_URL=http://swopenapi.seoul.go.kr/api/subway
```

- `VITE_` 접두사가 붙은 변수는 클라이언트 번들에 포함되어 노출된다.
- `VITE_SEOUL_API_KEY`는 공공 API 키로, 클라이언트에 노출되어도 괜찮으나 남용 방지를 위해 Vercel 프록시에서 서버사이드(`process.env.VITE_SEOUL_API_KEY`)로 처리하는 것을 권장한다.

### 규칙

- `.env` 및 `.env.local` 파일을 `.gitignore`에 반드시 포함한다.
- `.env.example` 파일에 필요한 환경변수 키만 기재한다 (값 없이).
- 코드에 시크릿을 하드코딩하지 않는다.

### 환경별 변수 관리

| 환경 | 관리 방식 |
|------|----------|
| 로컬 개발 | `.env.local` |
| Preview | Vercel Preview 환경변수 |
| 프로덕션 | Vercel Production 환경변수 |

## 의존성 취약점 스캔

- `npm audit`를 정기적으로 실행한다.
- CI 파이프라인에 의존성 스캔을 포함한다.
- 알려진 취약점이 있는 의존성은 즉시 업데이트한다.
- 사용하지 않는 의존성은 제거한다.

```bash
# 취약점 스캔
npm audit

# 자동 수정 시도
npm audit fix
```

## 관련 문서

- [에러 핸들링](error-handling.md)
- [CI/CD 가이드](cicd-guide.md)
- [코드 리뷰 체크리스트](code-review-checklist.md)
- [프로젝트 구조](project-structure.md)
