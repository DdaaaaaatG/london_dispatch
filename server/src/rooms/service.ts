/**
 * [목적] 방 목록·생성·이름 변경·삭제 서비스(R-ROOM-001~004)와 S6 비밀번호 잠금(R-LOCK-001·002·004~006). 정렬은 SQL, 제목 판정은 normalizeTitle, 입장 판정은 entry.ts. 설계 rooms.md §2·§4·§12
 * [공개 API] createRoomsService({ db, now, logger, entrySecret, hitEnterLimit }) -> RoomsService { listRooms, createRoom, renameRoom, deleteRoom, enter(S6), setPassword(S6), clearPassword(S6), assertEntry(S6) }, 타입 RoomsDeps·RoomsService·RoomTitleInput·EntryTarget·EntryAccess
 * [비동기] db 호출 1회씩 await. 삭제는 db 가 batch(memory → messages → rooms)로 원자 처리. 비밀번호 해시는 요청당 최대 1회(PBKDF2)
 * [에러] VALIDATION_ERROR(제목·비밀번호, DB 접근 전), NOT_FOUND(없는 방), ROOM_LOCKED·ROOM_PASSWORD_WRONG(S6), RATE_LIMITED(S6, deps.hitEnterLimit). D1 장애는 전파
 * [설정] 없음. now 는 컨테이너가 주입하는 시계, entrySecret·hitEnterLimit 도 컨테이너가 값(함수)으로 주입
 * [테스트] server/test/rooms.test.ts (SRV-T-040~043·130~135), server/test/rooms-lock.test.ts (SRV-T-368~389)
 */
import type {
  CreateRoomBody,
  CreateRoomResponse,
  EnterRoomResponse,
  RoomSummary,
  SetRoomPasswordResponse,
} from '@shared/types'
import { AppError } from '../app-error'
import type { Db } from '../db'
import type { Logger } from '../logger'
import { assertRoomEntry, enterRoom } from './entry'
import { issueEntryKey } from './entry-key'
import { checkPasswordRule, hashPassword } from './password'
import { normalizeTitle } from './title'

export type RoomTitleInput = { title: string }

/** 관문 대상: 방 id 또는 메시지 id(메시지의 방을 JOIN 으로 찾는다) */
export type EntryTarget = { kind: 'room'; roomId: string } | { kind: 'message'; messageId: number }
/** 관문이 읽은 요청 정보: X-Room-Key 값(없으면 null)과 주인 여부 */
export type EntryAccess = { entryKey: string | null; isOwner: boolean }

export type RoomsService = {
  /** 전 방을 updatedAt 내림차순으로. 방이 없으면 빈 배열. 각 행에 locked */
  listRooms: () => Promise<RoomSummary[]>
  /** 방을 만든다. 제목 → 비밀번호 순 검사, INSERT 1문장. 비밀번호가 있으면 locked·entryKey */
  createRoom: (input: CreateRoomBody) => Promise<CreateRoomResponse>
  /** 제목만 바꾼다. updatedAt 은 그대로 */
  renameRoom: (id: string, input: RoomTitleInput) => Promise<RoomSummary>
  /** memory·messages·rooms 를 한 batch 로 실삭제 */
  deleteRoom: (id: string) => Promise<void>
  /** S6. 입장 증명 발급(02 §4.2 7단계). 안 잠긴 방은 entryKey null */
  enter: (
    roomId: string,
    input: { password?: string | undefined; isOwner: boolean },
  ) => Promise<EnterRoomResponse>
  /** S6. 비밀번호 걸기·바꾸기(updated_at 불변). by.mbId 는 로그용 */
  setPassword: (
    roomId: string,
    password: string,
    by: { mbId: string },
  ) => Promise<SetRoomPasswordResponse>
  /** S6. 비밀번호 풀기(멱등, updated_at 불변). by.mbId 는 로그용 */
  clearPassword: (roomId: string, by: { mbId: string }) => Promise<RoomSummary>
  /** S6. 관문 판정 한 곳. 불통과는 AppError ROOM_LOCKED. 없는 방·메시지는 통과(뒤에서 404) */
  assertEntry: (target: EntryTarget, access: EntryAccess) => Promise<void>
}

export type RoomsDeps = {
  db: Db
  now: () => number
  logger: Logger
  /** 컨테이너가 요청 컨테이너 수명 동안 1회 파생해 메모한 키. 필요할 때만 부른다 */
  entrySecret: () => Promise<CryptoKey>
  /** = services.auth.hitEnterLimit. 한도 초과면 AppError RATE_LIMITED(retryAfterSec)를 던진다 */
  hitEnterLimit: (roomId: string) => Promise<void>
}

const ROOM_NOT_FOUND_MESSAGE = '방을 찾을 수 없습니다.'

/** rooms 서비스를 만든다 */
export const createRoomsService = (deps: RoomsDeps): RoomsService => {
  const { db, now, logger } = deps
  return {
    listRooms: () => db.rooms.listSummaries(),
    createRoom: async input => {
      const title = normalizeTitle(input.title)
      const password = input.password === undefined ? null : checkPasswordRule(input.password)
      const passHash = password === null ? null : await hashPassword(password)
      const id = crypto.randomUUID()
      const nowMs = now()
      await db.rooms.insert({ id, title, nowMs, passHash })
      const entryKey =
        passHash === null ? null : await issueEntryKey(await deps.entrySecret(), id, passHash)
      return {
        id,
        title,
        createdAt: nowMs,
        updatedAt: nowMs,
        messageCount: 0,
        locked: passHash !== null,
        entryKey,
      }
    },
    renameRoom: async (id, input) => {
      const title = normalizeTitle(input.title)
      const summary = await db.rooms.updateTitle(id, title)
      if (summary === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
      return summary
    },
    deleteRoom: async id => {
      const deleted = await db.rooms.deleteCascade(id)
      if (!deleted) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
    },
    enter: (roomId, input) => enterRoom(deps, roomId, input),
    setPassword: async (roomId, password, by) => {
      const passHash = await hashPassword(checkPasswordRule(password))
      const result = await db.rooms.setPassHash(roomId, passHash)
      if (result === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
      const entryKey = await issueEntryKey(await deps.entrySecret(), roomId, passHash)
      logger.info('room_password_set', { roomId, mbId: by.mbId, wasLocked: result.wasLocked })
      return { room: result.room, entryKey }
    },
    clearPassword: async (roomId, by) => {
      const result = await db.rooms.setPassHash(roomId, null)
      if (result === null) throw new AppError('NOT_FOUND', ROOM_NOT_FOUND_MESSAGE)
      logger.info('room_password_cleared', { roomId, mbId: by.mbId, wasLocked: result.wasLocked })
      return result.room
    },
    assertEntry: (target, access) => assertRoomEntry(deps, target, access),
  }
}
