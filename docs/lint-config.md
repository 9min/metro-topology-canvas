# Biome 린트/포매팅 설정

## Biome 설정 파일

프로젝트 루트에 `biome.json`을 배치한다.

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.6/schema.json",
  "assist": { "actions": { "source": { "organizeImports": "on" } } },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "complexity": {
        "noExcessiveCognitiveComplexity": {
          "level": "warn",
          "options": { "maxAllowedComplexity": 15 }
        }
      },
      "correctness": {
        "noUnusedImports": "error",
        "noUnusedVariables": "error",
        "useExhaustiveDependencies": "warn"
      },
      "style": {
        "noNonNullAssertion": "warn",
        "useConst": "error",
        "useImportType": "error"
      },
      "suspicious": {
        "noExplicitAny": "error",
        "noConsole": { "level": "warn", "options": { "allow": ["warn", "error"] } }
      }
    }
  },
  "css": {
    "parser": { "cssModules": false, "tailwindDirectives": true },
    "linter": { "enabled": true },
    "formatter": { "enabled": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  },
  "files": {
    "includes": ["**", "!**/node_modules", "!**/dist", "!**/build", "!**/coverage", "!**/*.min.js"]
  },
  "overrides": [
    {
      "includes": ["scripts/**"],
      "linter": {
        "rules": {
          "suspicious": { "noConsole": "off" }
        }
      }
    }
  ]
}
```

## 주요 린트 규칙

### 필수 규칙 (error)

| 규칙 | 설명 |
|------|------|
| `noUnusedImports` | 미사용 import 금지 |
| `noUnusedVariables` | 미사용 변수 금지 |
| `noExplicitAny` | `any` 타입 사용 금지 |
| `useConst` | 재할당 없는 변수는 `const` 사용 |
| `useImportType` | 타입 전용 import에 `type` 키워드 사용 |

### 경고 규칙 (warn)

| 규칙 | 설명 |
|------|------|
| `noConsole` | `console.log` 등 사용 경고 (`warn`, `error`만 허용) |
| `noNonNullAssertion` | `!` non-null 단언 경고 |
| `useExhaustiveDependencies` | 훅 의존성 배열 누락 경고 |
| `noExcessiveCognitiveComplexity` | 과도한 복잡도 경고 |

### 폴더별 override

| 폴더 | 규칙 변경 | 이유 |
|------|----------|------|
| `scripts/**` | `noConsole: off` | 데이터 수집 스크립트에서 console 출력 허용 |

## import 정렬 규칙

Biome의 `organizeImports`가 자동으로 import를 정렬한다.

권장 import 순서:

```ts
// 1. 외부 라이브러리
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

// 2. 내부 모듈 (절대 경로)
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

// 3. 타입 import
import type { User } from "@/types/user";

// 4. 상대 경로 모듈
import { validateForm } from "./utils";
```

## 포매팅 규칙 요약

| 항목 | 설정 |
|------|------|
| 들여쓰기 | 탭 (너비 2) |
| 줄 너비 | 100자 |
| 줄 끝 | LF |
| 따옴표 | 쌍따옴표 (`"`) |
| 세미콜론 | 항상 사용 |
| 후행 쉼표 | 항상 사용 |
| 화살표 함수 괄호 | 항상 사용 |

## 에디터 연동

### VS Code 설정

`.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "quickfix.biome": "explicit",
    "source.organizeImports.biome": "explicit"
  }
}
```

### VS Code 확장

- [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome) 확장을 설치한다.

## Pre-commit Hook

### lefthook 설정

`lefthook.yml`:

```yaml
pre-commit:
  commands:
    lint:
      glob: "*.{ts,tsx,js,jsx,json}"
      run: npx biome check --write --staged {staged_files}
      stage_fixed: true
```

### 설치

```bash
npm install -D lefthook
npx lefthook install
```

## CLI 명령어

```bash
# 린트 검사
npx biome check .

# 린트 + 자동 수정
npx biome check --write .

# 포매팅만 실행
npx biome format --write .

# 특정 파일/폴더만 검사
npx biome check src/components/
```

## 관련 문서

- [프로젝트 구조](project-structure.md)
- [CI/CD 가이드](cicd-guide.md)
