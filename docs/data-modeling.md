# 데이터 모델링 가이드

> 이 프로젝트는 백엔드 DB 없이 공공 API + 정적 JSON 데이터만 사용한다. 아래 섹션에서 실제 적용되는 타입 모델을 설명한다. 이후의 Supabase/PostgreSQL 내용은 범용 참고 가이드이며 이 프로젝트에는 적용되지 않는다.

---

## 프로젝트 실제 타입 모델

### 공공 API 원시 응답

```ts
// src/types/train.ts

/** 서울열린데이터광장 실시간 열차 위치 API 원시 응답 항목 */
export interface SeoulApiTrainRaw {
  subwayId: string;
  subwayNm: string;
  statnNm: string;
  trainNo: string;
  updnLine: string;
  trainSttus: string;
  directAt: string;
  lstcarAt: string;
}

/** 서울열린데이터광장 API 응답 래퍼 */
export interface SeoulApiResponse {
  realtimePositionList: SeoulApiTrainRaw[];
}
```

### 파싱된 열차 위치 (`TrainPosition`)

```ts
/** 파싱된 열차 위치 정보 */
export interface TrainPosition {
  trainNo: string;
  stationId: string;
  stationName: string;
  line: number;
  direction: "상행" | "하행";
  status: "진입" | "도착" | "출발";
}
```

### 보간된 열차 렌더링 좌표 (`InterpolatedTrain`)

클라이언트 보간 알고리즘을 거쳐 60fps 렌더링에 사용되는 좌표 정보이다.

```ts
/** 보간된 열차 렌더링 좌표 */
export interface InterpolatedTrain {
  trainNo: string;
  line: number;
  /** 보간된 현재 화면 X 좌표 */
  x: number;
  /** 보간된 현재 화면 Y 좌표 */
  y: number;
  /** 열차가 물리적으로 위치한 역의 화면 X 좌표 (출발 상태여도 현재역) */
  stationX: number;
  /** 열차가 물리적으로 위치한 역의 화면 Y 좌표 (출발 상태여도 현재역) */
  stationY: number;
  direction: "상행" | "하행";
  /** 0~1 사이 구간 진행도 */
  progress: number;
  fromStationId: string;
  toStationId: string;
  /** 트랙 방향 각도 (라디안) */
  trackAngle: number;
}
```

> `stationX` / `stationY` 필드는 열차가 "출발" 상태일 때도 현재역 좌표를 유지하여, 역 진입 시 트레일 기준점으로 활용된다.

### 정적 데이터 (JSON)

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

---

## 테이블 설계 원칙

### 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 테이블명 | `snake_case` 복수형 | `todos`, `user_profiles` |
| 컬럼명 | `snake_case` | `created_at`, `user_id` |
| 인덱스명 | `idx_테이블_컬럼` | `idx_todos_user_id` |
| RLS 정책명 | 한국어 서술형 | `사용자 본인 조회` |
| 함수명 | `snake_case` 동사형 | `update_updated_at()` |

### 정규화

- 기본적으로 제3정규형(3NF)을 따른다.
- 성능을 위해 비정규화하는 경우, 마이그레이션에 이유를 주석으로 남긴다.

```sql
-- 비정규화: 댓글 수를 posts에 캐싱 (조회 성능 최적화)
ALTER TABLE posts ADD COLUMN comment_count INTEGER DEFAULT 0;
```

## 필수 공통 컬럼

모든 테이블에 다음 컬럼을 포함한다:

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | `UUID` | 기본키. `gen_random_uuid()` 사용 |
| `created_at` | `TIMESTAMPTZ` | 생성 시각. `NOW()` 기본값 |
| `updated_at` | `TIMESTAMPTZ` | 수정 시각. 트리거로 자동 갱신 |

### 마이그레이션 템플릿

```sql
-- updated_at 자동 갱신 트리거 함수 (최초 1회 생성)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 테이블 생성 템플릿
CREATE TABLE 테이블명 (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- 비즈니스 컬럼들...
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- updated_at 트리거 연결
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON 테이블명
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS 활성화
ALTER TABLE 테이블명 ENABLE ROW LEVEL SECURITY;
```

## 외래키 및 관계 설계

### 1:N 관계 예제

```sql
-- 사용자(1) : 게시글(N)
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

### N:M 관계 예제 (조인 테이블)

```sql
-- 게시글(N) : 태그(M)
CREATE TABLE tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE post_tags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);
```

### ON DELETE 옵션 가이드

| 옵션 | 동작 | 사용 시점 |
|------|------|----------|
| `CASCADE` | 부모 삭제 시 자식도 삭제 | 종속적 데이터 (댓글, 좋아요) |
| `SET NULL` | 부모 삭제 시 FK를 NULL로 | 참조만 하는 데이터 (작성자 탈퇴) |
| `RESTRICT` | 부모 삭제 차단 | 삭제 시 데이터 무결성 문제 (주문-상품) |

## 소프트 딜리트 vs 하드 딜리트

### 선택 기준

| 기준 | 소프트 딜리트 | 하드 딜리트 |
|------|-------------|------------|
| 데이터 복구 필요 | 필요 | 불필요 |
| 법적 보관 의무 | 있음 | 없음 |
| 연관 데이터 | 많음 | 적음 |
| 예시 | 사용자 계정, 게시글 | 임시 데이터, 로그 |

### 소프트 딜리트 구현

```sql
-- deleted_at 컬럼 추가
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ;

-- RLS 정책에서 삭제된 데이터 필터링
CREATE POLICY "삭제되지 않은 게시글만 조회" ON posts
  FOR SELECT USING (deleted_at IS NULL);
```

```ts
// 소프트 딜리트 서비스 함수
export async function softDeletePost(postId: string) {
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);

  if (error) throw error;
}
```

## RLS 정책 설계

RLS 정책의 상세 구현은 [보안 가이드](security-guide.md)를 참조한다.

### 테이블 설계 시 RLS 체크리스트

- [ ] `user_id` 컬럼이 있는가? (사용자별 데이터 접근 제어)
- [ ] 공개 데이터인가? (비인증 사용자 조회 허용 여부)
- [ ] 역할 기반 접근이 필요한가? (관리자/일반 사용자 구분)
- [ ] CRUD 각 작업별 정책이 정의되어 있는가?
- [ ] 마이그레이션 파일에 RLS 정책이 포함되어 있는가?

## 마이그레이션 관리 전략

### 생성

```bash
# 새 마이그레이션 생성 (네이밍: 동사_테이블명)
npx supabase migration new create_todos_table
npx supabase migration new add_status_to_todos
npx supabase migration new create_post_tags_junction
```

### 적용

```bash
# 로컬: 데이터베이스 리셋 (모든 마이그레이션 재적용)
npx supabase db reset

# 원격: 마이그레이션 푸시
npx supabase db push
```

### 롤백

Supabase CLI는 자동 롤백을 지원하지 않는다. 역방향 마이그레이션을 수동으로 작성한다.

```bash
npx supabase migration new revert_add_status_to_todos
```

```sql
-- 역방향 마이그레이션 예시
ALTER TABLE todos DROP COLUMN status;
```

### 작성 규칙

- 하나의 마이그레이션은 하나의 논리적 변경만 포함한다.
- DDL(구조 변경)과 DML(데이터 변경)을 분리한다.
- 모든 테이블 생성 마이그레이션에 RLS 정책을 포함한다.
- 인덱스 추가는 별도 마이그레이션으로 분리한다.

## 시드 데이터 관리

시드 데이터는 `supabase/seed.sql`에 작성한다.

```sql
-- supabase/seed.sql
-- 개발/테스트용 초기 데이터

INSERT INTO todos (id, user_id, title, is_completed) VALUES
  ('00000000-0000-0000-0000-000000000001', '사용자UUID', '첫 번째 할 일', false),
  ('00000000-0000-0000-0000-000000000002', '사용자UUID', '두 번째 할 일', true);
```

- `npx supabase db reset` 실행 시 자동 적용된다.
- 프로덕션 환경에는 적용하지 않는다.

## 타입 자동 생성

```bash
npx supabase gen types typescript --local > src/types/database.ts
```

생성된 타입에서 Row/Insert/Update 타입을 추출하여 사용한다:

```ts
import type { Database } from "./database";

// 행 타입 (SELECT 결과)
type Todo = Database["public"]["Tables"]["todos"]["Row"];

// 삽입 타입 (INSERT 시 필요한 필드)
type CreateTodoInput = Database["public"]["Tables"]["todos"]["Insert"];

// 수정 타입 (UPDATE 시 필요한 필드, 모두 optional)
type UpdateTodoInput = Database["public"]["Tables"]["todos"]["Update"];
```

## 관련 문서

- [보안 가이드](security-guide.md)
- [프로젝트 구조](project-structure.md)
- [개발 환경 셋업](dev-environment.md)
