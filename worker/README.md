# Cloudflare Worker 게이트 배포

## 1) 사전 준비

1. Cloudflare 계정 로그인
2. `worker/` 폴더에서 Wrangler 사용

```bash
cd worker
npm create cloudflare@latest . -- --type=hello-world
```

이미 파일이 있으면 이 단계는 건너뜁니다.

## 2) KV 생성

```bash
npx wrangler kv namespace create GATE_KV
npx wrangler kv namespace create GATE_KV --preview
```

출력된 ID를 `wrangler.toml`의 `id`, `preview_id`에 입력하세요.

## 3) 관리자 비밀번호 secret 등록

```bash
npx wrangler secret put ADMIN_PASSWORD
```

## 4) 배포

```bash
npx wrangler deploy
```

배포 후 Worker URL(`https://...workers.dev`)을 루트 `firebase.config.js`의 `window.GATE_API_BASE`에 입력하세요.

## 5) 동작 확인

- `GET /gate?classId=public-class-1`
- `POST /gate` body 예시:

```json
{
  "classId": "public-class-1",
  "open": true,
  "note": "2교시 시작",
  "password": "<ADMIN_PASSWORD>"
}
```

주의:
- CORS는 `https://choiyongwoo.github.io`만 허용됩니다.
- 응답은 `Cache-Control: no-store`입니다.
