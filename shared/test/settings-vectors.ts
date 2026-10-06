/**
 * 캐릭터 설정 경계값 벡터 — api.md §14.15 (API-T-106·107). server 스키마 테스트가 같은 파일을 import한다.
 * 기대 문구는 api.md §4.16 표를 글자 그대로 옮긴 리터럴이다(구현 상수에서 만들지 않는다).
 */
import type { CharacterSettings } from '../src/types'

export type SettingsVector = {
  name: string
  input: unknown
  expect: { ok: true } | { ok: false; path: string[]; message: string }
}

/** 모든 필드가 채워진 통과 값 */
export const validSettings = (): CharacterSettings => ({
  world: '19세기 말 런던.',
  characters: {
    sebastian: {
      sourceMaterial: '흑집사',
      age: '',
      gender: '남성',
      role: '집사',
      persona: '완벽한 집사.',
      personalityTags: '',
      appearance: '',
      relationships: '',
      speech: '정중한 존댓말.',
      sampleDialogue: ['분부대로.'],
      rules: [],
    },
    ciel: {
      sourceMaterial: '흑집사',
      age: '13',
      gender: '남성',
      role: '백작',
      persona: '오만한 소년 당주.',
      personalityTags: '',
      appearance: '',
      relationships: '',
      speech: '거침없는 반말.',
      sampleDialogue: [],
      rules: [],
    },
  },
})

type Loose = Record<string, unknown>
type CharMap = Record<string, Record<string, unknown>>

/** 통과 값을 복제해 고친다 */
const make = (fn: (s: Loose) => void): unknown => {
  const s = JSON.parse(JSON.stringify(validSettings())) as Loose
  fn(s)
  return s
}

const chars = (s: Loose): CharMap => s.characters as CharMap

const bad = (path: string[], message: string): SettingsVector['expect'] => ({
  ok: false,
  path,
  message,
})
const good: SettingsVector['expect'] = { ok: true }

const REQUIRED = [
  { key: 'persona', label: '성격·배경', topic: '은', max: 1500 },
  { key: 'speech', label: '말투', topic: '는', max: 800 },
] as const

const OPTIONAL = [
  { key: 'sourceMaterial', label: '원작·장르', topic: '는', max: 60 },
  { key: 'age', label: '나이', topic: '는', max: 40 },
  { key: 'gender', label: '성별', topic: '은', max: 20 },
  { key: 'role', label: '신분·직업', topic: '은', max: 80 },
  { key: 'personalityTags', label: '성격 태그', topic: '는', max: 200 },
  { key: 'appearance', label: '외형', topic: '은', max: 800 },
  { key: 'relationships', label: '관계 메모', topic: '는', max: 800 },
] as const

const LISTS = [
  { key: 'sampleDialogue', label: '샘플 대사', topic: '는', maxItems: 10, itemMax: 200 },
  { key: 'rules', label: '규칙·금기', topic: '는', maxItems: 20, itemMax: 200 },
] as const

const SCOPES = [
  { id: 'sebastian', name: '세바스찬' },
  { id: 'ciel', name: '시엘' },
] as const

const nums = (n: number, prefix: string): string[] =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`)

const accept: SettingsVector[] = [
  { name: '기본 통과 값', input: validSettings(), expect: good },
  { name: 'world 상한 2000자', input: make(s => { s.world = 'ㄱ'.repeat(2000) }), expect: good },
  { name: 'world 앞뒤 공백은 세지 않는다', input: make(s => { s.world = `  ${'ㄱ'.repeat(2000)}  ` }), expect: good },
  { name: 'world 이모지 2000개(코드 포인트 기준)', input: make(s => { s.world = '😀'.repeat(2000) }), expect: good },
  { name: 'persona 이모지 1500개', input: make(s => { chars(s).ciel!.persona = '😀'.repeat(1500) }), expect: good },
  { name: 'speech 이모지 800개', input: make(s => { chars(s).sebastian!.speech = '😀'.repeat(800) }), expect: good },
  { name: '선택 필드 빈 문자열', input: make(s => { chars(s).sebastian!.sourceMaterial = ''; chars(s).sebastian!.gender = '' }), expect: good },
  { name: '샘플 대사 10개', input: make(s => { chars(s).ciel!.sampleDialogue = nums(10, '대사') }), expect: good },
  { name: '규칙 20개', input: make(s => { chars(s).ciel!.rules = nums(20, '규칙') }), expect: good },
  { name: '빈 항목은 개수에 세지 않는다', input: make(s => { chars(s).ciel!.rules = [...nums(20, '규칙'), '', '   '] }), expect: good },
  { name: '목록 항목 200자', input: make(s => { chars(s).ciel!.rules = ['ㄱ'.repeat(200)] }), expect: good },
  { name: '목록 항목 앞뒤 공백은 세지 않는다', input: make(s => { chars(s).ciel!.rules = [`  ${'ㄱ'.repeat(200)}  `] }), expect: good },
]
for (const f of OPTIONAL) {
  accept.push({
    name: `${f.label} 상한 ${f.max}자`,
    input: make(s => { chars(s).ciel![f.key] = 'ㄱ'.repeat(f.max) }),
    expect: good,
  })
}

const reject: SettingsVector[] = [
  // 문구 표 13행
  { name: '행1 settings 가 객체 아님', input: 'x', expect: bad([], '공통 · 설정 형식이 올바르지 않습니다.') },
  { name: '행1 settings 없음(undefined)', input: undefined, expect: bad([], '공통 · 설정 형식이 올바르지 않습니다.') },
  { name: '행1 settings null', input: null, expect: bad([], '공통 · 설정 형식이 올바르지 않습니다.') },
  { name: '행1 settings 배열', input: [], expect: bad([], '공통 · 설정 형식이 올바르지 않습니다.') },
  { name: '행2 본체에 모르는 키', input: make(s => { s.extra = 1 }), expect: bad([], '공통 · 알 수 없는 항목이 있습니다.') },
  { name: '행3 world 없음', input: make(s => { delete s.world }), expect: bad(['world'], '공통 · 세계관 값의 형식이 올바르지 않습니다.') },
  { name: '행3 world 문자열 아님', input: make(s => { s.world = 5 }), expect: bad(['world'], '공통 · 세계관 값의 형식이 올바르지 않습니다.') },
  { name: '행4 world 빈 문자열', input: make(s => { s.world = '' }), expect: bad(['world'], '공통 · 세계관은 1~2000자여야 합니다.') },
  { name: '행4 world 공백뿐', input: make(s => { s.world = '  \n ' }), expect: bad(['world'], '공통 · 세계관은 1~2000자여야 합니다.') },
  { name: '행4 world 2001자', input: make(s => { s.world = 'ㄱ'.repeat(2001) }), expect: bad(['world'], '공통 · 세계관은 1~2000자여야 합니다.') },
  { name: '행4 world 이모지 2001개', input: make(s => { s.world = '😀'.repeat(2001) }), expect: bad(['world'], '공통 · 세계관은 1~2000자여야 합니다.') },
  { name: '행5 characters 없음', input: make(s => { delete s.characters }), expect: bad(['characters'], '공통 · 캐릭터 설정 형식이 올바르지 않습니다.') },
  { name: '행5 characters 배열', input: make(s => { s.characters = [] }), expect: bad(['characters'], '공통 · 캐릭터 설정 형식이 올바르지 않습니다.') },
  { name: '행6 세 번째 캐릭터 id', input: make(s => { chars(s).hacker = {} }), expect: bad(['characters'], '공통 · 알 수 없는 캐릭터가 있습니다.') },
  { name: '행7 sebastian 없음', input: make(s => { delete chars(s).sebastian }), expect: bad(['characters', 'sebastian'], '세바스찬 · 설정 형식이 올바르지 않습니다.') },
  { name: '행7 ciel 객체 아님', input: make(s => { s.characters = { ...chars(s), ciel: 'x' } }), expect: bad(['characters', 'ciel'], '시엘 · 설정 형식이 올바르지 않습니다.') },
  { name: '행8 sebastian 에 모르는 키(키 이름을 문구에 싣지 않는다)', input: make(s => { chars(s).sebastian!.apiKey = 'k' }), expect: bad(['characters', 'sebastian'], '세바스찬 · 알 수 없는 항목이 있습니다.') },
  { name: '행8 ciel 에 모르는 키', input: make(s => { chars(s).ciel!.outputRules = 'x' }), expect: bad(['characters', 'ciel'], '시엘 · 알 수 없는 항목이 있습니다.') },
  // 검사 순서
  { name: '순서: 본체 모르는 키가 world 오류보다 먼저', input: make(s => { s.extra = 1; s.world = '' }), expect: bad([], '공통 · 알 수 없는 항목이 있습니다.') },
  { name: '순서: world 오류가 characters 오류보다 먼저', input: make(s => { s.world = ''; delete s.characters }), expect: bad(['world'], '공통 · 세계관은 1~2000자여야 합니다.') },
  { name: '순서: 모르는 캐릭터가 캐릭터 내부 오류보다 먼저', input: make(s => { chars(s).x = {}; chars(s).sebastian!.persona = '' }), expect: bad(['characters'], '공통 · 알 수 없는 캐릭터가 있습니다.') },
  { name: '순서: sebastian 오류가 ciel 오류보다 먼저', input: make(s => { chars(s).sebastian!.speech = ''; chars(s).ciel!.persona = '' }), expect: bad(['characters', 'sebastian', 'speech'], '세바스찬 · 말투는 1~800자여야 합니다.') },
  { name: '순서: 캐릭터 모르는 키가 필드 오류보다 먼저', input: make(s => { chars(s).ciel!.x = 1; chars(s).ciel!.persona = '' }), expect: bad(['characters', 'ciel'], '시엘 · 알 수 없는 항목이 있습니다.') },
  { name: '순서: 필드는 CHARACTER_FIELD_KEYS 순서(sourceMaterial 이 persona 보다 먼저)', input: make(s => { chars(s).ciel!.persona = ''; chars(s).ciel!.sourceMaterial = 'ㄱ'.repeat(61) }), expect: bad(['characters', 'ciel', 'sourceMaterial'], '시엘 · 원작·장르는 60자 이하여야 합니다.') },
  { name: '순서: 한 필드는 형이 길이보다 먼저', input: make(s => { chars(s).ciel!.rules = 'x' }), expect: bad(['characters', 'ciel', 'rules'], '시엘 · 규칙·금기 값의 형식이 올바르지 않습니다.') },
]

for (const sc of SCOPES) {
  const at = (key: string): string[] => ['characters', sc.id, key]
  for (const f of REQUIRED) {
    reject.push({ name: `행9 ${sc.name} ${f.label} 없음`, input: make(s => { delete chars(s)[sc.id]![f.key] }), expect: bad(at(f.key), `${sc.name} · ${f.label} 값의 형식이 올바르지 않습니다.`) })
    reject.push({ name: `행10 ${sc.name} ${f.label} 공백뿐`, input: make(s => { chars(s)[sc.id]![f.key] = '  ' }), expect: bad(at(f.key), `${sc.name} · ${f.label}${f.topic} 1~${f.max}자여야 합니다.`) })
    reject.push({ name: `행10 ${sc.name} ${f.label} 상한+1`, input: make(s => { chars(s)[sc.id]![f.key] = 'ㄱ'.repeat(f.max + 1) }), expect: bad(at(f.key), `${sc.name} · ${f.label}${f.topic} 1~${f.max}자여야 합니다.`) })
  }
  for (const f of OPTIONAL) {
    reject.push({ name: `행9 ${sc.name} ${f.label} 숫자`, input: make(s => { chars(s)[sc.id]![f.key] = 1 }), expect: bad(at(f.key), `${sc.name} · ${f.label} 값의 형식이 올바르지 않습니다.`) })
    reject.push({ name: `행11 ${sc.name} ${f.label} 상한+1`, input: make(s => { chars(s)[sc.id]![f.key] = 'ㄱ'.repeat(f.max + 1) }), expect: bad(at(f.key), `${sc.name} · ${f.label}${f.topic} ${f.max}자 이하여야 합니다.`) })
  }
  for (const f of LISTS) {
    reject.push({ name: `행9 ${sc.name} ${f.label} 문자열`, input: make(s => { chars(s)[sc.id]![f.key] = 'x' }), expect: bad(at(f.key), `${sc.name} · ${f.label} 값의 형식이 올바르지 않습니다.`) })
    reject.push({ name: `행9 ${sc.name} ${f.label} 항목이 문자열 아님`, input: make(s => { chars(s)[sc.id]![f.key] = ['a', 2] }), expect: bad(at(f.key), `${sc.name} · ${f.label} 값의 형식이 올바르지 않습니다.`) })
    reject.push({ name: `행12 ${sc.name} ${f.label} 개수+1`, input: make(s => { chars(s)[sc.id]![f.key] = nums(f.maxItems + 1, '항목') }), expect: bad(at(f.key), `${sc.name} · ${f.label}${f.topic} ${f.maxItems}개 이하여야 합니다.`) })
    reject.push({ name: `행13 ${sc.name} ${f.label} 항목 상한+1`, input: make(s => { chars(s)[sc.id]![f.key] = ['ok', 'ㄱ'.repeat(f.itemMax + 1)] }), expect: bad(at(f.key), `${sc.name} · ${f.label}${f.topic} 한 줄에 ${f.itemMax}자 이하여야 합니다.`) })
  }
}

export const SETTINGS_VECTORS: SettingsVector[] = [...accept, ...reject]
