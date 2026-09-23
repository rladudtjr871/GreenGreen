# GreenGreen iOS / Android 출시 가이드

> 작성 기준일: 2026-09-23  
> 대상 프로젝트: Next.js App Router + React + NAVER Maps JavaScript API + 서울 T-Data C-ITS API

## 결론

GreenGreen은 iOS와 Android 앱으로 출시할 수 있다. 현재 웹 코드를 가장 많이 재사용하면서 스토어 출시까지 가는 현실적인 방법은 **Capacitor 기반 하이브리드 앱**이다.

권장 구조는 다음과 같다.

```text
iOS / Android 앱
└─ Capacitor WebView
   ├─ 앱에 포함된 GreenGreen 정적 UI
   ├─ NAVER Web Dynamic Map
   └─ HTTPS 요청
      └─ 배포된 Next.js 서버
         ├─ /api/intersections
         ├─ /api/signals/[intersectionId]
         └─ T-Data API 키 보관 및 외부 API 호출
```

단순히 현재 웹사이트 URL을 WebView로 여는 앱은 권장하지 않는다. Capacitor의 `server.url`은 공식 문서상 라이브 리로드용이며 production 사용을 위한 설정이 아니다. 또한 Apple은 웹사이트를 다시 포장한 수준의 앱을 최소 기능 미달로 거절할 수 있다.

따라서 다음 순서가 안전하다.

1. **NAVER 지도 WebView 호환성 검증**을 실제 iPhone과 Android 기기에서 먼저 수행한다.
2. 모바일 앱에 정적 UI를 포함하고, 서버 API는 현재 Next.js 배포 환경에 남긴다.
3. 현재 위치 기능만 네이티브 위치 권한과 연결한다.
4. 앱 생명주기, 네트워크 오류, 안전 안내를 보완한 뒤 스토어 심사를 진행한다.

---

## 출시 방법 비교

| 방법 | 코드 재사용 | 스토어 출시 | 장점 | 단점 | 판단 |
| --- | ---: | ---: | --- | --- | --- |
| PWA | 매우 높음 | 직접 출시 아님 | 가장 빠르고 유지보수가 단순함 | 앱스토어 검색·배포 경험이 제한됨 | 앱 출시 전 보조 채널 |
| Capacitor 하이브리드 앱 | 높음 | 가능 | 현재 React UI와 지도 코드를 대부분 재사용 가능 | WebView·지도 인증·앱 심사 검증 필요 | **1차 출시 권장** |
| React Native | 중간 이하 | 가능 | 네이티브 UX와 성능을 확보하기 쉬움 | DOM/CSS/지도 코드를 상당 부분 다시 작성해야 함 | 이용자·기능 증가 후 검토 |
| Swift/Kotlin 네이티브 | 낮음 | 가능 | 플랫폼 최적화와 NAVER 네이티브 SDK 활용에 유리 | iOS/Android 이중 개발 및 유지보수 비용이 큼 | 장기 선택지 |

Android 전용 TWA(Trusted Web Activity)도 가능하지만 iOS와 공통 전략이 되지 않고, 웹사이트 의존도가 높으므로 이번 프로젝트의 기본안에서는 제외한다.

---

## 현재 코드에서 바로 해결해야 할 사항

### 1. Next.js 서버와 모바일 번들을 분리해야 한다

현재 `src/services/greenGreenApi.ts`는 아래처럼 상대 URL을 호출한다.

```ts
fetch("/api/intersections?... ");
fetch(`/api/signals/${intersectionId}`);
```

웹에서는 같은 출처의 Next.js Route Handler로 연결되지만, 앱에 포함된 WebView의 출처는 일반 웹 도메인이 아니다. Capacitor 기본값 기준으로 iOS는 `capacitor://localhost`, Android는 `https://localhost` 형태가 된다. 따라서 상대 URL은 앱 내부를 향하게 되어 현재 API에 연결되지 않는다.

모바일 빌드에서는 다음과 같이 배포 서버의 절대 URL을 사용하도록 API 클라이언트를 변경해야 한다.

```text
Web:    /api/signals/123
Mobile: https://api.example.com/api/signals/123
```

권장 구현:

- `NEXT_PUBLIC_API_BASE_URL`처럼 **공개 가능한 API 기준 URL**을 환경별로 둔다.
- 웹에서는 빈 문자열을 사용해 현재의 상대 URL 동작을 유지한다.
- 앱에서는 production HTTPS 도메인을 사용한다.
- 서버는 허용된 앱 출처만 받도록 CORS를 명시한다.
- API 주소는 공개 정보로 간주한다. 비밀 키를 클라이언트 환경변수에 넣지 않는다.

### 2. 현재 프로젝트 전체를 그대로 정적 export 할 수는 없다

Capacitor는 빌드 결과물 디렉터리와 그 루트의 `index.html`을 요구한다. Next.js의 `output: "export"`가 이를 만들 수 있지만, 정적 export에서는 요청 시점에 실행되어야 하는 서버 기능을 사용할 수 없다.

현재 GreenGreen의 Route Handler는 지도 범위와 교차로 ID를 요청받아 동적으로 응답하므로 앱 번들에 포함될 수 없다. 다음 중 하나가 필요하다.

- **권장:** 모바일 전용 정적 진입점을 만들고 기존 Route Handler는 웹 서버에 유지한다.
- 프로젝트를 `apps/web`, `apps/mobile`, `packages/core` 형태로 분리해 모델·서비스·UI를 공유한다.
- 짧은 검증 단계에서는 별도 모바일 빌드 설정을 만들되, 웹 production 빌드 설정에는 영향을 주지 않는다.

정적 export를 위해 Route Handler를 삭제하거나 T-Data API 키를 앱으로 옮기면 안 된다.

### 3. NAVER 지도 인증 출처를 별도로 등록해야 한다

현재는 `NEXT_PUBLIC_NAVER_MAP_CLIENT_ID`로 Web Dynamic Map을 로드한다. NAVER Cloud 공식 가이드는 하이브리드 앱의 Web 서비스 URL에 `location.href` 출력값을 등록하도록 안내한다.

실기기에서 아래 값을 확인하고 NAVER Cloud Console의 Application에 등록한다.

```js
console.log(location.href);
console.log(location.origin);
```

주의사항:

- iOS와 Android의 로컬 출처가 서로 다를 수 있다.
- 개발용 출처와 production 출처를 구분한다.
- NAVER Cloud Console의 허용 URL 개수와 쿼터를 확인한다.
- WebView에서 인증 실패, 지도 타일 미노출, 마커 클릭, 드래그, 줌, 회전을 모두 실기기로 테스트한다.
- 네이버 로고와 법적 고지가 앱 UI에 가려지지 않게 한다.

Web Dynamic Map이 WebView에서 안정적으로 동작하지 않으면 `naverMap.adapter.ts`의 경계를 유지한 채 NAVER의 iOS/Android 네이티브 지도 SDK로 교체하는 2차 계획을 사용한다. 네이티브 SDK를 쓰면 Android package name과 iOS Bundle ID를 NAVER Cloud Console에 등록해야 한다.

### 4. 위치 기능을 플랫폼 권한과 연결해야 한다

현재 `navigator.geolocation`은 브라우저 권한을 사용한다. 앱에서는 Capacitor Geolocation을 얇은 어댑터로 감싸고 웹 구현과 네이티브 구현을 분리하는 편이 안정적이다.

GreenGreen은 사용자가 현재 위치 버튼을 누를 때 한 번 위치를 얻으면 충분하므로 **foreground / When In Use 권한만 요청**한다. background 위치 권한은 요청하지 않는다.

iOS:

- `Info.plist`에 위치 사용 설명을 추가한다.
- 사용하는 Capacitor Geolocation 버전의 공식 문서를 확인한다. 현재 v8 문서는 내부 의존성 때문에 background 위치를 사용하지 않더라도 `NSLocationWhenInUseUsageDescription`과 `NSLocationAlwaysAndWhenInUseUsageDescription` 두 설명 키를 요구하지만, 이것이 Always 권한을 실제로 요청하라는 의미는 아니다.
- 사용자가 현재 위치 버튼을 누르기 전에는 권한 팝업을 띄우지 않는다.
- 권한 거부, 1회 허용, 정확한 위치 비활성화를 각각 처리한다.
- 문구 예: `현재 위치 주변의 보행자 신호를 지도에 표시하기 위해 위치를 사용합니다.`

Android:

- `ACCESS_COARSE_LOCATION`과 필요한 경우 `ACCESS_FINE_LOCATION`을 선언한다.
- Android 12 이상에서 사용자가 대략적인 위치만 허용할 수 있음을 고려한다.
- 현재 기능에는 `ACCESS_BACKGROUND_LOCATION`이 필요하지 않다.
- 권한을 영구 거부한 경우 설정 화면 이동 방법과 수동 지도 이동 방법을 안내한다.

### 5. 앱 생명주기와 신호 타이머를 연결해야 한다

웹 타이머는 앱이 백그라운드에 있는 동안 일시 중지되거나 지연될 수 있다. 화면 복귀 시 기존 카운트다운을 그대로 신뢰하면 안 된다.

앱이 foreground로 복귀할 때:

1. 선택된 교차로가 있으면 신호 데이터를 새로 조회한다.
2. `receivedAt`과 현재 시간을 다시 비교한다.
3. 오래된 데이터는 실제 신호처럼 표시하지 않고 갱신 지연 상태를 보여준다.
4. 기존 3초 보정, 0초 도달 시 재조회, 5초 수동 새로고침 제한이 중복 요청을 만들지 확인한다.

백그라운드에서는 위치 추적과 신호 조회 타이머를 중지해 배터리와 API 호출량을 줄인다.

---

## 권장 프로젝트 구조

초기 검증은 작은 변경으로 시작하되, 정식 출시를 진행한다면 다음처럼 역할을 분리하는 것이 좋다.

```text
apps/
├─ web/                 # 현재 Next.js 웹 + Route Handler
└─ mobile/              # Capacitor용 정적 클라이언트
packages/
├─ domain/              # Intersection, Signal, MapCoordinate 등 내부 타입
├─ api-client/          # API base URL을 받는 클라이언트
└─ ui/                  # 공유 가능한 React UI와 CSS Module
```

처음부터 대규모 이동을 할 필요는 없다. 다음 두 가지 실험이 통과한 뒤 구조를 분리한다.

- NAVER Web Dynamic Map이 양 플랫폼 WebView에서 정상 동작하는가?
- 모바일 정적 UI가 배포된 Next.js API를 통해 교차로·신호 데이터를 정상 조회하는가?

---

## 단계별 구현 계획

### 단계 0. 출시 정보 결정

- 앱 이름: GreenGreen
- iOS Bundle ID와 Android Application ID 결정
- production 웹/API 도메인 결정
- 개인정보 처리방침 URL과 고객지원 URL 준비
- Apple Developer 계정과 Google Play Console 계정 준비
- iOS 빌드용 macOS와 Xcode 환경 준비

Bundle ID와 Application ID는 출시 후 변경이 어렵기 때문에 소유한 도메인을 역순으로 사용한다.

### 단계 1. 1~2일짜리 기술 검증

- 작은 Capacitor 앱에 현재 지도 화면을 넣는다.
- iPhone 실기기와 Android 실기기에서 NAVER 지도 로딩을 확인한다.
- 지도 제스처, 마커, 팝업, 현재 위치, 안전 영역을 확인한다.
- WebView의 실제 `location.href`를 NAVER Cloud Console에 등록한다.
- 배포 API와 CORS 통신을 확인한다.

이 단계가 실패하면 전체 앱 포장 작업을 진행하지 말고 NAVER 네이티브 지도 SDK 경로를 검토한다.

### 단계 2. API 경계 분리

- API 클라이언트에 환경별 base URL을 주입한다.
- `/api/intersections`, `/api/signals/[intersectionId]`는 서버에 유지한다.
- `TDATA_API_KEY`와 다른 서버 비밀값은 기존처럼 서버에서만 사용한다.
- 앱 출처 CORS allowlist를 구성하고 `OPTIONS` 요청을 처리한다.
- 지도 범위 조회와 신호 조회에 적절한 rate limit을 둔다.
- API 오류 응답에 내부 키, 외부 API 원문, 스택 트레이스를 노출하지 않는다.

### 단계 3. Capacitor 셸 구성

- 현재 시점의 안정 버전을 고정하고 `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`를 추가한다.
- `webDir`은 모바일 정적 빌드 결과물로 지정한다.
- production 설정에 `server.url`, `cleartext`, 광범위한 `allowNavigation`을 사용하지 않는다.
- HTTP가 아닌 HTTPS API만 허용한다.
- release 빌드의 WebView 디버깅과 상세 로그를 비활성화한다.

예상 설정 형태:

```ts
const config = {
  appId: "com.example.greengreen",
  appName: "GreenGreen",
  webDir: "out",
};
```

위 값은 예시이며 실제 도메인 소유권과 빌드 구조를 정한 뒤 확정한다.

### 단계 4. 네이티브 기능 연결

- 위치 권한과 현재 위치 조회
- 앱 pause/resume 이벤트
- 네트워크 연결 끊김·복구 이벤트
- 외부 링크를 시스템 브라우저로 열기
- 상태바, 홈 인디케이터, 노치의 safe area 대응
- Android 뒤로가기 동작과 신호 팝업 닫기 우선순위

푸시 알림, 백그라운드 위치, 광고 SDK는 현재 핵심 기능에 필요하지 않으므로 1차 출시에 넣지 않는다.

### 단계 5. 스토어 준비와 테스트

- 앱 아이콘, 스플래시, 스크린샷, 소개 문구 준비
- 개인정보 처리방침과 앱 내 접근 경로 추가
- App Store Privacy와 Google Play Data safety 작성
- TestFlight와 Play 내부 테스트 배포
- 실제 보행 환경에서는 화면 조작보다 안전을 우선하며, 기능 검증은 정지한 상태에서 수행
- 크래시, API 실패율, 지도 인증 실패율을 확인한 후 심사 제출

---

## 심사 및 정책 주의사항

### Apple App Store

Apple의 App Review Guideline 4.2는 웹사이트를 단순히 다시 포장한 앱보다 충분한 효용과 앱다운 기능을 요구한다.

심사 대응을 위해 다음을 포함하는 것이 좋다.

- 네이티브 현재 위치 권한 흐름
- 앱 복귀 시 신호 즉시 재동기화
- 네트워크 상태와 stale 데이터에 대한 명확한 UI
- 모바일 safe area와 플랫폼 뒤로가기 처리
- 웹사이트 링크 모음이 아닌 지도·신호 중심의 완성된 사용 흐름
- 심사 메모에 데이터 출처, 서울 서비스 범위, 위치 사용 이유, 신호 갱신 방식을 설명

2026-09-23 기준 App Store Connect 업로드는 Xcode 26 이상과 iOS 26 SDK를 사용해야 한다. 제출 직전 Apple의 Upcoming Requirements를 다시 확인한다.

### Google Play

2026-08-31부터 새 앱과 앱 업데이트는 Android 16, API level 36 이상을 타겟팅해야 한다. 연장 정책을 전제로 일정을 잡지 말고 처음부터 현재 요구 API를 적용한다.

2023-11-13 이후 생성한 개인 개발자 계정은 production 접근 전에 최소 12명의 테스터가 14일 연속 참여하는 비공개 테스트가 필요할 수 있다. 계정 유형과 생성일을 초기에 확인한다.

### 개인정보와 위치 데이터

- 위치는 개인·민감 데이터로 취급한다.
- 현재 위치를 서버에 전송하거나 저장하는지 코드와 네트워크 로그로 확인한다.
- 현재 구조는 위도·경도 원본을 직접 보내지는 않더라도 현재 위치를 중심으로 계산한 지도 bounds를 `/api/intersections`에 전송하므로 대략적인 위치가 유추될 수 있다. 이 값의 서버 로그·보존 여부까지 확인해 개인정보 처리방침과 스토어 응답에 반영한다.
- 서버 로그, 분석 SDK, 오류 수집 SDK가 URL·좌표·교차로 선택을 기록하는지도 함께 점검한다.
- Apple의 Privacy Policy URL, App Privacy 응답, iOS Privacy Manifest를 실제 동작과 일치시킨다.
- Google Play의 개인정보 처리방침과 Data safety 응답을 실제 동작 및 사용 SDK와 일치시킨다.
- 추후 계정 생성 기능을 넣으면 앱 안과 웹에서 계정 및 관련 데이터 삭제 경로를 제공해야 한다.

---

## 안전 서비스로서의 추가 주의사항

GreenGreen의 신호 데이터는 보행 안전에 직접 영향을 줄 수 있으므로 일반 지도 앱보다 보수적으로 표시해야 한다.

- `receivedAt` 기준 stale 판정을 앱에서도 유지한다.
- 백그라운드에서 복귀한 직후 이전 잔여 시간을 먼저 보여주지 않는다.
- 통신 실패 시 마지막 값을 현재 신호처럼 계속 카운트다운하지 않는다.
- “실시간”을 “실제 신호와 항상 정확히 일치”한다는 의미로 홍보하지 않는다.
- 다음 취지의 안전 문구를 신호 상세에서 계속 노출한다.

> 제공되는 신호정보는 통신상태에 따라 실제 신호와 차이가 발생할 수 있습니다. 횡단 시 반드시 실제 신호등을 확인하세요.

- 운전 중 사용을 유도하는 문구나 UI를 넣지 않는다.
- 화면 캡처와 스토어 소개에도 실제 신호 확인이 우선임을 명확히 한다.
- 3초 보정값은 경험값이므로 실제 데이터 지연의 원인을 대체하지 않는다. 서버 수신 시각, 원본 관측 시각, 네트워크 왕복 시간을 분리 측정한다.

---

## 보안 체크리스트

- [ ] `TDATA_API_KEY`, `SEOUL_OPEN_DATA_KEY`가 앱 번들에 포함되지 않는다.
- [ ] `NEXT_PUBLIC_` 값은 누구나 볼 수 있는 공개 설정으로 취급한다.
- [ ] API는 HTTPS만 사용한다.
- [ ] Android `allowMixedContent`와 `cleartext`는 production에서 비활성화한다.
- [ ] Capacitor `server.url`을 production에서 사용하지 않는다.
- [ ] CORS에 `*`를 사용하지 않고 필요한 출처만 허용한다.
- [ ] 외부 링크는 WebView 내부 임의 탐색 대신 허용 목록 또는 시스템 브라우저를 사용한다.
- [ ] release 빌드에서 WebView 디버깅과 민감 로그를 끈다.
- [ ] 의존성 및 포함된 SDK의 개인정보 수집 항목을 확인한다.
- [ ] Android upload key/keystore를 암호화해 별도 백업한다.
- [ ] Apple 인증서·프로비저닝·App Store Connect 권한을 개인 계정에만 의존하지 않는다.

---

## 실기기 테스트 매트릭스

| 영역 | 필수 테스트 |
| --- | --- |
| 지도 | 최초 로딩, 드래그, 줌, 회전, 마커 탭, NAVER 인증 실패 |
| 위치 | 최초 허용, 1회 허용, 거부, 영구 거부, 대략적 위치, GPS 꺼짐 |
| 신호 | 초록/빨강, 다방향, 0초 재조회, 3초 보정, stale, 수동 새로고침 5초 제한 |
| 앱 상태 | 홈 이동 후 복귀, 화면 잠금 후 복귀, 장시간 백그라운드, 프로세스 종료 후 재실행 |
| 네트워크 | 오프라인 시작, 요청 중 단절, 느린 통신, Wi-Fi/셀룰러 전환, 서버 오류 |
| 지역 | 서울 내부, 서울 외부 서비스 준비중, 지도 수동 이동 |
| 화면 | 작은 iPhone, Dynamic Island/노치, Android 제스처 바, 큰 글자, 가로 회전 정책 |
| 접근성 | 버튼 이름, 터치 영역, 색상 외 상태 표현, VoiceOver/TalkBack 기본 탐색 |

특히 다음 실제 사용자 흐름을 회귀 테스트한다.

1. 앱 실행 → 현재 위치 버튼 → 위치 권한 허용 → 신호등 마커 선택
2. 신호 팝업 표시 → 앱 백그라운드 → 수 초 뒤 복귀 → 최신 데이터 재조회
3. 신호 팝업 닫기 → 현재 위치 버튼과 가이드 재노출
4. 서울 밖으로 지도 이동 → 신호 API를 호출하지 않고 서비스 준비중 표시
5. 네트워크 끊김 → 이전 신호를 현재 값처럼 표시하지 않고 오류 안내

---

## 출시 체크리스트

### 공통

- [ ] 앱 ID, 앱 이름, 버전 정책 확정
- [ ] production API 도메인과 HTTPS 인증서 준비
- [ ] NAVER 지도 하이브리드 앱 출처 등록 및 쿼터 확인
- [ ] 개인정보 처리방침·고객지원 페이지 공개
- [ ] 위치 정보의 수집·전송·저장 여부 확인
- [ ] 앱 아이콘, 스플래시, 스토어 스크린샷 준비
- [ ] 실기기 테스트와 안전 문구 검수 완료

### iOS

- [ ] Xcode와 iOS SDK 제출 요구 버전 재확인
- [ ] Bundle ID, Signing, Provisioning 설정
- [ ] `NSLocationWhenInUseUsageDescription` 문구 검수
- [ ] Privacy Manifest와 App Privacy 응답 검수
- [ ] TestFlight 내부/외부 테스트
- [ ] 심사 메모에 위치 권한과 신호 데이터 동작 설명

### Android

- [ ] target API 요구사항 재확인
- [ ] Application ID와 release signing 설정
- [ ] `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` 최소 선언
- [ ] Data safety와 개인정보 처리방침 검수
- [ ] AAB release 빌드 및 Play App Signing 설정
- [ ] 계정 조건에 따른 12명·14일 비공개 테스트 여부 확인

---

## 예상 일정

NAVER 지도 WebView 검증이 성공한다는 전제의 대략적인 일정이다.

| 단계 | 예상 기간 | 결과물 |
| --- | ---: | --- |
| 기술 검증 | 1~2일 | 양 플랫폼 지도·API·위치 동작 확인 |
| API/빌드 분리 | 2~4일 | 모바일 정적 빌드와 production API 연결 |
| 네이티브 통합 | 2~4일 | 위치 권한, 생명주기, 네트워크, safe area |
| QA 및 스토어 자료 | 3~7일 | 실기기 검증, 개인정보 문서, 스크린샷 |
| 베타 및 심사 | 플랫폼별 변동 | TestFlight / Play 테스트 / 심사 대응 |

지도 SDK를 네이티브로 교체하거나 심사 보완이 필요하면 일정이 크게 늘어날 수 있다.

---

## 다음 작업 제안

바로 전체 구조를 바꾸기보다 다음 작업을 하나의 작은 브랜치에서 먼저 수행한다.

1. Capacitor 최소 셸 생성
2. 현재 지도 화면의 정적 빌드 가능 여부 확인
3. 실기기 WebView의 `location.href` 확인 및 NAVER Cloud 등록
4. 임시 production API base URL로 교차로·신호 조회
5. iOS/Android 각각 현재 위치 1회 조회
6. 결과를 바탕으로 Web Dynamic Map 유지 또는 네이티브 지도 전환 결정

이 검증 결과가 나오기 전에는 대규모 모노레포 변경이나 네이티브 지도 재작성을 시작하지 않는 것이 좋다.

---

## 공식 문서

정책과 제출 요구사항은 변경될 수 있으므로 실제 제출 직전에 다시 확인한다.

### Apple

- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/)
- [Requesting authorization to use location services](https://developer.apple.com/documentation/corelocation/requesting-authorization-to-use-location-services)
- [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
- [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)

### Google / Android

- [Google Play 대상 API 수준 요구사항](https://support.google.com/googleplay/android-developer/answer/11926878?hl=ko)
- [Android 위치 권한](https://developer.android.com/develop/sensors-and-location/location/permissions)
- [Google Play User data 정책](https://support.google.com/googleplay/android-developer/answer/10144311)
- [신규 개인 개발자 계정 앱 테스트 요구사항](https://support.google.com/googleplay/android-developer/answer/14151465)

### Capacitor / Next.js

- [Capacitor 설치와 기존 웹 앱 연동](https://capacitorjs.com/docs/getting-started)
- [Capacitor 설정](https://capacitorjs.com/docs/config)
- [Capacitor Geolocation](https://capacitorjs.com/docs/apis/geolocation)
- [Capacitor 보안 가이드](https://capacitorjs.com/docs/guides/security)
- [Next.js Static Exports](https://nextjs.org/docs/app/guides/static-exports)

### NAVER Maps

- [NAVER Cloud Maps Application 등록 가이드](https://guide.ncloud-docs.com/docs/maps-app)
- [NAVER Web Dynamic Map API](https://guide.ncloud-docs.com/docs/maps-web-sdk)
- [NAVER 지도 Android SDK 시작하기](https://navermaps.github.io/android-map-sdk/guide-ko/1.html)
- [NAVER 지도 iOS SDK 가이드](https://navermaps.github.io/ios-map-sdk/guide-ko/)
