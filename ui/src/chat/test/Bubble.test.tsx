/**
 * Bubble 스펙 초안 — 단일 소스 ui/src/chat/test/scenarios.md (TC-CH-007 ~ 010)
 * 대상: ui/src/chat/components/Bubble.tsx (chat design/components.md §2.2, F-CH-15)
 * - CSS 모듈은 ui/vite.config.ts test.css.modules.classNameStrategy='non-scoped' → styles.x 의 클래스명은 'x'.
 * - 변형 클래스 키는 BubbleVariant 값과 같은 'character'·'user'·'ooc', 캐릭터 색은 'ciel'·'sebastian'(설계 명시)이라고 가정한다.
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
const hasClass = (root: HTMLElement, name: string): boolean =>
  root.querySelector(`[class~="${name}"]`) !== null
const follows = (a: Node, b: Node): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

beforeEach(() => {
  vi.mocked(listMessages).mockReset()
})

afterEach(() => {
  cleanup()
})

describe('Bubble 캐릭터 (R-CHAT-002 · R-LLM-002)', () => {
  it('TC-CH-007: 시엘 — 왼쪽(character)·ciel 클래스, 아바타 /embed/img/ciel.png alt="", 짧은 이름, HH:mm, DOM 순서', () => {
    const { container } = render(<Bubble message={base} />)

    expect(hasClass(container, 'character')).toBe(true)
    expect(hasClass(container, 'ciel')).toBe(true)
    expect(hasClass(container, 'user')).toBe(false)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('src')).toBe('/embed/img/ciel.png')
    expect(img.getAttribute('alt')).toBe('')
    const name = screen.getByText('시엘')
    expect(screen.queryByText(/시엘 팬텀하이브/)).toBeNull()
    const time = container.querySelector('time') as HTMLElement
    expect(time.textContent).toBe('16:40')
    expect(time.getAttribute('datetime')).toBe('2026-10-05T16:40')
    const body = screen.getByText('세바스찬, 홍차.')
    // 아바타 → 이름 → 시각 → 본문
    expect(follows(img, name)).toBe(true)
    expect(follows(name, time)).toBe(true)
    expect(follows(time, body)).toBe(true)
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })

  it('TC-CH-007: 세바스찬 — sebastian 클래스, 아바타 /embed/img/sebastian.png, 이름 "세바스찬"', () => {
    const { container } = render(
      <Bubble message={make({ speaker: 'sebastian', text: '예, 도련님.', createdAt: at(9, 5) })} />,
    )

    expect(hasClass(container, 'character')).toBe(true)
    expect(hasClass(container, 'sebastian')).toBe(true)
    expect(hasClass(container, 'ciel')).toBe(false)
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/embed/img/sebastian.png')
    expect(screen.getByText('세바스찬')).not.toBeNull()
    expect(screen.queryByText(/미카엘리스/)).toBeNull()
    expect(container.querySelector('time')?.textContent).toBe('09:05')
    expect(vi.mocked(listMessages)).not.toHaveBeenCalled()
  })
})

describe('Bubble 유저 (R-CHAT-002)', () => {
  it('TC-CH-008: 오른쪽(user) 클래스, 작성자명 → 시각 → 본문, 아바타 없음', () => {
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

    expect(hasClass(container, 'user')).toBe(true)
    expect(hasClass(container, 'character')).toBe(false)
    expect(container.querySelector('img')).toBeNull()
    const author = screen.getByText('미샤')
    const time = container.querySelector('time') as HTMLElement
    const body = screen.getByText('나도 한 잔 부탁해요.')
    expect(time.textContent).toBe('16:42')
    expect(follows(author, time)).toBe(true)
    expect(follows(time, body)).toBe(true)
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

describe('Bubble OOC (R-CHAT-002)', () => {
  it('TC-CH-009: 중앙(ooc) 클래스, "[지시] 텍스트", 장식 — 2개 aria-hidden, 작성자명 없음, 시각 있음', () => {
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

    expect(hasClass(container, 'ooc')).toBe(true)
    expect(hasClass(container, 'user')).toBe(false)
    expect(container.textContent).toContain('[지시]')
    expect(container.textContent).toContain('둘이 체스를 둔다')
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

  it('TC-CH-010: 캐릭터 speaker 여도 kind=ooc 면 OOC 로 그린다(아바타·캐릭터 이름 없음)', () => {
    const { container } = render(
      <Bubble message={make({ speaker: 'ciel', kind: 'ooc', text: '장면 전환' })} />,
    )
    expect(hasClass(container, 'ooc')).toBe(true)
    expect(hasClass(container, 'character')).toBe(false)
    expect(container.querySelector('img')).toBeNull()
    expect(screen.queryByText('시엘')).toBeNull()
  })
})

describe('bubbleVariantOf (F-CH-15)', () => {
  it.each([
    ['user', 'line', 'user'],
    ['user', 'ooc', 'ooc'],
    ['ciel', 'line', 'character'],
    ['sebastian', 'line', 'character'],
    ['ciel', 'ooc', 'ooc'],
    ['sebastian', 'ooc', 'ooc'],
  ] as const)('TC-CH-010: speaker=%s · kind=%s → %s', (speaker, kind, expected) => {
    expect(bubbleVariantOf(make({ speaker, kind }))).toBe(expected)
  })
})
