import { FunctionTrace } from '../engine/function-trace';
import { value, type ExecutionRun, type RunMetadata } from '../engine/types';
import { buildSumRun, sumLesson } from './sum-recursive';
import type { Lesson } from './lesson';

export type FunctionProblem = 'sum' | 'factorial' | 'fibonacci' | 'scope';
export type FunctionMethod = 'recursive' | 'iterative';
export type FunctionLimits = Partial<Pick<RunMetadata['limits'], 'maxSteps' | 'maxDepth'>>;
interface FunctionExample {
  title: string;
  maxInput: number;
  defaultInput: number;
  definition: string;
  lesson: Lesson;
}
const origin = '교과 개념을 바탕으로 새로 구성한 예제';
export const functionExamples: Record<FunctionProblem, FunctionExample> = {
  sum: {
    title: '1부터 n까지의 합',
    maxInput: 12,
    defaultInput: 4,
    definition: 'n까지의 합 = n + (n−1까지의 합) · n이 0이면 합은 0',
    lesson: {
      ...sumLesson,
      compare:
        '같은 n으로 재귀·반복 비교를 열어 결과와 호출 횟수, 최대 깊이, 변수 변화를 비교하세요.',
    },
  },
  factorial: {
    title: '팩토리얼',
    maxInput: 12,
    defaultInput: 4,
    definition: '0!=1, n!=n×(n−1)! · n은 곱할 마지막 정수',
    lesson: {
      title: '팩토리얼',
      unit: 'Ⅰ 프로그래밍 · 재귀 함수',
      origin,
      goal: '종료 조건 0!=1과 곱셈 결과가 호출 지점으로 돌아오는 과정을 설명한다.',
      observe: 'n, smaller, subtotal, total, 반환값과 호출 깊이',
      predict: 'n=0에서 0을 반환하면 어떤 일이 생길까요? 마지막 곱셈을 할 프레임을 예상해 보세요.',
      explain: 'subtotal에 값이 생기는 시점과 n×subtotal을 계산하는 순서를 설명하세요.',
      compare: '같은 n의 반복 구현과 비교해 결과는 같아도 프레임 수가 다른 이유를 찾아보세요.',
      reapply: 'n=0과 n=1을 실행하고, 기저 조건과 반환값 1의 역할을 설명하세요.',
    },
  },
  fibonacci: {
    title: '피보나치 수',
    maxInput: 8,
    defaultInput: 4,
    definition: 'F₀=0, F₁=1, Fₙ=Fₙ₋₂+Fₙ₋₁ · 0부터 센 n번째 수',
    lesson: {
      title: '피보나치 수',
      unit: 'Ⅰ 프로그래밍 · 단일 호출과 다중 호출',
      origin,
      goal: '두 재귀 호출의 실행 순서, 독립된 지역 변수와 중복 부분 문제를 설명한다.',
      observe: 'n−2 호출 후 n−1 호출, left·right 반환값, 분기하는 호출 트리',
      predict:
        '현재 n에서 n−2와 n−1 중 어느 호출이 먼저 시작할까요? 같은 입력의 호출이 다시 나타날까요?',
      explain:
        '왼쪽 호출이 복귀한 뒤 오른쪽 호출이 시작하는 과정을 left·right와 연결해 설명하세요.',
      compare: '같은 F₀=0, F₁=1 정의의 반복 방식과 호출 수·산술 연산·최대 깊이를 비교하세요.',
      reapply:
        'n을 1 늘리고 새 호출이 어디에서 생기는지 관찰하세요. 접힌 호출은 계산을 생략한 것이 아닙니다.',
    },
  },
  scope: {
    title: '지역·전역 변수와 함수 호출',
    maxInput: 12,
    defaultInput: 4,
    definition: '전역 total=10, 입력 n=0–12 · 값 전달 후 지역 변경과 global 변경을 구분',
    lesson: {
      title: '지역·전역 변수와 함수 호출',
      unit: 'Ⅰ 프로그래밍 · 함수의 정의와 설계',
      origin,
      goal: '매개 변수와 지역 변수의 범위, global 선언에 따른 전역 변수 변경, None 반환을 구분한다.',
      observe:
        '전역 total, local_add의 매개 변수 total, process의 preview·receipt, 중첩 호출과 복귀',
      predict:
        'local_add 안에서 total을 바꾸면 전역 total도 바뀔까요? add_to_total이 반환하는 값은 무엇일까요?',
      explain:
        'total이 같은 이름이어도 서로 다른 값을 갖는 단계와 실제로 전역 total이 바뀌는 단계를 찾아 설명하세요.',
      compare:
        'local_add는 값을 반환하고 add_to_total은 전역 값을 변경합니다. preview와 receipt가 어떻게 다른지 비교하세요.',
      reapply: 'n=0을 넣고 숫자 0, None, 아직 대입되지 않은 값의 차이를 관찰하세요.',
    },
  },
};

const iterativeLessons: Record<Exclude<FunctionProblem, 'scope'>, Lesson> = {
  sum: {
    ...functionExamples.sum.lesson,
    unit: 'Ⅰ 프로그래밍 · 반복 구조와 재귀 비교',
    goal: '하나의 프레임에서 누적합과 반복 변수가 바뀌는 과정을 설명한다.',
    observe: 'total, i, i ≤ n 조건, 반복 몸체 실행 횟수',
    predict: 'total=0, i=1에서 시작합니다. 다음 반복 후 total과 i는 각각 얼마가 될까요?',
    explain: 'total에 i를 더한 뒤 i를 증가시키는 이유와 반복 종료 조건을 설명하세요.',
    reapply: 'n=0과 n=1을 실행하고 반복 몸체 실행 횟수와 반환값을 비교하세요.',
  },
  factorial: {
    ...functionExamples.factorial.lesson,
    unit: 'Ⅰ 프로그래밍 · 반복 구조와 재귀 비교',
    goal: '곱의 초기값 1과 반복 변수의 역할, 하나의 프레임에서 누적하는 과정을 설명한다.',
    observe: 'total, i, i ≤ n 조건, 반복 몸체 실행 횟수',
    predict: 'total=1에서 시작하는 이유는 무엇일까요? n=0이면 반복 몸체를 실행할까요?',
    explain: 'total에 곱해지는 i의 범위와 반복이 끝난 뒤 반환하는 값을 설명하세요.',
    compare: '같은 n의 재귀 구현과 결과·호출 수·최대 깊이를 비교하세요.',
    reapply: 'n=0과 n=1에서 반환값은 같지만 반복 횟수가 어떻게 다른지 관찰하세요.',
  },
  fibonacci: {
    ...functionExamples.fibonacci.lesson,
    unit: 'Ⅰ 프로그래밍 · 반복 구조와 재귀 비교',
    goal: '연속한 두 피보나치 수를 보관하고 다음 값으로 갱신하는 과정을 설명한다.',
    observe: 'a, b, i, next_value, i < n 조건과 반복 몸체 실행 횟수',
    predict: 'a=0, b=1에서 next_value=a+b를 계산합니다. a와 b를 갱신한 뒤 값은 무엇일까요?',
    explain: 'a를 바꾸기 전에 next_value를 계산하는 이유와 i번째 반복 후 a의 의미를 설명하세요.',
    compare: '같은 F₀=0, F₁=1 정의의 재귀 방식과 호출 수·산술 연산·최대 깊이를 비교하세요.',
    reapply: 'n=0, 1, 2를 실행하고 반환되는 a와 반복 횟수의 관계를 관찰하세요.',
  },
};

export function getFunctionLesson(problem: FunctionProblem, method: FunctionMethod): Lesson {
  return method === 'iterative' && problem !== 'scope'
    ? iterativeLessons[problem]
    : functionExamples[problem].lesson;
}

export function parseFunctionInput(
  problem: FunctionProblem,
  raw: string,
): { ok: true; n: number } | { ok: false; error: string } {
  const max = functionExamples[problem].maxInput;
  if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max)
    return {
      ok: false,
      error: `0부터 ${max}까지의 정수를 입력해 주세요. 빈 값·음수·소수·지수 표기는 사용할 수 없습니다.`,
    };
  return { ok: true, n: Number(raw) };
}
type CodeEntry = readonly [string, string];
const recursiveCode = (problem: 'factorial' | 'fibonacci'): CodeEntry[] =>
  problem === 'factorial'
    ? [
        ['definition', 'def factorial(n):'],
        ['condition', '    if n == 0:'],
        ['baseReturn', '        return 1'],
        ['smaller', '    smaller = n - 1'],
        ['child', '    subtotal = factorial(smaller)'],
        ['total', '    total = n * subtotal'],
        ['return', '    return total'],
      ]
    : [
        ['definition', 'def fib(n):'],
        ['condition', '    if n <= 1:'],
        ['baseReturn', '        return n'],
        ['firstInput', '    first_n = n - 2'],
        ['left', '    left = fib(first_n)'],
        ['secondInput', '    second_n = n - 1'],
        ['right', '    right = fib(second_n)'],
        ['total', '    total = left + right'],
        ['return', '    return total'],
      ];
const scopeCode: CodeEntry[] = [
  ['localDef', 'def local_add(total, amount):'],
  ['subtotal', '    subtotal = total + amount'],
  ['parameter', '    total = subtotal'],
  ['localReturn', '    return total'],
  ['blank1', ''],
  ['globalDef', 'def add_to_total(amount):'],
  ['scope', '    global total'],
  ['globalAdd', '    total = total + amount'],
  ['noneReturn', '    return'],
  ['blank2', ''],
  ['definition', 'def process(n):'],
  ['localCall', '    preview = local_add(total, n)'],
  ['globalCall', '    receipt = add_to_total(n)'],
  ['return', '    return preview'],
];
function iterativeCode(problem: Exclude<FunctionProblem, 'scope'>): CodeEntry[] {
  const name = problem === 'sum' ? 'sum_to' : problem === 'factorial' ? 'factorial' : 'fib';
  return problem === 'fibonacci'
    ? [
        ['definition', `def ${name}(n):`],
        ['a', '    a = 0'],
        ['b', '    b = 1'],
        ['i', '    i = 0'],
        ['condition', '    while i < n:'],
        ['next', '        next_value = a + b'],
        ['shiftA', '        a = b'],
        ['shiftB', '        b = next_value'],
        ['increment', '        i = i + 1'],
        ['return', '    return a'],
      ]
    : [
        ['definition', `def ${name}(n):`],
        ['totalInitial', `    total = ${problem === 'sum' ? 0 : 1}`],
        ['i', '    i = 1'],
        ['condition', '    while i <= n:'],
        ['total', `        total = total ${problem === 'sum' ? '+' : '*'} i`],
        ['increment', '        i = i + 1'],
        ['return', '    return total'],
      ];
}

export function buildFunctionRun(
  problem: FunctionProblem,
  method: FunctionMethod,
  n: number,
  limits: FunctionLimits = {},
): ExecutionRun {
  const definition = functionExamples[problem];
  if (!definition || !['recursive', 'iterative'].includes(method))
    throw new RangeError('지원하는 함수 예제와 실행 방식을 선택해 주세요.');
  if (!Number.isInteger(n) || n < 0 || n > definition.maxInput)
    throw new RangeError(`n은 0부터 ${definition.maxInput}까지의 정수여야 합니다.`);
  if (
    limits.maxSteps !== undefined &&
    (!Number.isInteger(limits.maxSteps) || limits.maxSteps < 2 || limits.maxSteps > 500)
  )
    throw new RangeError('단계 한도는 2부터 500까지입니다.');
  if (
    limits.maxDepth !== undefined &&
    (!Number.isInteger(limits.maxDepth) || limits.maxDepth < 1 || limits.maxDepth > 13)
  )
    throw new RangeError('깊이 한도는 1부터 13까지입니다.');
  if (problem === 'sum' && method === 'recursive') return buildSumRun(n, limits);
  if (problem === 'scope' && method !== 'recursive')
    throw new Error('일반 함수 예제는 반복 비교 대상이 아닙니다.');
  const name =
    problem === 'sum'
      ? 'sum_to'
      : problem === 'factorial'
        ? 'factorial'
        : problem === 'fibonacci'
          ? 'fib'
          : 'process';
  const code: CodeEntry[] =
    problem === 'scope'
      ? [...scopeCode]
      : method === 'iterative'
        ? iterativeCode(problem)
        : recursiveCode(problem as 'factorial' | 'fibonacci');
  code.push(['blank', ''], ['input', `n = ${n}`]);
  if (problem === 'scope') code.push(['initialTotal', 'total = 10']);
  code.push(['entry', `result = ${name}(n)`]);
  const id = problem === 'scope' ? 'function-scope' : `${problem}-${method}`;
  const metadata: RunMetadata = {
    exampleId: id,
    algorithmVersion: '1.0.0',
    input: { n },
    stepSemantics: 'after-event',
    neighborOrder: null,
    code: { id, language: 'python', lines: code.map(([, text]) => text) },
    lineMap: Object.fromEntries(code.map(([key], i) => [key, i + 1])),
    limits: {
      maxSteps: limits.maxSteps ?? 500,
      maxDepth: limits.maxDepth ?? 13,
      maxInput: definition.maxInput,
    },
    metricRules: {
      calls:
        '직접 정의한 함수 진입마다 1회. 최초·기저 호출을 모두 포함하고 함수 정의는 제외합니다.',
      comparisons: 'if 또는 while 조건을 평가할 때마다 1회. 반복 종료의 거짓 검사도 포함합니다.',
      assignments:
        '표시 코드의 =가 완료될 때마다 1회. 매개 변수 전달, 함수 정의와 global 선언은 제외합니다.',
      arithmetic:
        '표시 코드에서 실행한 +, −, × 각각 1회. 반복 변수 증가와 재귀 인수 계산도 포함합니다.',
      maxDepth:
        '동시에 살아 있는 함수 프레임의 최대 수. 최초 호출의 깊이는 1이고 반복 함수도 한 프레임을 사용합니다.',
      iterations:
        '반복 몸체의 첫 대입을 실행할 때마다 1회. 마지막 거짓 조건과 재귀 호출은 포함하지 않습니다.',
    },
  };
  if (
    !Number.isInteger(metadata.limits.maxSteps) ||
    metadata.limits.maxSteps < 2 ||
    metadata.limits.maxSteps > 500
  )
    throw new RangeError('단계 한도는 2부터 500까지입니다.');
  if (
    !Number.isInteger(metadata.limits.maxDepth) ||
    metadata.limits.maxDepth < 1 ||
    metadata.limits.maxDepth > 13
  )
    throw new RangeError('깊이 한도는 1부터 13까지입니다.');
  const t = new FunctionTrace(
    metadata,
    problem === 'scope' ? ['n', 'total', 'result'] : ['n', 'result'],
  );
  function recursive(k: number, entry: string): number {
    const fib = problem === 'fibonacci';
    const frame = t.enter(
      name,
      { n: k },
      fib ? ['first_n', 'left', 'second_n', 'right', 'total'] : ['smaller', 'subtotal', 'total'],
      entry,
    );
    const base = fib ? k <= 1 : k === 0;
    t.compare('condition', base, fib ? `${k} <= 1` : `${k} == 0`);
    let result = fib ? k : 1;
    if (!base) {
      if (fib) {
        t.local(frame, 'first_n', value(k - 2), 'firstInput', 1);
        const left = recursive(k - 2, 'left');
        t.local(frame, 'left', value(left), 'left');
        t.local(frame, 'second_n', value(k - 1), 'secondInput', 1);
        const right = recursive(k - 1, 'right');
        t.local(frame, 'right', value(right), 'right');
        result = left + right;
      } else {
        t.local(frame, 'smaller', value(k - 1), 'smaller', 1);
        const subtotal = recursive(k - 1, 'child');
        t.local(frame, 'subtotal', value(subtotal), 'child');
        result = k * subtotal;
      }
      t.local(frame, 'total', value(result), 'total', 1);
    }
    t.leave(frame, value(result), base ? 'baseReturn' : 'return');
    return result;
  }
  function iterative(): number {
    const fib = problem === 'fibonacci';
    const frame = t.enter(
      name,
      { n },
      fib ? ['a', 'b', 'i', 'next_value'] : ['total', 'i'],
      'entry',
    );
    let total = problem === 'sum' ? 0 : 1,
      a = 0,
      b = 1,
      i = fib ? 0 : 1;
    if (fib) {
      t.local(frame, 'a', value(a), 'a');
      t.local(frame, 'b', value(b), 'b');
    } else t.local(frame, 'total', value(total), 'totalInitial');
    t.local(frame, 'i', value(i), 'i');
    while (true) {
      const condition = fib ? i < n : i <= n;
      t.compare('condition', condition, `${i} ${fib ? '<' : '<='} ${n}`);
      if (!condition) break;
      if (fib) {
        const next = a + b;
        t.local(frame, 'next_value', value(next), 'next', 1, true);
        a = b;
        t.local(frame, 'a', value(a), 'shiftA');
        b = next;
        t.local(frame, 'b', value(b), 'shiftB');
      } else {
        total = problem === 'sum' ? total + i : total * i;
        t.local(frame, 'total', value(total), 'total', 1, true);
      }
      i++;
      t.local(frame, 'i', value(i), 'increment', 1);
    }
    const result = fib ? a : total;
    t.leave(frame, value(result), 'return');
    return result;
  }
  function scope(): number {
    t.global('total', value(10), 'initialTotal');
    const frame = t.enter('process', { n }, ['preview', 'receipt'], 'entry');
    const local = t.enter('local_add', { total: 10, amount: n }, ['subtotal'], 'localCall');
    const result = 10 + n;
    t.local(local, 'subtotal', value(result), 'subtotal', 1);
    t.assign(
      local.parameters,
      'total',
      value(result),
      `frames.${local.id}.parameters.total`,
      'parameter',
    );
    t.leave(local, value(result), 'localReturn');
    t.local(frame, 'preview', value(result), 'localCall');
    const global = t.enter('add_to_total', { amount: n }, [], 'globalCall');
    t.emit(
      'scope',
      'scope',
      'global total은 이 함수의 total이 전역 변수를 가리킴을 지정합니다. 이 선언 자체는 값을 바꾸지 않습니다.',
    );
    t.global('total', value(10 + n), 'globalAdd', 1);
    t.leave(global, { kind: 'none' }, 'noneReturn');
    t.local(frame, 'receipt', { kind: 'none' }, 'globalCall');
    t.leave(frame, value(result), 'return');
    return result;
  }
  return t.run(() => {
    t.global('n', value(n), 'input');
    const result =
      problem === 'scope' ? scope() : method === 'recursive' ? recursive(n, 'entry') : iterative();
    t.global('result', value(result), 'entry');
  });
}

export interface FunctionComparison {
  recursive: ExecutionRun;
  iterative: ExecutionRun;
  sameResult: boolean | null;
}
export function buildFunctionComparison(
  problem: Exclude<FunctionProblem, 'scope'>,
  n: number,
  limits: FunctionLimits = {},
): FunctionComparison {
  const shared = { maxSteps: limits.maxSteps ?? 500, maxDepth: limits.maxDepth ?? 13 };
  const recursive = buildFunctionRun(problem, 'recursive', n, shared),
    iterative = buildFunctionRun(problem, 'iterative', n, shared);
  const a = recursive.steps.at(-1)!,
    b = iterative.steps.at(-1)!;
  return {
    recursive,
    iterative,
    sameResult:
      a.status === 'completed' && b.status === 'completed'
        ? JSON.stringify(a.globals.result) === JSON.stringify(b.globals.result)
        : null,
  };
}
