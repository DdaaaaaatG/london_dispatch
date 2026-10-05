/**
 * contract 라우트 묶음 — 단일 소스 doc/200_설계/contract/api.md §4 · §11
 * server/src/index.ts 가 createApp({ routes: apiRoutes }) 로 주입한다
 * /embed · onError · notFound · CSP 는 여기 두지 않는다 (server 진입점 소유)
 */
import { Hono } from 'hono'
import type { AppEnv } from '../services'
import { healthRoutes } from './health'
import { messagesRoutes } from './messages'
import { roomsRoutes } from './rooms'

export const apiRoutes = new Hono<AppEnv>()
apiRoutes.route('/', healthRoutes)
apiRoutes.route('/', roomsRoutes)
apiRoutes.route('/', messagesRoutes)
