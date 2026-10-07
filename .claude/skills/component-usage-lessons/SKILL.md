---
name: component-usage-lessons
description: 공용 컴포넌트(ui/src/components/ui·hooks) 사용 시 알려진 오용 → 올바른 사용 카탈로그(오용 사례 전용). ui-debug·ui-fixer가 디버그 중 발견한 컴포넌트 오용을 여기에 기록하고, ui-implementer·ui-component-implementer는 구현 전 이 카탈로그를 참조해 같은 실수를 반복하지 않는다. 컴포넌트 자체 결함은 ⏳ 코어 결함 후보로 남긴다. 화면/컴포넌트 구현 시, 그리고 컴포넌트 관련 버그를 고칠 때 참조한다.
---

# 공용 컴포넌트 오용 카탈로그 (Known Misuse → Correct Usage)

`ui/src/components`(`ui`·`hooks`) 공용 컴포넌트의 **실제 발생 오용 사례 → 올바른 사용법** 단일 카탈로그. 같은 실수를 반복하지 않기 위한 문서.

> **공용 컴포넌트를 고칠 때의 작업장**
> 오용이 아니라 **컴포넌트 자체의 결함·기능 추가**라면, 발견한 화면(rooms/chat)이 아니라
> **그 컴포넌트 폴더(`ui/src/components/ui/{Name}/`)에서 고치고 `{Name}.test.tsx`·`Demo.tsx`로 검증**한다.
> 화면 시나리오에는 공용 컴포넌트 기능 TC를 만들지 않는다 — 같은 것을 두 화면에서 반복 검증하면
> 컴포넌트를 한 번 고칠 때마다 두 화면이 함께 흔들려 진짜 결함이 가려진다.

## 역할 분담 (쓰기 / 읽기)

| 주체 | 동작 |
|---|---|
| **쓰기 — ui-debug · ui-fixer** | 버그 원인이 공용 컴포넌트 **오용**이면, 고친 뒤 해당 컴포넌트 항목에 1건 append(같은 오용이 이미 있으면 **출처 한 줄만** 추가). |
| **읽기 — ui-implementer · ui-component-implementer** | 구현 전, **쓰려는 공용 컴포넌트명으로 이 카탈로그를 grep**해 알려진 오용을 피하고 ✅ 올바른 사용을 따른다. |
| **쓰기(발견 기록) — ui-implementer** | 구현·테스트 중 컴포넌트 **자체 결함**(오용 아님)을 확인하고 화면 로컬로 우회했으면 `### {컴포넌트} — ⏳ 코어 결함 후보(미수정)` 1건 append. 이미 있으면 출처만. ui-tester는 Write가 제한되므로 보고에 `[컴포넌트 결함 의심]`을 붙이고 매니저가 기록을 지시한다. |
| **정리 — ui-postprocessor (옵트인)** | 카탈로그가 커지면 중복 병합·해결된 ⏳ 항목 이관. |

## 경계 (중복 금지)

- **오용 사례 전용.** 정상 사용법·Props 계약은 여기서 정의하지 않는다 — 소유: `component-catalog`(import·용도·핵심 props·패턴), 각 컴포넌트의 `COMPONENT.md`·`Demo.tsx`. 여기에는 "하지 말 것 → 대신 이렇게"만 적는다.
- 컴포넌트명은 **`### {컴포넌트명}` 헤더**로 두어 grep 조회가 되게 한다.

## 기록 형식

```
### {컴포넌트명}
- ❌ 오용: {잘못된 사용} — {증상/결과} (출처: {screen} 디버그 yyyy-mm-dd · CR-…)
  - ✅ 올바름: {올바른 import / 필수 prop / 사용 패턴}
```

- 같은 컴포넌트·같은 오용이 이미 있으면 새 항목을 만들지 말고 기존 항목의 출처에 `, {screen} yyyy-mm-dd`만 덧붙인다.
- 한 줄로 의미가 닫히게 쓴다(grep으로 읽힐 수 있게).

## ⏳ 코어 결함 후보 형식

```
### {컴포넌트명} — ⏳ 코어 결함 후보(미수정)
- 증상: {무엇이 어떻게 틀리는가} (출처: {screen} yyyy-mm-dd · CR-…)
- 우회: {화면 로컬에서 어떻게 피했는가}
- 재현: `{Name}.test.tsx`에 TC 있음/없음 · Demo 케이스 있음/없음
```
- 수정은 컴포넌트 폴더에서 TDD로(ui-component-implementer 또는 승인받은 ui-fixer). 수정 완료 시 이 항목을 지우고 `component-catalog`의 테스트 파일 줄을 갱신한다.

---

## 카탈로그

> 현재 등록 항목: **없음** (프로젝트 초기 상태). 첫 오용이 발견되면 위 형식으로 append한다.

## ⏳ 코어 결함 후보

### Button — ⏳ 코어 결함 후보(미수정)
- 증상: `Button`에 `aria-describedby`를 전달할 prop이 없다(props에 `ariaLabel`·`buttonRef`는 있으나 `ariaDescribedBy` 없음). 잠긴 버튼에 숨은 안내를 연결할 수단이 없다 (출처: chat 2026-10-07 · CR-002 S3d — 인라인 수정 저장 버튼 생성 중 잠금 안내)
- 우회: `ui/src/chat/components/InlineEditor.tsx` 지역 훅 `useDescribedBy(buttonRef, id | null)`가 `useLayoutEffect`로 `aria-describedby`를 걸고 푼다. 정식 해결 = `Button`에 `ariaDescribedBy?: string` 추가 후 지역 훅 제거(후작업 ui-postprocessor, chat design.md §12 · design/auto.md §8 D-23)
- 재현: `Button.test.tsx`에 TC 없음 · Demo 케이스 없음

### Button — ⏳ 코어 결함 후보(미수정)
- 증상: `Button variant="ghost"`의 글자색이 `--color-fg`로 고정이다. 글자색 톤(보조색·danger)을 고르는 prop이 없어 "작은 텍스트 버튼"에 보조색·danger 글자를 줄 수 없다 (출처: chat 2026-10-07 · CR-003 S3e — 말풍선 버튼 줄 수정·재작성·삭제)
- 우회: `ui/src/chat/components/BubbleActions.module.css`가 자손 선택자(`.actions button` 보조색, `.danger button` danger — 삭제 버튼을 `<span class="danger">` 래퍼로 감쌈)로 지역 덧칠한다. 정식 해결 = `Button` ghost에 톤 prop(예: `tone?: 'muted' | 'danger'`) 추가 후 지역 덧칠 제거(후작업 ui-postprocessor, chat design/actions.md D-25)
- 재현: `Button.test.tsx`에 TC 없음 · Demo 케이스 없음

## 변경 이력

| 날짜 | 변경 | 주체 |
|---|---|---|
| 2026-10-05 | 초판(빈 카탈로그) | 자산 변환 |
| 2026-10-07 | 코어 결함 후보 1건: Button `aria-describedby` 전달 수단 없음(chat CR-002) | ui-designer(메인 세션 예외 허용) |
| 2026-10-07 | 코어 결함 후보 1건 추가: Button ghost 글자색 톤 prop 없음(chat CR-003, 지역 덧칠로 우회) | ui-implementer |
