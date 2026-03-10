# 성능 최적화 가이드

## React 렌더링 최적화

### React.memo 사용 기준

부모 리렌더링 시 props가 변경되지 않는 **무거운** 자식 컴포넌트에만 적용한다.

```tsx
// 좋은 예: 리스트 아이템처럼 반복 렌더링되는 무거운 컴포넌트
const TodoItem = React.memo(function TodoItem({ todo }: TodoItemProps) {
  return <div>{/* 복잡한 렌더링 */}</div>;
});

// 나쁜 예: 단순한 컴포넌트에 불필요하게 적용
const Label = React.memo(function Label({ text }: { text: string }) {
  return <span>{text}</span>;
});
```

### useMemo/useCallback 사용 기준

**기본적으로 사용하지 않고, 성능 문제가 확인된 후 적용한다.**

```tsx
// 좋은 예: 비용이 큰 계산
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// 좋은 예: React.memo된 자식에 전달하는 콜백
const handleDelete = useCallback(
  (id: string) => deleteTodo(id),
  [deleteTodo]
);

// 나쁜 예: 단순한 값에 불필요하게 적용
const fullName = useMemo(() => `${first} ${last}`, [first, last]);
```

### 리렌더링 디버깅

React DevTools Profiler를 사용하여 불필요한 리렌더링을 확인한다.

1. React DevTools > Profiler 탭 열기
2. "Highlight updates when components render" 활성화
3. 인터랙션 수행 후 렌더링 결과 분석

## Supabase 쿼리 최적화 (참고용)

> 이 프로젝트는 Supabase를 사용하지 않는다. 아래는 Supabase 기반 프로젝트를 위한 참고 가이드이다.

### select 컬럼 제한

필요한 컬럼만 명시적으로 선택한다.

```ts
// 좋은 예: 필요한 컬럼만 선택
const { data } = await supabase
  .from("todos")
  .select("id, title, is_completed");

// 나쁜 예: 모든 컬럼 선택
const { data } = await supabase
  .from("todos")
  .select("*");
```

### 관계 쿼리

여러 번 쿼리하는 대신 Supabase 관계 쿼리를 사용한다.

```ts
// 좋은 예: 관계 쿼리로 한 번에 조회
const { data } = await supabase
  .from("posts")
  .select("id, title, author:profiles(name, avatar_url)");

// 나쁜 예: 별도 쿼리로 N+1 문제 발생
const { data: posts } = await supabase.from("posts").select("*");
for (const post of posts) {
  const { data: author } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", post.author_id)
    .single();
}
```

### 페이지네이션

```ts
// offset 기반 페이지네이션
const PAGE_SIZE = 20;
const { data } = await supabase
  .from("todos")
  .select("id, title, created_at")
  .order("created_at", { ascending: false })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
```

커서 기반 페이지네이션은 대규모 데이터에 사용한다:

```ts
const { data } = await supabase
  .from("todos")
  .select("id, title, created_at")
  .order("created_at", { ascending: false })
  .lt("created_at", lastCreatedAt)
  .limit(PAGE_SIZE);
```

### 인덱스 가이드

자주 필터링하거나 정렬하는 컬럼에 인덱스를 추가한다.

```sql
-- 자주 필터링하는 컬럼
CREATE INDEX idx_todos_user_id ON todos(user_id);

-- 정렬에 사용하는 컬럼
CREATE INDEX idx_todos_created_at ON todos(created_at DESC);

-- 복합 인덱스 (필터 + 정렬 조합)
CREATE INDEX idx_todos_user_created ON todos(user_id, created_at DESC);
```

## 번들 크기 관리

### 코드 스플리팅

페이지 단위로 `React.lazy`와 `Suspense`를 사용한다.

```tsx
import { lazy, Suspense } from "react";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

function App() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  );
}
```

### 트리 셰이킹

named import를 사용하여 필요한 것만 가져온다.

```ts
// 좋은 예: named import
import { format } from "date-fns";

// 나쁜 예: 전체 import
import * as dateFns from "date-fns";
```

### 번들 분석

`rollup-plugin-visualizer`로 번들 구성을 확인한다.

```ts
// vite.config.ts
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: true, gzipSize: true }),
  ],
});
```

## 이미지 최적화

### 포맷 가이드

| 포맷 | 용도 | 특징 |
|------|------|------|
| WebP | 사진, 복잡한 이미지 | 높은 압축률, 대부분의 브라우저 지원 |
| SVG | 아이콘, 로고, 일러스트 | 벡터 기반, 크기 무관 선명 |
| PNG | 투명 배경 필요 시 | 무손실 압축, 파일 크기 큼 |

### 지연 로딩

뷰포트 밖 이미지는 지연 로딩한다.

```tsx
<img
  src="/images/photo.webp"
  alt="설명"
  loading="lazy"
  width={400}
  height={300}
/>
```

### Supabase Storage 이미지 변환

Supabase Storage의 이미지 변환 기능을 활용한다.

```ts
const { data } = supabase.storage
  .from("avatars")
  .getPublicUrl("user-avatar.jpg", {
    transform: {
      width: 200,
      height: 200,
      resize: "cover",
    },
  });
```

## 데이터 캐싱 전략

### TanStack Query 캐싱 설정

```tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5분 동안 fresh 상태 유지
      gcTime: 1000 * 60 * 30,   // 30분 후 캐시에서 제거
    },
  },
});
```

### 데이터 유형별 캐싱 전략

| 데이터 유형 | staleTime | gcTime | 예시 |
|------------|-----------|--------|------|
| 거의 변하지 않는 데이터 | 30분 | 1시간 | 카테고리 목록, 설정 |
| 자주 변하는 데이터 | 1분 | 5분 | 알림, 채팅 |
| 사용자별 데이터 | 5분 | 30분 | 프로필, 할 일 목록 |
| 실시간 데이터 | 0 (항상 stale) | 5분 | 주가, 실시간 피드 |

## Core Web Vitals 기준

### 목표

| 지표 | 목표 | 설명 |
|------|------|------|
| LCP (Largest Contentful Paint) | < 2.5초 | 가장 큰 콘텐츠 렌더링 시간 |
| INP (Interaction to Next Paint) | < 200ms | 사용자 인터랙션 응답 시간 |
| CLS (Cumulative Layout Shift) | < 0.1 | 레이아웃 이동 정도 |

### 측정 도구

- **Lighthouse**: Chrome DevTools > Lighthouse 탭
- **web-vitals 라이브러리**: 실제 사용자 데이터 수집

```ts
import { onLCP, onINP, onCLS } from "web-vitals";

onLCP(console.log);
onINP(console.log);
onCLS(console.log);
```

## 관련 문서

- [상태 관리 전략](state-management.md)
- [디자인 가이드](design-guide.md)
- [데이터 모델링 가이드](data-modeling.md)
