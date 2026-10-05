/**
 * [목적] Cloudflare Worker 진입점. 조립만 하고 로직은 없다 (R-ENV-001). 설계 index.md §2.1
 * [공개 API] export default { fetch }
 * [비동기] fetch 는 Hono app.fetch 위임
 * [에러] app.ts onError 가 단일 처리
 * [설정] 없음(바인딩 파싱은 app.ts 부트스트랩이 env.ts parseEnv 로 한다)
 * [테스트] server/test/app.test.ts 는 createApp 기준. routes 통합은 contract 몫
 */
import { createApp } from './app'
import type { Env } from './env'
import { apiRoutes } from './routes'

const app = createApp({ routes: apiRoutes })

export default { fetch: app.fetch } satisfies ExportedHandler<Env>
