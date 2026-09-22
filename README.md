# GreenGreen

서울의 보행자 신호정보를 지도에서 확인하는 Next.js 프로젝트입니다.

NAVER Maps Dynamic Map과 서울교통빅데이터플랫폼(T-Data)의 C-ITS 데이터를 사용합니다.

## 시작하기

1. NAVER Cloud Platform에서 Maps 애플리케이션을 만들고 **Dynamic Map**을 선택합니다.
2. Web 서비스 URL에 로컬 주소(`http://localhost:3000`)를 등록합니다.
3. 서울 T-Data에서 실시간 신호정보 API 키를 발급받습니다.
4. `.env.example`을 `.env.local`로 복사하고 값을 입력합니다.
5. 아래 명령을 실행합니다.

```bash
pnpm install
pnpm dev
```

```env
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=your_naver_maps_client_id
TDATA_API_KEY=your_tdata_api_key
```

`TDATA_API_KEY`는 Next.js Route Handler에서만 사용하며 브라우저에 노출하지 않습니다.

## 신호정보 조회 방식

- 기본 지도 줌은 15입니다.
- 줌 16 이상에서만 현재 지도 범위의 신호 교차로를 조회합니다.
- 지도 이동이 끝난 뒤 400ms debounce를 적용합니다.
- 교차로 위치는 T-Data 공식 CSV 스냅샷을 사용합니다.
- 선택한 교차로의 실시간 보행신호만 서버에서 조회합니다.
- 잔여시간은 최신 API 응답값으로 즉시 보정한 뒤 클라이언트에서 카운트다운하고 10초마다 서버와 동기화합니다.
- 유효한 잔여시간이 0초가 되면 정기 동기화 전이라도 신호정보를 한 번 더 조회합니다.
- V2X 규격의 invalid 잔여값(`36001`)은 실제 시간으로 표시하지 않습니다.
- 30초 이상 오래된 데이터는 현재 신호로 표시하지 않습니다.

제공되는 신호정보는 통신상태에 따라 실제 신호와 차이가 발생할 수 있습니다. 횡단 시 반드시 실제 신호등을 확인하세요.

## 확인 명령

```bash
pnpm lint
pnpm type-check
pnpm build
```
