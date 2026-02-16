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

이후 접속:

- `http://localhost:8080/`

## GitHub Pages 배포

이 저장소는 GitHub Actions 기반 Pages 배포를 사용합니다.

1. 기본 브랜치를 `main`으로 사용합니다.
2. `main` 브랜치에 push 하면 `.github/workflows/deploy-pages.yml`이 자동 실행됩니다.
3. GitHub 저장소 `Settings > Pages`에서 Build and deployment를 `GitHub Actions`로 설정합니다.
4. 배포 완료 후 발급된 Pages URL에서 아래를 확인합니다.

- `/` 접속 시 메인 홈 노출
- 홈 > 기능연습 > 버튼 클릭 시 `practice/index.html?slot=n` 로드
- 홈 > 실전게임 > 기록원 클릭 시 `volleyball/index.html` 로드

## 브랜치 정책

현재 로컬 브랜치가 `master`라면 아래처럼 `main`으로 전환해 사용하세요.

```bash
git branch -m master main
git push -u origin main
```

원격 기본 브랜치도 `main`으로 변경한 뒤, 필요 시 기존 `master`를 정리합니다.

## 데이터 저장 방식

현재 데이터는 사용자 브라우저의 `localStorage`에 저장됩니다.

- 메인 앱: `vb_class_app_shell_v1`
- 기능연습: `vb_under_over_serve_v1__{slot}`
- 실전게임: `vb_scoreboard_full_v1`

즉, 사용자 간 실시간 공유는 아직 지원하지 않습니다. (Firebase 연동은 2단계 범위)
