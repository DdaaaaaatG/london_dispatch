/**
 * [목적] 잠긴 방 관문 미들웨어와 주인 요청 판정(R-LOCK-005·006). 판정은 하지 않고 services.rooms.assertEntry 에 넘긴다(판정 한 곳). 설계 auth.md §14.3
 * [공개 API] isOwnerRequest(c), requireRoomEntry(kind)
 * [비동기] requireRoomEntry → services.rooms.assertEntry(D1 PK 조회 1회, 증명이 있으면 HMAC 1회). isOwnerRequest 는 동기
 * [에러] ROOM_LOCKED(403, rooms 가 던짐) · INTERNAL(500, 배선 오류: :id 없음). 정수 아닌 메시지 id 는 통과(서비스가 404)
 * [설정] 없음. 증명은 헤더 ROOM_KEY_HEADER(shared) 하나에서만 읽는다(쿼리·본문·쿠키 안 봄). 헤더 값을 로그·에러에 쓰지 않는다
 * [테스트] server/test/auth-room-entry.test.ts (SRV-T-391·392)
 */
import { ROOM_KEY_HEADER } from '@shared/endpoints'
import type { Context, MiddlewareHandler } from 'hono'
import { AppError } from '../app-error'
import type { EntryTarget } from '../rooms'
import type { AppEnv } from '../services'

/** principal 이 있고 services.auth.isOwner(principal) 이면 true. 부수 효과·D1 없음 */
export const isOwnerRequest = (c: Context<AppEnv>): boolean => {
  const principal = c.get('principal')
  return principal !== undefined && c.get('services').auth.isOwner(principal)
}

/** validate('param') 뒤에 둔다. 경로 :id + 헤더 X-Room-Key(빈 문자열은 없음) 로 services.rooms.assertEntry → next() */
export const requireRoomEntry =
  (kind: 'room' | 'message'): MiddlewareHandler<AppEnv> =>
  async (c, next) => {
    const id = c.req.param('id')
    if (id === undefined) throw new AppError('INTERNAL')
    const target: EntryTarget =
      kind === 'room' ? { kind, roomId: id } : { kind, messageId: Number(id) }
    // api.md §2.8.3: 안전 정수가 아닌 메시지 id 는 관문 미판정으로 통과 — 뒤 서비스가 기존 404 NOT_FOUND 로 닫는다
    if (target.kind === 'message' && !Number.isSafeInteger(target.messageId)) {
      await next()
      return
    }
    const header = c.req.header(ROOM_KEY_HEADER)
    await c.get('services').rooms.assertEntry(target, {
      entryKey: header === undefined || header === '' ? null : header,
      isOwner: isOwnerRequest(c),
    })
    await next()
  }
