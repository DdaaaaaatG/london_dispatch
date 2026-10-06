/**
 * chat S3 임시·실패 말풍선 부품 + speakErrorText 스펙 초안(TDD Red) — 단일 소스 ui/src/chat/test/scenarios.md
 * (TC-CH-069 부품 · TC-CH-073 부품 · TC-CH-074 부품 · TC-CH-086 speakErrorText · S3d TC-CH-099·102 부품(중립 'auto'))
 * 대상: ui/src/chat/components/PendingBubble.tsx (design/components.md §2.12 · S3d design/auto.md §2.1) · ui/src/chat/labels.ts speakErrorText(F-CH-37)
 * - 클래스는 ui/vite.config.ts classNameStrategy 'non-scoped' 라 키 이름 그대로 단언한다.
 *   캐릭터 변형은 Bubble.module.css 를 import 해 쓰므로 root·character·sebastian/ciel·avatar·content·head·name·body 가 붙는다(DC-01).
 *   중립 변형(S3d)은 루트 pending·neutral(+failed)만, Bubble 모듈의 root·character·sebastian·ciel·user 는 붙지 않는다.
 *   배경색·시엘 머리 줄 거울 배치·중립 높이(computed style)는 jsdom 이 계산하지 않는다 → 수동 MC-CH-16(TC-CH-092) · MC-CH-19(TC-CH-109).
 * - S3d: onRetry 인자 타입 CharacterId → SpeakTarget(@shared/types, contract 구현분 전제).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ERROR_MESSAGES } from '@shared/errors'
import type { SpeakTarget } from '@shared/types'
import type { ApiError, ApiErrorCode } from '@/api'
import { PendingBubble, type PendingBubbleProps } from '@/chat/components/PendingBubble'
import { speakErrorText } from '@/chat/labels'
import type { PendingSpeak } from '@/state/chat'

const SERVER_RAW = 'SERVER-RAW-MESSAGE'
const err = (code: ApiErrorCode, retryAfterSec?: number): ApiError =>
  retryAfterSec === undefined
    ? { code, message: SERVER_RAW }
    : { code, message: SERVER_RAW, retryAfterSec }
const generating = (character: SpeakTarget): PendingSpeak => ({
  character,
  status: 'generating',
  error: null,
})
const failed = (character: SpeakTarget, error: ApiError = err('LLM_FAILED')): PendingSpeak => ({
  character,
  status: 'failed',
  error,
})

const setup = (pending: PendingSpeak, over: Partial<PendingBubbleProps> = {}) => {
  const props: PendingBubbleProps = {
    pending,
    isRetryDisabled: false,
    onRetry: vi.fn<(target: SpeakTarget) => void>(),
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
      expect(root.classList.contains('neutral')).toBe(false)
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

describe('PendingBubble 중립(auto) 변형 — S3d (R-CHAT-014 · R-CHAT-011 · R-CHAT-013)', () => {
  /** 중립 루트에 붙으면 안 되는 화자·Bubble 모듈 클래스(auto.md §2.1 테스트 클래스 키) */
  const SPEAKER_KEYS = ['root', 'character', 'sebastian', 'ciel', 'user'] as const

  it('TC-CH-099: (부품) 중립 생성 중 — 루트 pending·neutral(화자 클래스 없음), img·이름·머리 줄·시각 없음, 본문 상자 body·bodyBox', () => {
    const { root } = setup(generating('auto'))
    expect(root.classList.contains('pending')).toBe(true)
    expect(root.classList.contains('neutral')).toBe(true)
    expect(root.classList.contains('failed')).toBe(false)
    for (const k of SPEAKER_KEYS) expect(root.classList.contains(k)).toBe(false)
    expect(root.querySelectorAll('img')).toHaveLength(0)
    expect(root.querySelector('.name')).toBeNull()
    expect(root.querySelector('.head')).toBeNull()
    expect(root.querySelector('time')).toBeNull()
    expect(root.querySelector('.body.bodyBox')).not.toBeNull()
  })

  it('TC-CH-099: (부품) 중립 생성 중 — 루트 role=status·aria-live=polite, 숨은 안내 "응답을 만드는 중", "…" aria-hidden, alert·버튼·메뉴 대상 없음', () => {
    const { root, container } = setup(generating('auto'))
    const status = screen.getByRole('status')
    expect(status).toBe(root)
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.textContent).toContain('응답을 만드는 중')
    expect(status.textContent).not.toContain('대사를 만드는 중')
    expect(within(root).getByText('…').getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelector('[tabindex]')).toBeNull()
    expect(container.querySelector('[aria-haspopup]')).toBeNull()
    expect(fireEvent.contextMenu(root)).toBe(true)
  })

  it.each([
    ['LLM_FAILED', undefined],
    ['CONFIG_INVALID', undefined],
    ['RATE_LIMITED', 40],
  ] as const)(
    'TC-CH-102: (부품) 중립 실패 %s(retryAfterSec=%s) — pending·neutral·failed, role 없음, role=alert = speakErrorText, 「재시도」(이름 "응답 재시도") 항상 렌더 → onRetry("auto")',
    async (code, sec) => {
      const error = err(code, sec)
      const { root, props } = setup(failed('auto', error))
      for (const k of ['pending', 'neutral', 'failed']) expect(root.classList.contains(k)).toBe(true)
      for (const k of SPEAKER_KEYS) expect(root.classList.contains(k)).toBe(false)
      expect(root.querySelectorAll('img')).toHaveLength(0)
      expect(root.getAttribute('role')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
      const alert = screen.getByRole('alert')
      expect(alert.textContent).toContain(speakErrorText(error))
      expect(within(alert).getByText('!').getAttribute('aria-hidden')).toBe('true')
      expect(screen.queryByText(SERVER_RAW)).toBeNull()
      const retry = screen.getByRole('button', { name: '응답 재시도' }) as HTMLButtonElement
      expect(retry.textContent).toBe('재시도')
      expect(retry.disabled).toBe(false)
      expect(root.querySelector('.retryRow')?.contains(retry)).toBe(true)
      expect(screen.queryByRole('button', { name: /대사 재시도/ })).toBeNull()

      await userEvent.setup().click(retry)
      expect(vi.mocked(props.onRetry).mock.calls).toEqual([['auto']])
    },
  )

  it('TC-CH-102: (부품) 중립 실패 isRetryDisabled → 「응답 재시도」 disabled, 클릭해도 onRetry 0회', async () => {
    const { props } = setup(failed('auto'), { isRetryDisabled: true })
    const retry = screen.getByRole('button', { name: '응답 재시도' }) as HTMLButtonElement
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
