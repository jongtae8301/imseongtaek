import { TraceLimit, TraceRecorder } from '../engine/trace';
import { unset, value } from '../engine/types';
import type {
  CallNode,
  Change,
  ExecutionRun,
  Frame,
  RunMetadata,
  RuntimeValue,
  StepEvent,
  StepState,
} from '../engine/types';

export const SUM_MAX_INPUT = 12;
export const sumLesson = {
  id: 'sum-recursive',
  title: '1부터 n까지의 합',
  unit: 'Ⅰ 프로그래밍 · 재귀 함수',
  origin: '교과 개념을 바탕으로 새로 구성한 예제',
  goal: '재귀 호출마다 변수가 분리되고, 반환된 값이 호출 지점으로 돌아오는 과정을 설명한다.',
  observe: '매개 변수 n, 지역 변수 subtotal, 호출 깊이와 반환값',
  predict: 'n이 0이 되면 어떤 값이 반환될까요? 그다음 실행할 줄을 예상해 보세요.',
  explain: 'subtotal에 값이 생기는 시점과 콜 스택이 줄어드는 이유를 자기 말로 설명해 보세요.',
  compare: '같은 n으로 반복문을 직접 작성해 보세요. 결과와 필요한 변수는 어떻게 다른가요?',
  reapply: 'n을 1 늘리면 호출 횟수와 최대 깊이는 각각 얼마나 늘어날까요?',
} as const;

export function parseSumInput(raw: string): { ok: true; n: number } | { ok: false; error: string } {
  if (!/^\d+$/.test(raw.trim()))
    return {
      ok: false,
      error: '0부터 12까지의 정수를 입력해 주세요. 빈 값·소수·음수는 사용할 수 없습니다.',
    };
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > SUM_MAX_INPUT)
    return { ok: false, error: '호출 구조를 읽기 쉽도록 n은 0부터 12까지만 사용할 수 있습니다.' };
  return { ok: true, n };
}

export function buildSumRun(
  n: number,
  limits: Partial<Pick<RunMetadata['limits'], 'maxSteps' | 'maxDepth'>> = {},
): ExecutionRun {
  if (!Number.isInteger(n) || n < 0 || n > SUM_MAX_INPUT)
    throw new RangeError('n은 0부터 12까지의 정수여야 합니다.');
  const codeId = sumLesson.id;
  const metadata: RunMetadata = {
    exampleId: codeId,
    input: { n },
    algorithmVersion: '1.0.0',
    stepSemantics: 'after-event',
    code: {
      id: codeId,
      language: 'python',
      lines: [
        'def sum_to(n):',
        '    if n == 0:',
        '        return 0',
        '    smaller = n - 1',
        '    subtotal = sum_to(smaller)',
        '    total = n + subtotal',
        '    return total',
        '',
        `n = ${n}`,
        'result = sum_to(n)',
      ],
    },
    lineMap: {
      definition: 1,
      baseCondition: 2,
      baseReturn: 3,
      smaller: 4,
      recursiveCall: 5,
      total: 6,
      recursiveReturn: 7,
      input: 9,
      entryCall: 10,
    },
    neighborOrder: null,
    metricRules: {
      calls: 'sum_to 진입마다 1회. 최초 호출과 n = 0 호출을 포함합니다.',
      comparisons: 'n == 0을 평가할 때마다 1회.',
      assignments: '코드의 =가 완료될 때마다 1회. 매개 변수 전달과 함수 정의는 제외합니다.',
      arithmetic: 'n - 1과 n + subtotal을 각각 1회.',
      maxDepth: '동시에 살아 있는 sum_to 프레임 수의 최댓값. 최초 호출의 깊이는 1입니다.',
    },
    limits: {
      maxSteps: limits.maxSteps ?? 160,
      maxDepth: limits.maxDepth ?? 13,
      maxInput: SUM_MAX_INPUT,
    },
  };
  if (
    !Number.isInteger(metadata.limits.maxDepth) ||
    metadata.limits.maxDepth < 1 ||
    metadata.limits.maxDepth > 13
  ) {
    throw new RangeError('최대 호출 깊이는 1부터 13까지의 정수여야 합니다.');
  }
  const recorder = new TraceRecorder(metadata);
  const nodes: CallNode[] = [];
  const state: StepState = {
    source: null,
    activeFrameId: null,
    frames: [],
    globals: { n: unset(), result: unset() },
    returnValue: unset(),
    returnInfo: null,
    structures: [{ kind: 'call-tree', id: 'calls', nodes }],
    search: null,
    metrics: { calls: 0, comparisons: 0, assignments: 0, arithmetic: 0, maxDepth: 0 },
  };
  const source = (line: number) => ({ codeId, line });
  function emit(
    event: StepEvent,
    line: number | null,
    explanation: string,
    changes: Change[] = [],
  ) {
    state.source = line === null ? null : source(line);
    if (event !== 'return') {
      state.returnValue = unset();
      state.returnInfo = null;
    }
    recorder.emit(state, event, explanation, changes);
  }
  function assign(
    target: Record<string, RuntimeValue>,
    name: string,
    number: number,
    path: string,
    line: number,
    explanation: string,
  ) {
    const before = target[name] ?? unset();
    target[name] = value(number);
    state.metrics.assignments++;
    emit('assign', line, explanation, [
      { path, before, after: value(number), description: `${name} ← ${number}` },
    ]);
  }
  function sum(k: number, parent: Frame | null, callLine: number): number {
    if (state.frames.length >= metadata.limits.maxDepth)
      recorder.limit(
        `최대 호출 깊이 ${metadata.limits.maxDepth}에 도달하여 새 호출을 중단했습니다. 정상 종료가 아닙니다.`,
      );
    const id = `frame-${nodes.length + 1}`;
    const frame: Frame = {
      id,
      functionName: 'sum_to',
      parentId: parent?.id ?? null,
      parameters: { n: value(k) },
      locals: { smaller: unset(), subtotal: unset(), total: unset() },
      callSite: source(callLine),
      returnTo: source(callLine),
    };
    const parentNode = nodes.find((node) => node.id === parent?.id);
    if (parentNode) parentNode.state = 'waiting';
    state.frames.push(frame);
    const node: CallNode = {
      id,
      parentId: frame.parentId,
      label: `sum_to(${k})`,
      depth: state.frames.length,
      state: 'active',
      returnValue: unset(),
    };
    nodes.push(node);
    state.activeFrameId = id;
    state.metrics.calls++;
    state.metrics.maxDepth = Math.max(state.metrics.maxDepth, state.frames.length);
    emit(
      'call',
      callLine,
      `${callLine}번 줄에서 sum_to(${k})를 호출했습니다. ${id}의 매개 변수 n은 ${k}입니다. 대입은 반환 뒤 완료됩니다.`,
      [
        {
          path: `frames.${id}`,
          before: unset(),
          after: value(id),
          description: `${id} 프레임 생성 · n = ${k}`,
        },
      ],
    );
    state.metrics.comparisons++;
    emit(
      'compare',
      2,
      `n == 0을 비교했습니다. ${k} == 0은 ${k === 0 ? '참이므로 0을 반환합니다.' : '거짓이므로 더 작은 문제를 호출합니다.'}`,
    );
    let result = 0;
    if (k !== 0) {
      state.metrics.arithmetic++;
      assign(
        frame.locals,
        'smaller',
        k - 1,
        `frames.${id}.locals.smaller`,
        4,
        `n - 1을 계산해 ${id}의 smaller에 ${k - 1}을 저장했습니다.`,
      );
      const subtotal = sum(k - 1, frame, 5);
      assign(
        frame.locals,
        'subtotal',
        subtotal,
        `frames.${id}.locals.subtotal`,
        5,
        `복귀한 값을 ${id}의 subtotal에 ${subtotal}으로 저장했습니다.`,
      );
      result = k + subtotal;
      state.metrics.arithmetic++;
      assign(
        frame.locals,
        'total',
        result,
        `frames.${id}.locals.total`,
        6,
        `${k} + ${subtotal}을 계산해 ${id}의 total에 ${result}을 저장했습니다.`,
      );
    }
    state.frames.pop();
    state.activeFrameId = parent?.id ?? null;
    node.state = 'returned';
    node.returnValue = value(result);
    if (parentNode) parentNode.state = 'active';
    state.returnValue = value(result);
    state.returnInfo = {
      frameId: id,
      targetFrameId: parent?.id ?? null,
      target: frame.returnTo,
      value: value(result),
    };
    emit(
      'return',
      k === 0 ? 3 : 7,
      `${id}에서 ${result}을 반환했습니다. 프레임을 제거하고 ${parent?.id ?? '전역 실행'}의 ${callLine}번 줄로 복귀합니다.`,
      [
        {
          path: `frames.${id}`,
          before: value(id),
          after: unset(),
          description: `${id} 프레임 제거 · 반환값 ${result}`,
        },
      ],
    );
    return result;
  }
  emit(
    'initial',
    null,
    '실행 준비가 끝났습니다. 다음 상태를 예상하고 다음 버튼을 눌러 보세요. 함수 정의는 준비되어 있고, 변수 대입은 아직 실행하지 않았습니다.',
  );
  try {
    assign(state.globals, 'n', n, 'globals.n', 9, `전역 변수 n에 입력값 ${n}을 저장했습니다.`);
    const result = sum(n, null, 10);
    assign(
      state.globals,
      'result',
      result,
      'globals.result',
      10,
      `최초 호출에서 반환한 ${result}을 전역 변수 result에 저장했습니다.`,
    );
    emit(
      'complete',
      null,
      '정상 종료했습니다. result와 반환 기록을 확인하고, 호출과 복귀 과정을 자기 말로 설명해 보세요.',
    );
  } catch (error) {
    if (!(error instanceof TraceLimit)) throw error;
  }
  return recorder.finish();
}
