/**
 * Bubble 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-007 ~ 010)
 * 대상: ui/src/chat/components/Bubble.tsx (chat design/components.md §2.2 v1.6, F-CH-15)
 * - CR-001(R-CHAT-002 개정 🔒): 세바스찬 왼쪽 · 시엘 오른쪽 · 유저 가운데 말풍선 · OOC 가운데 한 줄.
 * - CSS 모듈은 classNameStrategy='non-scoped' → styles.x 의 클래스명은 'x'.
 *   루트 클래스(확정, v1.6): 세바스찬 `character sebastian` · 시엘 `character ciel` · 유저 `user` · OOC `ooc`.
 *   배치는 캐릭터별 키(sebastian = 왼쪽, ciel = 오른쪽)와 user·ooc 키로 단언한다. 실제 정렬·배경은 수동 MC-CH-02.
 * - Bubble 은 표시 전용 → api 를 부르지 않는다. 래퍼를 모킹해 미호출을 단언한다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { Message } from '@shared/types'
import { listMessages } from '@/api/messages'
import { Bubble, bubbleVariantOf } from '@/chat/components/Bubble'

vi.mock('@/api/messages', () => ({ listMessages: vi.fn() }))

const at = (hour: number, minute: number): number => new Date(2026, 9, 5, hour, minute).getTime()
const base: Message = {
  id: 1,
  roomId: 'r1',
  speaker: 'ciel',
  kind: 'line',
  text: '세바스찬, 홍차.',
  authorName: null,
  createdAt: at(16, 40),
}
const make = (over: Partial<Message>): Message => ({ ...base, ...over })
const PLACEMENT_KEYS = ['character', 'sebastian', 'ciel', 'user', 'ooc'] as const
/** 루트 요소가 가진 배치 클래스 키(설계 v1.6 표의 5개 중) */
const placementOf = (container: HTMLElement): string[] => {
  const root = container.firstElementChild as HTMLElement
  return PLACEMENT_KEYS.filter(k => root.classList.contains(k))
}
const follows = (a: Node, b: Node): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  vi.mocked(listMessages).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('Bubble 캐릭터 — 세바스찬 왼쪽 · 시엘 오른쪽 (R-CHAT-002 · R-LLM-002 · CR-001)', () => {
  it('TC-CH-007: 세바스찬 — character + sebastian(왼쪽), 아바타 sebastian.png alt="", 짧은 이름, HH:mm, DOM 순서', () => {
    const { container } = render(
      <Bubble message={make({ speaker: 'sebastian', text: '예, 도련님.', createdAt: at(9, 5) })} />,
    )

    expect(placementOf(container)).toEqual(['character', 'sebastian'])
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/embed/img/sebastian.png')
    expect(img.getAttribute('alt')).toBe('')
    const name = screen.getByText('세바스찬')
    expect(screen.queryByText(/미카엘리스/)).toBeNull()
    const time = container.querySelector('time') as HTMLElement
    expect(time.textContent).toBe('09:05')
    expect(time.getAttribute('datetime')).toBe('2026-10-05T09:05')
    const body = screen.getByText('예, 도련님.')
    // 아바타 → 이름 → 시각 → 본문
    expect(follows(img, name)).toBe(true)
    expect(follows(name, time)).toBe(true)
    expect(follows(time, body)).toBe(true)
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-007: 시엘 — character + ciel(오른쪽), 아바타 ciel.png, 이름 "시엘", DOM 순서는 세바스찬과 같다', () => {
    const { container } = render(<Bubble message={base} />)

    expect(placementOf(container)).toEqual(['character', 'ciel'])
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/embed/img/ciel.png')
    expect(img.getAttribute('alt')).toBe('')
    const name = screen.getByText('시엘')
    expect(screen.queryByText(/시엘 팬텀하이브/)).toBeNull()
    const time = container.querySelector('time') as HTMLElement
    expect(time.textContent).toBe('16:40')
    expect(time.getAttribute('datetime')).toBe('2026-10-05T16:40')
    const body = screen.getByText('세바스찬, 홍차.')
    // 화면만 거울(row-reverse) — DOM·읽는 순서는 아바타 → 이름 → 시각 → 본문 그대로
    expect(follows(img, name)).toBe(true)
    expect(follows(name, time)).toBe(true)
    expect(follows(time, body)).toBe(true)
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })
})

describe('Bubble 유저 — 가운데 말풍선 (R-CHAT-002 · CR-001)', () => {
  it('TC-CH-008: user 클래스만(캐릭터 키 없음), 작성자명 → 시각 → 본문, 아바타 없음', () => {
    const { container } = render(
      <Bubble
        message={make({
          speaker: 'user',
          text: '나도 한 잔 부탁해요.',
          authorName: '미샤',
          createdAt: at(16, 42),
        })}
      />,
    )

    expect(placementOf(container)).toEqual(['user'])
    expect(container.querySelector('img')).toBeNull()
    const author = screen.getByText('미샤')
    const time = container.querySelector('time') as HTMLElement
    const body = screen.getByText('나도 한 잔 부탁해요.')
    expect(time.textContent).toBe('16:42')
    expect(follows(author, time)).toBe(true)
    expect(follows(time, body)).toBe(true)
    expect(container.textContent).not.toContain('[지시]')
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-008: authorName=null → "이름 없음"', () => {
    render(<Bubble message={make({ speaker: 'user', authorName: null, text: '익명 발화' })} />)
    expect(screen.getByText('이름 없음')).not.toBeNull()
  })

  it('TC-CH-008: 본문은 일반 텍스트(HTML 해석 안 함)', () => {
    const { container } = render(
      <Bubble message={make({ speaker: 'user', authorName: '미샤', text: '<b>굵게</b>' })} />,
    )
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>굵게</b>')).not.toBeNull()
  })
})

describe('Bubble OOC — 가운데 한 줄 (R-CHAT-002 · CR-001)', () => {
  it('TC-CH-009: ooc 클래스만, "[지시] 텍스트", 장식 — 2개 aria-hidden, 작성자명 없음, 시각 있음', () => {
    const { container } = render(
      <Bubble
        message={make({
          speaker: 'user',
          kind: 'ooc',
          text: '둘이 체스를 둔다',
          authorName: '미샤',
          createdAt: at(16, 43),
        })}
      />,
    )

    expect(placementOf(container)).toEqual(['ooc'])
    expect(container.textContent).toContain('[지시]')
    expect(container.textContent?.indexOf('[지시]')).toBeLessThan(
      container.textContent?.indexOf('둘이 체스를 둔다') ?? -1,
    )
    const decor = Array.from(container.querySelectorAll('[aria-hidden="true"]')).filter(
      el => el.textContent === '—',
    )
    expect(decor).toHaveLength(2)
    expect(screen.queryByText('미샤')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('time')?.textContent).toBe('16:43')
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-009: 같은 작성자의 유저 발화와 OOC 는 둘 다 가운데지만 클래스·작성자명·접두·장식으로 구분된다', () => {
    const user = render(
      <Bubble message={make({ speaker: 'user', text: '같은 문장', authorName: '미샤' })} />,
    )
    const userRoot = user.container.firstElementChild as HTMLElement
    const userHasAuthor = user.container.textContent?.includes('미샤')
    const userHasPrefix = user.container.textContent?.includes('[지시]')
    const userDecor = user.container.querySelectorAll('[aria-hidden="true"]').length
    user.unmount()

    const ooc = render(
      <Bubble
        message={make({ speaker: 'user', kind: 'ooc', text: '같은 문장', authorName: '미샤' })}
      />,
    )
    const oocRoot = ooc.container.firstElementChild as HTMLElement

    expect(userRoot.classList.contains('user')).toBe(true)
    expect(userRoot.classList.contains('ooc')).toBe(false)
    expect(oocRoot.classList.contains('ooc')).toBe(true)
    expect(oocRoot.classList.contains('user')).toBe(false)
    expect(userHasAuthor).toBe(true)
    expect(ooc.container.textContent).not.toContain('미샤')
    expect(userHasPrefix).toBe(false)
    expect(ooc.container.textContent).toContain('[지시]')
    expect(userDecor).toBe(0)
    expect(ooc.container.querySelectorAll('[aria-hidden="true"]').length).toBe(2)
  })

  it('TC-CH-010: 캐릭터 speaker 여도 kind=ooc 면 OOC 로 그린다(캐릭터 키·아바타·캐릭터 이름 없음)', () => {
    const { container } = render(
      <Bubble message={make({ speaker: 'ciel', kind: 'ooc', text: '장면 전환' })} />,
    )
    expect(placementOf(container)).toEqual(['ooc'])
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('시엘')).toBeNull()
  })
})

describe('bubbleVariantOf (F-CH-15, v1.6)', () => {
  it.each([
    ['user', 'line', 'user'],
    ['user', 'ooc', 'ooc'],
    ['ciel', 'line', 'ciel'],
    ['sebastian', 'line', 'sebastian'],
    ['ciel', 'ooc', 'ooc'],
    ['sebastian', 'ooc', 'ooc'],
  ] as const)('TC-CH-010: speaker=%s · kind=%s → %s', (speaker, kind, expected) => {
    expect(bubbleVariantOf(make({ speaker, kind }))).toBe(expected)
  })
})
