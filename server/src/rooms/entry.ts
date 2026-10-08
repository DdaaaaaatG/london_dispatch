/**
 * [목적] 방 입장 판정: enter 7단계(R-LOCK-004·005·008)와 관문 assertEntry(R-LOCK-005·006). 설계 rooms.md §12.4
 * [공개 API] enterRoom(deps, roomId, input), assertRoomEntry(deps, target, access) — service.ts 가 enter·assertEntry 로 노출
 * [비동기] D1 조회 1회, 계수는 deps.hitEnterLimit(auth, D1 UPSERT), 해시·HMAC 은 필요할 때만(Web Crypto)
 * [에러] AppError NOT_FOUND · ROOM_LOCKED · ROOM_PASSWORD_WRONG, RATE_LIMITED(deps.hitEnterLimit 가 던짐)
 * [설정] 없음(deps 로 주입). 비밀번호·해시·증명은 로그에 싣지 않는다
 * [테스트] server/test/rooms-lock.test.ts (SRV-T-371~380·385~387)
 */
import type { EnterRoomResponse } from '@shared/types'
import { AppError } from '../app-error'
import { hasEntryKeyShape, issueEntryKey, verifyEntryKey } from './entry-key'
import { parsePasswordHash, verifyPassword } from './password'
import type { EntryAccess, EntryTarget, RoomsDeps } from './service'

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'

const issueFor = async (
  deps: RoomsDeps,
  roomId: string,
  passHash: string,
): Promise<EnterRoomResponse> => ({
  entryKey: await issueEntryKey(await deps.entrySecret(), roomId, passHash),
})

/** 02 §4.2 ①~⑦. 계수(⑤)는 해시(⑥) 앞. 주인·password 필드 없음·안 잠긴 방은 세지 않는다 */
export const enterRoom = async (
  deps: RoomsDeps,
  roomId: string,
  input: { password?: string | undefined; isOwner: boolean },
): Promise<EnterRoomResponse> => {
  const state = await deps.db.rooms.getEntryState(roomId)
  if (state === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
  const { passHash } = state
  if (passHash === null) return { entryKey: null }
  if (input.isOwner) return issueFor(deps, roomId, passHash)
  const { password } = input
  if (password === undefined) throw new AppError('ROOM_LOCKED')
  await deps.hitEnterLimit(roomId)
  if (!(await verifyPassword(password, passHash))) {
    if (parsePasswordHash(passHash) === null)
      deps.logger.error('room_pass_hash_invalid', { roomId })
    else deps.logger.info('room_enter_failed', { roomId })
    throw new AppError('ROOM_PASSWORD_WRONG')
  }
  return issueFor(deps, roomId, passHash)
}

/** 접근 판정 한 곳. 없는 대상·안 잠김·주인·맞는 증명은 통과, 그 밖은 ROOM_LOCKED. K 는 증명 형식이 맞을 때만 파생 */
export const assertRoomEntry = async (
  deps: RoomsDeps,
  target: EntryTarget,
  access: EntryAccess,
): Promise<void> => {
  const state =
    target.kind === 'room'
      ? await deps.db.rooms.getEntryState(target.roomId)
      : await deps.db.rooms.getEntryStateByMessage(target.messageId)
  if (state === null || state.passHash === null || access.isOwner) return
  if (
    hasEntryKeyShape(access.entryKey) &&
    (await verifyEntryKey(await deps.entrySecret(), state.roomId, state.passHash, access.entryKey))
  ) {
    return
  }
  throw new AppError('ROOM_LOCKED')
}
