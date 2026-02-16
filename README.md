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

- 현재 버전: `20260216-3`
- 다음 배포에서 `gate.js` 또는 `firebase.config.js`를 수정했다면, `index.html`, `practice/index.html`, `volleyball/index.html`, `admin.html`의 `?v=` 값을 함께 증가시키세요.

## Firebase 연동/게이트 설정

코드에는 Firestore 동기화 + 관리자 ON/OFF 게이트가 연결되어 있습니다.

1. Firebase 콘솔에서 프로젝트/웹앱 생성
2. Firestore Database 생성
3. 루트 `firebase.config.js`에 Web SDK 값 입력
4. `window.CLASS_ID` 확인 (기본: `public-class-1`)
5. `window.ADMIN_EMAILS`(또는 `window.ADMIN_EMAIL`)에 관리자 Google 이메일 입력
6. (선택) `window.__VB_GATE_CONFIG__.prefetchRequired = true`를 페이지에서 설정하면, 선조회 실패 시 즉시 잠금으로 동작합니다. 기본값은 `false`입니다.

### Firestore 문서 경로

- `classes/{CLASS_ID}/control/gate` (관리자 게이트)
- `classes/{CLASS_ID}/states/app_shell`
- `classes/{CLASS_ID}/states/practice_slot_{slot}`
- `classes/{CLASS_ID}/states/scoreboard`

### Firestore Rules 적용

저장소의 `firestore.rules` 내용을 Firebase 콘솔 Rules 탭에 적용하세요.

관리자 게이트 규칙 핵심:

- `control/gate`: 읽기 가능, 쓰기는 관리자만
- `states/*`: 관리자 또는 gate가 열린 경우에만 read/write 가능

## 관리자 운영 흐름

1. `admin.html` 접속
2. 관리자 Google 계정으로 로그인
3. `수업 열기 (ON)` 클릭 시 학생 페이지 입장 허용
4. `수업 닫기 (OFF)` 클릭 시 즉시 잠금

기본 정책:

- gate 문서가 없거나 `open=false`이면 학생 페이지 차단
- 게이트 상태 확인 실패 시 차단(기본 거부)

## 참고 Rules 템플릿

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [\"teacher@example.com\"];
    }

    function gateOpen(classId) {
      return exists(/databases/$(database)/documents/classes/$(classId)/control/gate)
        && get(/databases/$(database)/documents/classes/$(classId)/control/gate).data.open == true;
    }

    match /classes/{classId}/control/{docId} {
      allow read: if docId == \"gate\";
      allow write: if docId == \"gate\" && isAdmin();
    }

    match /classes/{classId}/states/{docId} {
      allow read, write: if isAdmin() || gateOpen(classId);
    }
  }
}
```

주의: `teacher@example.com`은 실제 관리자 이메일로 바꾸고, `firebase.config.js`의 `window.ADMIN_EMAIL`과 동일하게 맞추세요.

## 현재 저장 키

- 메인 앱: `vb_class_app_shell_v1`
- 기능연습: `vb_under_over_serve_v1__{slot}`
- 실전게임: `vb_scoreboard_full_v1`

로컬 저장(`localStorage`)은 유지되고, Firebase가 설정되면 Firestore와 병행 동기화됩니다.
