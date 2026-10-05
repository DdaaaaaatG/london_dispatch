/**
 * 클래스 조합 — 설계 rooms/design/components.md §1.5 · ui_design_concept §1
 * 거짓 값을 빼고 공백으로 잇는다.
 */
export const cx = (...names: ReadonlyArray<string | false | null | undefined>): string =>
  names.filter((name): name is string => typeof name === 'string' && name !== '').join(' ')
