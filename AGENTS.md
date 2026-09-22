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