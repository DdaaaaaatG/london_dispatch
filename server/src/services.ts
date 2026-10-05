/**
 * [목적] 서비스 컨테이너와 Hono 타입(AppEnv). 라우트(contract)는 c.get('services') 로 접근 (R-ENV-001 값 주입, R-API-005). 설계 index.md §2.3
 * [공개 API] createServices(deps) -> Services, APP_VERSION, 타입 AppEnv·Services·ServiceDeps·HealthStatus
 * [비동기] 없음(팩토리 클로저 생성뿐). getHealth 는 DB·외부 호출 없는 동기 함수
 * [에러] 없음
 * [설정] 없음(S2부터 Config 필드를 각 팩토리에 골라 넘긴다)
 * [테스트] server/test/app.test.ts (SRV-T-087)
 */
import type { HealthResponse } from '@shared/types'
import pkg from '../package.json'
import type { Db } from './db'
import type { Env } from './env'
import type { Logger } from './logger'
import { createMessagesService, type MessagesService } from './messages'
import { createRoomsService, type RoomsService } from './rooms'

/** 계약 타입 HealthResponse 와 같다 */
export type HealthStatus = HealthResponse

export type ServiceDeps = {
  db: Db
  logger: Logger
  now: () => number
}

export type Services = {
  rooms: RoomsService
  messages: MessagesService
  /** DB·외부 호출 없이 상태를 돌려준다 (R-API-005) */
  getHealth: () => HealthStatus
}

/** 라우트(contract)가 쓰는 Hono 타입 */
export type AppEnv = {
  Bindings: Env
  Variables: {
    services: Services
    cspFrameAncestors: string
  }
}

/** server/package.json 의 version */
export const APP_VERSION: string = pkg.version

/** 서비스 컨테이너를 만든다. 요청마다 부트스트랩이 호출 */
export const createServices = (deps: ServiceDeps): Services => ({
  rooms: createRoomsService({ db: deps.db }),
  messages: createMessagesService({ db: deps.db }),
  getHealth: () => ({ ok: true, version: APP_VERSION }),
})
