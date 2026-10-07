// register-ts-resolve.mjs 가 등록하는 resolve 훅. 상대 경로만 `.ts` 재시도한다.
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context)
  } catch (error) {
    const isRelative = specifier.startsWith('./') || specifier.startsWith('../')
    if (!isRelative || error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
    return nextResolve(`${specifier}.ts`, context)
  }
}
