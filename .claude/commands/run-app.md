---
description: 개발 서버를 띄우고 방 목록·대화 화면(읽기 전용/쓰기)을 390×565로 캡처해 doc/300_검증/screenshots/{YYYYMMDD-HHMM}/에 저장하고 경로를 보고한다
---

# 앱 실행 + 스크린샷

화면을 실제로 띄우고 캡처해 파일로 남기는 것이 이 프로젝트의 "눈으로 확인"이다. 저쪽 패널 안에 들어가는 크기(약 390×565)로 본다.

> 프로젝트 루트가 작업 디렉터리다. 절대 경로를 쓰지 않는다.

## 1. 개발 서버 기동

`/dev-start`와 같은 방식. 이미 떠 있으면 재사용한다. `:5173`(Vite)과 `:3000/api/health`가 200이어야 다음으로 간다.

## 2. 테스트 토큰 (쓰기 권한 화면용)

```bash
npm run token:test -- --level 10 --nick 테스터 --ch 테스트캐릭터
```

- `server/scripts/token-test.ts`가 `.env`의 dev `TOKEN_SECRET`으로 서명한 토큰 한 줄을 출력한다. 값은 보고에 **싣지 않는다**(URL에만 쓴다).
- 스크립트가 아직 없으면 `token:test 스크립트 미구현 — 토큰 없는 화면만 캡처`로 보고하고 읽기 전용 화면만 찍는다. 스크립트 구현은 server-manager 소관.
- 운영 `TOKEN_SECRET`으로 토큰을 만들지 않는다.

## 3. 스크린샷 저장 폴더

```bash
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "doc/300_검증/screenshots/$STAMP"
```

## 4. 캡처

### 4-A. 브라우저 MCP(puppeteer)가 있을 때 — 기본

| 순서 | URL | 파일 |
|---|---|---|
| 1 | `http://localhost:5173/` | `rooms-readonly.png` (「+ 새 방」·입력창 없음 확인) |
| 2 | `http://localhost:5173/?t=<토큰>` | `rooms-writer.png` (「+ 새 방」 보임) |
| 3 | 2에서 방 하나 클릭 | `chat-writer.png` (캐릭터 버튼 2 + OOC + 입력창) |

- `mcp__puppeteer__puppeteer_navigate` → viewport **390×565** 설정(`puppeteer_evaluate`로 `window.resizeTo` 불가하면 launch 옵션의 `defaultViewport`) → `mcp__puppeteer__puppeteer_screenshot`(name은 위 파일명, 저장 경로는 결과를 `doc/300_검증/screenshots/$STAMP/`에 둔다).
- 방이 하나도 없으면 2번 화면에서 「+ 새 방」으로 `스크린샷용` 방을 만들고 3번을 찍는다. 끝나면 그 방은 그대로 둔다(dev DB).

### 4-B. 브라우저 MCP가 없을 때 — PowerShell 전체 화면 캡처

브라우저를 위 URL로 연 뒤(창 폭을 400px 안팎으로 줄인다) 전체 화면을 캡처한다.

```powershell
$env:STAMP = Get-Date -Format "yyyyMMdd-HHmm"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$bmp.Save("doc/300_검증/screenshots/$env:STAMP/rooms-readonly.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
```

- 파일명 규칙 `{screen}-{state}.png`: `rooms-readonly`, `rooms-writer`, `chat-writer`, 필요 시 `chat-generating`, `chat-menu`.
- 브라우저 창 열기: `Start-Process "http://localhost:5173/"`. 창 크기 조절은 사용자가 하거나 전체 화면 캡처 후 좌표로 잘라낸다.

## 5. 확인과 보고

- 저장된 PNG를 `Read`로 열어 실제 화면이 담겼는지 본다. 검은 화면·빈 화면·Vite 오류 오버레이면 실패로 보고한다.
- 보고 형식:
  ```
  실행: dev (server :3000 · vite :5173)
  토큰: 있음(level 10) | 없음(token:test 미구현)
  스크린샷: doc/300_검증/screenshots/{STAMP}/
    - rooms-readonly.png (확인: 방 목록만, 쓰기 UI 없음)
    - rooms-writer.png   (확인: 「+ 새 방」 표시)
    - chat-writer.png    (확인: 세바스찬·시엘·OOC·입력창)
  이상: 없음 | {관찰한 문제}
  ```
- 이 폴더는 `.gitignore` 대상이다. 증거로 남길 캡처만 `doc/300_검증/`의 리포트에 상대 경로로 인용한다.
