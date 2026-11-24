# AGENTS.md

## Project

이 프로젝트는 Next.js 기반 실시간 보행자 신호등 지도 서비스다.

초기 서비스 지역은 서울이며,
NAVER Maps와 서울 T-Data C-ITS API를 사용한다.

---

## Tech Stack

- Next.js App Router
- TypeScript
- React
- TanStack Query
- NAVER Maps JavaScript API
- CSS Modules
- pnpm

불필요한 라이브러리를 추가하지 않는다.

새로운 production dependency가 필요하면
기존 라이브러리 또는 직접 구현으로 해결 가능한지 먼저 확인한다.

---

## Component Architecture

모든 UI 컴포넌트는 아래 구조를 따른다.

ComponentName/
├─ ComponentName.tsx
├─ ComponentName.module.css
└─ useComponentName.ts

### ComponentName.tsx

TSX는 렌더링 중심으로 작성한다.

가능한 한 다음 로직을 작성하지 않는다.

- API 호출
- React Query
- useEffect 기반 비즈니스 로직
- 지도 이벤트 처리
- 좌표 계산
- 데이터 변환
- Timer
- 복잡한 Event Handler

이러한 로직은 useComponentName.ts로 분리한다.

예:

const {
    mapRef,
    intersections,
    selectedIntersection,
    handleCurrentLocation,
} = useTrafficMap();

return (...);

---

## Hooks

컴포넌트에 종속된 로직은

useComponentName.ts

에 작성한다.

여러 컴포넌트에서 공통으로 사용하는 로직만
src/hooks에 작성한다.

---

## CSS

스타일은 반드시 CSS Module을 사용한다.

ComponentName.module.css

inline style은 사용하지 않는다.

단 NAVER Maps SDK에서 API 특성상
style object가 필요한 경우는 예외로 한다.

---

## API Architecture

외부 공공 API를 Client Component에서 직접 호출하지 않는다.

항상 다음 구조를 사용한다.

Browser
→ Next.js Route Handler
→ External API

예:

Browser
→ /api/intersections
→ T-Data

Browser
→ /api/signals/[intersectionId]
→ T-Data

API Key는 서버에서만 사용한다.

---

## API Keys

다음 환경변수는 Client에서 접근하지 않는다.

- TDATA_API_KEY
- SEOUL_OPEN_DATA_KEY

NAVER Maps의 Web Client ID처럼
브라우저 사용이 필요한 값만 NEXT_PUBLIC_ prefix를 사용한다.

.env.local을 Git에 commit하지 않는다.

---

## External API Models

외부 API Response 타입을 UI에서 직접 사용하지 않는다.

외부 데이터는 mapper를 거쳐
프로젝트 내부 모델로 변환한다.

예:

외부:

- itstId
- mapCtptIntLat
- mapCtptIntLot

내부:

- intersectionId
- latitude
- longitude

UI에서는 내부 타입만 사용한다.

---

## Map Architecture

NAVER Maps 종속 코드는 가능한 한 Adapter에 모은다.

예:

src/adapters/map/naverMap.adapter.ts

비즈니스 로직에서 가능한 한

naver.maps.LatLng

같은 SDK 타입을 직접 사용하지 않는다.

대신 프로젝트 타입을 사용한다.

type MapCoordinate = {
    latitude: number;
    longitude: number;
};

향후 Kakao Map 또는 MapLibre로 변경할 수 있는 구조를 유지한다.

---

## Map Query Rules

교차로 데이터는 일정 Zoom 이상에서만 조회한다.

Zoom 기준은 constants/map.ts에서 관리한다.

지도 이동 중 API를 반복 호출하지 않는다.

bounds_changed 이벤트마다 조회하지 않는다.

기본 흐름:

Map Move
→ idle
→ bounds 계산
→ debounce
→ query

debounce는 약 300~500ms 범위를 사용한다.

---

## React Query

Query Key는 도메인 기준으로 명확하게 작성한다.

예:

["intersections", normalizedBounds]

["signal", intersectionId]

신호 Query는 intersectionId가 있을 때만 활성화한다.

지도 Bounds는 미세한 좌표 변화마다
새로운 Query Key가 생성되지 않도록 정규화한다.

---

## Signal Data

실시간 신호 API를 1초마다 호출하지 않는다.

서버에서 remainingSeconds를 받은 후
Client에서 Countdown을 수행한다.

예:

API:
18초

Client:
18
17
16
15

정해진 polling 주기에 다시 서버와 동기화한다.

---

## Safety

실시간 신호 데이터가 오래된 경우
현재 신호처럼 표시하지 않는다.

receivedAt을 기준으로 stale 여부를 판단한다.

오래된 데이터는 다음과 같이 처리한다.

"신호정보 갱신이 지연되고 있습니다."

신호 상세 영역에는 항상 다음 취지의 안내를 표시한다.

"제공되는 신호정보는 통신상태에 따라 실제 신호와 차이가 발생할 수 있습니다.
횡단 시 반드시 실제 신호등을 확인하세요."

---

## Security

API Architecture, API Keys 규칙에 더해 다음 보안 규칙을 따른다.

### Secrets

서버 전용 비밀값은 NEXT_PUBLIC_ prefix를 붙이지 않는다.

예:

- TDATA_API_KEY
- EMAIL_API_KEY
- EMAIL_SERVICE_ID
- EMAIL_TEMPLATE_ID

비밀값을 읽는 코드는 Route Handler 또는 src/services 같은 서버 코드에만 둔다.

"use client" 파일이나 Client Component가 import하는 모듈에서
process.env의 서버 전용 값을 참조하지 않는다.

API Key, Token, 비밀번호를 코드, 주석, 테스트, 문서, 커밋 메시지에 하드코딩하지 않는다.

외부 API URL에 API Key가 query string으로 포함되는 경우
해당 URL 전체를 로그나 에러 메시지에 남기지 않는다.

### Input Validation

Route Handler로 들어오는 모든 입력은 신뢰하지 않는다.

클라이언트에서 검증했더라도 서버에서 다시 검증한다.

- Path Parameter: 허용 형식을 정규식 등으로 검사한다. (예: intersectionId는 숫자만 허용)
- Query String: 숫자 범위, bounds 좌표 범위, 최대 영역 크기를 검사한다.
- Request Body: unknown으로 받고 type guard로 필드 타입을 확인한다.
- 문자열: trim 후 최대 길이를 제한한다. 길이 제한 값은 상수로 관리한다.

검증에 실패하면 외부 API를 호출하지 않고 400을 반환한다.

검증되지 않은 값을 외부 API URL, 이메일 템플릿, 파일 경로에 그대로 넣지 않는다.

### Error Handling

외부 API의 원본 에러 메시지, Response Body, Stack Trace를
클라이언트 응답에 그대로 포함하지 않는다.

클라이언트에는 사전에 정의한 사용자용 메시지와 적절한 status code만 반환한다.

상세 원인은 서버 로그에만 남긴다.

예:

- 외부 API 장애: 502
- 예기치 않은 서버 오류: 500 + "잠시 후 다시 시도해 주세요."

### Logging

다음 정보는 로그에 남기지 않는다.

- API Key, Token 등 비밀값
- 사용자의 현재 위치 좌표
- 문의 내용 전문

디버깅용 console.log는 커밋 전에 제거한다.

### Location Privacy

사용자의 현재 위치는 브라우저에서 지도 표시와 주변 조회에만 사용한다.

현재 위치 좌표를 서버에 저장하거나 외부 서비스로 전송하지 않는다.

주변 데이터 조회가 필요하면 정확한 사용자 좌표 대신
정규화된 지도 bounds를 사용한다.

위치 권한 요청은 사용자가 현재 위치 기능을 사용할 때만 수행한다.

### Contact / Email

문의 메일은 수신 주소가 고정된 템플릿으로만 발송한다.

수신자, 발신자, 제목 헤더 등을 사용자 입력으로 결정하지 않는다.

문의 API는 남용될 수 있으므로
요청 크기 제한과 반복 요청 방지(rate limit 등)를 고려한다.

<!-- TODO: 배포 환경(Vercel 등)에 맞는 rate limit 방식이 정해지면 구체적으로 기술한다. -->

### Rendering

사용자 입력이나 외부 API 문자열을 dangerouslySetInnerHTML로 렌더링하지 않는다.

NAVER Maps Marker나 InfoWindow에 HTML 문자열을 사용하는 경우
외부 데이터(교차로 이름, 장소명 등)는 반드시 escape 처리한다.

외부 링크는 target="_blank" 사용 시 rel="noopener noreferrer"를 함께 지정한다.

### Caching

실시간 신호 응답은 Cache-Control: no-store로 반환해
브라우저나 중간 캐시에 오래된 신호가 남지 않게 한다.

사용자별 데이터나 문의 API 응답은 공유 캐시에 저장되지 않도록 한다.

### Dependencies

새로운 dependency를 추가하기 전에 다음을 확인한다.

- 기존 라이브러리 또는 직접 구현으로 해결 가능한지
- 유지보수 상태와 다운로드 규모
- 알려진 취약점 (pnpm audit)

pnpm-lock.yaml은 항상 함께 커밋한다.

---

## Mock Data

실제 API 명세가 확인되지 않은 경우
임의로 API URL이나 Response 구조를 추측하지 않는다.

Mock 데이터를 사용하고 TODO를 남긴다.

실제 API 연동 시
UI를 크게 수정하지 않아도 되도록
service와 mapper를 분리한다.

---

## TypeScript

any 사용을 피한다.

타입을 우회하기 위해

as any

를 사용하지 않는다.

필요한 타입을 정의한다.

---

## Code Quality

작업 완료 후 가능한 경우 다음을 실행한다.

pnpm lint

TypeScript 오류가 없는지 확인한다.

기존 코드와 관련 없는 파일은 수정하지 않는다.

불필요한 refactoring을 하지 않는다.

---

## Package Manager

패키지 매니저는 pnpm을 사용한다.

npm install 또는 yarn을 사용하지 않는다.

---

## Development Principle

한 번에 큰 기능을 구현하지 않는다.

기능을 작은 단계로 나눠 구현한다.

예:

1. 지도
2. 현재 위치
3. Zoom
4. Bounds
5. Mock Intersection
6. Marker
7. Signal
8. Countdown
9. 실제 API

각 단계가 정상 동작하는 것을 확인한 후 다음 단계로 진행한다.


## Commenting and Logic Flow Rules

비즈니스 로직, 상태 처리, API 호출, 지도 이벤트, 데이터 가공처럼
처리 순서가 존재하거나 의도를 파악하기 어려운 로직에는 반드시 주석을 작성한다.

주석은 단순히 "무엇을 하는 코드인지"만 적는 것이 아니라,
"왜 이 처리가 필요한지", "왜 이 순서로 처리하는지"까지 설명한다.

### Sequential Logic

처리 순서가 있는 로직은 반드시 번호를 붙여 주석으로 구분한다.

기본 형식:

```ts
// 1. 처리 내용
// 해당 처리가 필요한 이유와 의도 설명

// 2. 처리 내용
// 해당 처리가 필요한 이유와 의도 설명

// 3. 처리 내용
// 해당 처리가 필요한 이유와 의도 설명
```
