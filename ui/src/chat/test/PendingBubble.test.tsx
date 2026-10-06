/**
 * chat S3 임시·실패 말풍선 부품 + speakErrorText 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-069 부품 · TC-CH-073 부품 · TC-CH-074 부품 · TC-CH-086 speakErrorText)
 * 대상: ui/src/chat/components/PendingBubble.tsx (design/components.md §2.12) · ui/src/chat/labels.ts speakErrorText(F-CH-37)
 * - 클래스는 ui/vite.config.ts classNameStrategy 'non-scoped' 라 키 이름 그대로 단언한다.
 *   Bubble.module.css 를 import 해 쓰므로 root·character·sebastian/ciel·avatar·content·head·name·body 가 붙는다(DC-01).
 *   배경색·시엘 머리 줄 거울 배치(computed style)는 jsdom 이 계산하지 않는다 → 수동 MC-CH-16(TC-CH-092).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { CharacterId } from '@shared/types'
import type { ApiError, ApiErrorCode } from '@/api'
import { PendingBubble, type PendingBubbleProps } from '@/chat/components/PendingBubble'
import { speakErrorText } from '@/chat/labels'
import type { PendingSpeak } from '@/state/chat'

const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const err = (code: ApiErrorCode, retryAfterSec?: number): ApiError =>
  retryAfterSec === undefined
    ? { code, message: SERVER_RAW }
    : { code, message: SERVER_RAW, retryAfterSec }
const generating = (character: CharacterId): PendingSpeak => ({
  character,
  status: 'generating',
  error: null,
})
const failed = (character: CharacterId, error: ApiError = err('LLM_FAILED')): PendingSpeak => ({
  character,
  status: 'failed',
  error,
})

const setup = (pending: PendingSpeak, over: Partial<PendingBubbleProps> = {}) => {
  const props: PendingBubbleProps = {
    pending,
    isRetryDisabled: false,
    onRetry: vi.fn<(c: CharacterId) => void>(),
    ...over,
  }
  const view = render(
    <ol>
      <li>
        <PendingBubble {...props} />
      </li>
    </ol>,
  )
  const root = view.container.querySelector('li')?.firstElementChild as HTMLElement
  return { ...view, props, root }
}

afterEach(() => {
  cleanup()
})

describe('PendingBubble 생성 중 (R-CHAT-005 · R-CHAT-002 · R-CHAT-013)', () => {
  it.each([
    ['sebastian', '세바스찬', '/embed/img/sebastian.png', 'ciel'],
    ['ciel', '시엘', '/embed/img/ciel.png', 'sebastian'],
  ] as const)(
    'TC-CH-069: (부품) %s 생성 중 — pending·character·캐릭터 쪽 클래스, 아바타·짧은 이름, 시각 없음',
    (character, name, avatar, other) => {
      const { root } = setup(generating(character))
      expect(root.classList.contains('root')).toBe(true)
      expect(root.classList.contains('pending')).toBe(true)
      expect(root.classList.contains('character')).toBe(true)
      expect(root.classList.contains(character)).toBe(true)
      expect(root.classList.contains(other)).toBe(false)
      expect(root.classList.contains('failed')).toBe(false)
      const img = root.querySelector('img') as HTMLImageElement
      expect(img.getAttribute('src')).toBe(avatar)
      expect(img.getAttribute('alt')).toBe('')
      expect(root.querySelector('.name')?.textContent).toBe(name)
      expect(root.querySelector('time')).toBeNull()
    },
  )

  it('TC-CH-069: (부품) 모양 클래스(DC-01) — 자식에 avatar·content·head·name·body', () => {
    const { root } = setup(generating('sebastian'))
    for (const key of ['avatar', 'content', 'head', 'name', 'body'])
      expect(root.querySelector(`.${key}`)).not.toBeNull()
    expect(root.querySelector('.content .head .name')).not.toBeNull()
    expect(root.querySelector('.content .body')).not.toBeNull()
  })

  it('TC-CH-069: (부품) role=status 에 "세바스찬 대사를 만드는 중", "…" 는 aria-hidden, alert·버튼 없음', () => {
    const { root } = setup(generating('sebastian'))
    const status = screen.getByRole('status')
    expect(status).toBe(root)
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('세바스찬 대사를 만드는 중')
    const dots = within(root).getByText('…')
    expect(dots.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('TC-CH-069: (부품) 메뉴 대상 아님 — tabIndex·aria-haspopup 없음, contextmenu 기본 동작 유지', () => {
    const { root, container } = setup(generating('ciel'))
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
    expect(fireEvent.contextMenu(root)).toBe(true)
  })
})

describe('PendingBubble 실패 (R-CHAT-005 · R-CHAT-011)', () => {
  it('TC-CH-073: (부품) 실패 — pending+failed, role 없음, role=alert 문구, 「재시도」(이름 "세바스찬 대사 재시도") → onRetry("sebastian")', async () => {
    const { root, props } = setup(failed('sebastian'))
    expect(root.classList.contains('pending')).toBe(true)
    expect(root.classList.contains('failed')).toBe(true)
    expect(root.classList.contains('sebastian')).toBe(true)
    expect(root.getAttribute('role')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('생성에 실패했습니다.')
    expect(within(alert).getByText('!').getAttribute('aria-hidden')).toBe('true')
    const retry = screen.getByRole('button', { name: '세바스찬 대사 재시도' }) as HTMLButtonElement
    expect(retry.textContent).toBe('재시도')
    expect(retry.disabled).toBe(false)
    expect(screen.queryByText(SERVER_RAW)).toBeNull()

    await userEvent.setup().click(retry)
    expect(vi.mocked(props.onRetry).mock.calls).toEqual([['sebastian']])
  })

  it('TC-CH-074: (부품) CONFIG_INVALID 도 관리자 안내 문구 + 「재시도」 버튼이 있다(사용자 결정 2026-10-06)', () => {
    setup(failed('ciel', err('CONFIG_INVALID')))
    expect(screen.getByRole('alert').textContent).toContain(ERROR_MESSAGES.CONFIG_INVALID)
    expect(screen.getByRole('button', { name: '시엘 대사 재시도' })).not.toBeNull()
  })

  it('TC-CH-090: (부품) isRetryDisabled → 「재시도」 disabled, 클릭해도 onRetry 0회', async () => {
    const { props } = setup(failed('ciel'), { isRetryDisabled: true })
    const retry = screen.getByRole('button', { name: '시엘 대사 재시도' }) as HTMLButtonElement
    expect(retry.disabled).toBe(true)
    await userEvent.setup().click(retry)
    expect(props.onRetry).not.toHaveBeenCalled()
  })
})

describe('speakErrorText (R-CHAT-011 · R-CHAT-005, design/generate.md §3)', () => {
  it.each([
    [
      'SPEAK_IN_PROGRESS',
      undefined,
      '이 방에서 이미 대사를 만들고 있습니다. 잠시 후 다시 시도해 주세요.',
    ],
    ['LLM_FAILED', undefined, '생성에 실패했습니다.'],
    ['LLM_EMPTY', undefined, '생성에 실패했습니다.'],
    ['CONFIG_INVALID', undefined, '서버 설정이 올바르지 않습니다. 관리자에게 알려 주세요.'],
    ['RATE_LIMITED', 40, '요청이 너무 많습니다. 40초 후 다시 시도해 주세요.'],
    ['RATE_LIMITED', undefined, ERROR_MESSAGES.RATE_LIMITED],
    ['NETWORK', undefined, '서버에 연결할 수 없습니다.'],
    ['INTERNAL', undefined, ERROR_MESSAGES.INTERNAL],
    ['VALIDATION_ERROR', undefined, ERROR_MESSAGES.VALIDATION_ERROR],
    // S3b TC-CH-096: code → ERROR_MESSAGES(서버 message 미사용), 초 문구 아님
    ['LLM_BUDGET_EXCEEDED', undefined, '이번 달 AI 사용 한도에 닿았습니다. 다음 달에 다시 시도해 주세요.'],
  ] as const)('TC-CH-086: speakErrorText(%s, retryAfterSec=%s) = %s', (code, sec, text) => {
    const out = speakErrorText(err(code, sec))
    expect(out).toBe(text)
    expect(out).not.toContain(SERVER_RAW)
  })
})
