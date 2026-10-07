// Node 네이티브 type stripping 은 확장자 없는 상대 import 를 못 푼다. 서버 소스(`../src/auth/token`)를
// 고치지 않고 그대로 재사용하려고, 상대 경로 해석 실패 시 `.ts` 를 붙여 다시 푸는 훅을 등록한다.
// 새 패키지 없음(node:module 내장). 사용: node --import ./scripts/register-ts-resolve.mjs <script.ts>
import { register } from 'node:module'

register('./resolve-ts-hook.mjs', import.meta.url)
