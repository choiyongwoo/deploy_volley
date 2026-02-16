# 배구수업 웹앱

정적 웹앱 4개 페이지로 구성됩니다.

- 메인 앱(홈): `index.html`
- 기능연습: `practice/index.html`
- 실전게임 기록원: `volleyball/index.html`
- 관리자 게이트: `admin.html`

## 로컬 실행

브라우저에서 `file://`로 열지 말고 로컬 서버로 실행하세요.

```bash
python3 -m http.server 8080
```

접속:

- `http://localhost:8080/`

## GitHub Pages 배포

1. 기본 브랜치를 `main`으로 사용합니다.
2. `main` 브랜치에 push 하면 `.github/workflows/deploy-pages.yml`이 실행됩니다.
3. GitHub 저장소 `Settings > Pages`에서 Build and deployment를 `GitHub Actions`로 설정합니다.
4. 배포 URL에서 아래를 확인합니다.

- `/` 접속 시 메인 홈 노출
- 홈 > 기능연습 > 버튼 클릭 시 `practice/index.html?slot=n` 로드
- 홈 > 실전게임 > 기록원 클릭 시 `volleyball/index.html` 로드

### 정적 파일 캐시 버전 규칙

GitHub Pages 캐시로 인해 일반 새로고침에서 예전 JS가 남을 수 있으므로, 주요 스크립트 URL에 `?v=...`를 사용합니다.

- 현재 버전: `20260216-4`
- 다음 배포에서 `gate.js` 또는 `firebase.config.js`를 수정했다면, `index.html`, `practice/index.html`, `volleyball/index.html`, `admin.html`의 `?v=` 값을 함께 증가시키세요.

## 게이트 운영 (Cloudflare Worker + KV)

게이트는 Firebase가 아니라 Cloudflare Worker API를 사용합니다.

1. `worker/` 폴더 기준으로 Worker 배포
2. KV namespace 생성 후 `worker/wrangler.toml`에 ID 입력
3. `ADMIN_PASSWORD` secret 등록
4. `npx wrangler deploy`
5. Worker URL을 `firebase.config.js`의 `window.GATE_API_BASE`에 입력

상세 절차는 `worker/README.md`를 참고하세요.

### 게이트 API

- `GET /gate?classId=public-class-1`
  - 응답: `{ open, updatedAt, note }`
- `POST /gate`
  - 요청: `{ classId, open, note, password }`

학생 페이지는 `gate.js`에서 2초 폴링으로 게이트 상태를 확인합니다.

- 초기 조회 실패: 즉시 잠금(Fail-Closed)
- 운영 중 연속 실패 3회: 잠금

## Firebase 연동 (기록 저장 전용)

기록 데이터 동기화는 기존 Firestore를 계속 사용합니다.

1. Firebase 콘솔에서 프로젝트/웹앱 생성
2. Firestore Database 생성
3. 루트 `firebase.config.js`에 Web SDK 값 입력
4. `window.CLASS_ID` 확인 (기본: `public-class-1`)

### Firestore 문서 경로

- `classes/{CLASS_ID}/states/app_shell`
- `classes/{CLASS_ID}/states/practice_slot_{slot}`
- `classes/{CLASS_ID}/states/scoreboard`

### Firestore Rules 적용

저장소의 `firestore.rules` 내용을 Firebase 콘솔 Rules 탭에 적용하세요.

현재 정책:

- `classes/{CLASS_ID}/states/*` read/write 허용
- 게이트 문서는 Firestore를 사용하지 않음

## 관리자 운영 흐름

1. `admin.html` 접속
2. 관리자 비밀번호 입력
3. `수업 열기 (ON)` 또는 `수업 닫기 (OFF)` 클릭

## 현재 저장 키

- 메인 앱: `vb_class_app_shell_v1`
- 기능연습: `vb_under_over_serve_v1__{slot}`
- 실전게임: `vb_scoreboard_full_v1`

로컬 저장(`localStorage`)은 유지되고, Firebase가 설정되면 Firestore와 병행 동기화됩니다.
