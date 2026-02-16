# 배구수업 웹앱

정적 웹앱 3개 페이지로 구성됩니다.

- 메인 앱(홈): `index.html`
- 기능연습: `practice/index.html`
- 실전게임 기록원: `volleyball/index.html`

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

## Firebase 연동 설정

코드에는 Firestore 동기화가 이미 연결되어 있습니다. 콘솔 값만 넣으면 동작합니다.

1. Firebase 콘솔에서 프로젝트/웹앱 생성
2. Firestore Database 생성
3. 루트 `firebase.config.js`에 Web SDK 값 입력
4. 필요 시 `window.CLASS_ID` 변경 (기본: `public-class-1`)

### Firestore 문서 경로

- `classes/{CLASS_ID}/states/app_shell`
- `classes/{CLASS_ID}/states/practice_slot_{slot}`
- `classes/{CLASS_ID}/states/scoreboard`

### Firestore Rules 예시(공개 테스트용)

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /classes/public-class-1/states/{docId} {
      allow read, write: if true;
    }
  }
}
```

주의: 위 규칙은 누구나 수정 가능하므로 운영 시 인증/권한 규칙으로 교체하세요.

## 현재 저장 키

- 메인 앱: `vb_class_app_shell_v1`
- 기능연습: `vb_under_over_serve_v1__{slot}`
- 실전게임: `vb_scoreboard_full_v1`

로컬 저장(`localStorage`)은 유지되고, Firebase가 설정되면 Firestore와 병행 동기화됩니다.
