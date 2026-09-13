import { TraceLimit, TraceRecorder } from '../engine/trace';
import { unset, value } from '../engine/types';
import type { Change, JsonValue, RunMetadata, StepState } from '../engine/types';
import {
  applyLinearCommand,
  createLinearState,
  LINEAR_CAPACITY,
  linearStructure,
  MAX_OPERATIONS,
} from '../structures/linear';
import type { LinearCommand, LinearMode } from '../structures/linear';

export const linearLessons = {
  queue: {
    id: 'queue-bank',
    title: '은행 대기열',
    unit: 'Ⅱ 데이터 구조 · 큐',
    origin: '교과 개념을 바탕으로 새로 구성한 예제',
    goal: '삽입 순서와 삭제 순서를 연결해 FIFO를 설명하고 Front와 Rear를 구분한다.',
    observe: '대기 순서, Front/Rear, 삭제되어 반환된 값, 남은 용량',
    predict: '1, 2, 3, 4를 순서대로 넣으면 어느 값이 먼저 나올까요?',
    explain: '삭제 전후의 Front와 Rear가 가리키는 값은 어떻게 달라지나요?',
    compare: '스택의 객차 예제도 같은 순서로 1~4를 넣습니다. 두 예제의 삭제 순서를 비교해 보세요.',
    reapply: '직접 조작에서 0을 두 번 넣어 보세요. 값이 같아도 두 번 삭제해야 모두 나올까요?',
  },
  stack: {
    id: 'stack-rail',
    title: '객차 순서 뒤집기',
    unit: 'Ⅱ 데이터 구조 · 스택',
    origin: '교과 개념을 바탕으로 새로 구성한 예제',
    goal: '삽입과 삭제가 Top에서 일어남을 관찰하고 LIFO를 설명한다.',
    observe: 'Bottom부터 Top까지의 순서, 새로 쌓인 값, 삭제 반환 순서',
    predict: '1, 2, 3, 4를 순서대로 쌓으면 어느 객차가 먼저 나올까요?',
    explain: 'Push와 Pop을 반복할 때 Top이 가리키는 값이 어떻게 바뀌는지 설명해 보세요.',
    compare:
      '큐의 은행 예제도 같은 순서로 1~4를 넣습니다. 같은 연산인데 삭제 순서가 다른 이유는 무엇인가요?',
    reapply:
      '직접 조작으로 1, 2를 넣고 한 번 삭제한 뒤 3을 넣으세요. 남은 삭제 순서를 예상해 보세요.',
  },
} as const;

/** 두 구조에 동일한 입력·연산을 제공한다. 정답은 구조 모델에서만 계산한다. */
export const linearDemoCommands: readonly LinearCommand[] = [
  { type: 'insert', value: 1 },
  { type: 'insert', value: 2 },
  { type: 'insert', value: 3 },
  { type: 'insert', value: 4 },
  { type: 'remove' },
  { type: 'remove' },
  { type: 'remove' },
  { type: 'remove' },
];

export function buildLinearRun(
  mode: LinearMode,
  commands: readonly LinearCommand[],
  options: { direct?: boolean; capacity?: number; maxSteps?: number } = {},
) {
  if (commands.length > MAX_OPERATIONS)
    throw new RangeError(`한 실습의 연산은 ${MAX_OPERATIONS}회까지입니다.`);
  let model = createLinearState(mode, options.capacity ?? LINEAR_CAPACITY);
  // 표시 코드 생성 전에 입력을 검증한다. 학생 입력 문자열을 코드로 삽입하지 않는다.
  for (const command of commands) applyLinearCommand(createLinearState(mode), command);
  const id = linearLessons[mode].id;
  const lines =
    mode === 'queue' ? ['from collections import deque', 'queue = deque()'] : ['stack = []'];
  lines.push(
    `CAPACITY = ${model.capacity}`,
    '# 선언은 준비된 상태입니다. 아래 연산부터 추적합니다.',
  );
  const lineMap: Record<string, number> = {};
  const positions = commands.map((command, index) => {
    const condition = lines.length + 1;
    lines.push(command.type === 'insert' ? `if len(${mode}) < CAPACITY:` : `if ${mode}:`);
    lines.push(
      command.type === 'insert'
        ? `    ${mode}.append(${command.value})`
        : `    removed = ${mode}.${mode === 'queue' ? 'popleft' : 'pop'}()`,
    );
    lines.push('else:', `    print("${command.type === 'insert' ? '용량 초과' : '빈 구조'}")`);
    lineMap[`operation${index + 1}.condition`] = condition;
    lineMap[`operation${index + 1}.success`] = condition + 1;
    lineMap[`operation${index + 1}.rejected`] = condition + 3;
    return { condition, success: condition + 1, rejected: condition + 3 };
  });
  const metadata: RunMetadata = {
    exampleId: id,
    input: {
      mode,
      commands: commands.map((command): JsonValue => {
        if (command.type === 'insert') return { type: 'insert', value: command.value };
        return { type: 'remove' };
      }),
      direct: options.direct ?? false,
    },
    algorithmVersion: '1.0.0',
    stepSemantics: 'after-event',
    code: { id, language: 'python', lines },
    lineMap,
    neighborOrder: null,
    limits: {
      maxSteps: options.maxSteps ?? 100,
      maxDepth: 0,
      maxInput: 99,
      maxOperations: MAX_OPERATIONS,
      capacity: model.capacity,
    },
    metricRules: {
      calls:
        '이 예제는 자료구조 메서드를 한 연산으로 관찰합니다. 메서드 내부 호출과 프레임은 집계하지 않습니다.',
      comparisons: '각 요청에서 용량 또는 비어 있는지를 검사하는 if 조건을 평가할 때 1회.',
      assignments: '삭제 반환값을 removed에 대입할 때 1회. 준비된 선언은 제외합니다.',
      arithmetic: '이 예제에는 명시적으로 추적하는 산술 연산이 없습니다.',
      maxDepth: '메서드 내부 호출 깊이는 추적하지 않습니다.',
      inserts: '실제로 삽입한 값마다 1회. 가득 차서 거절된 삽입은 제외합니다.',
      removes: '실제로 삭제하고 반환한 값마다 1회. 빈 구조의 삭제 요청은 제외합니다.',
      rejected: '용량 초과 또는 빈 구조 때문에 수행하지 않은 요청마다 1회.',
      maxSize: '현재 단계까지 동시에 저장된 원소 수의 최댓값입니다.',
    },
  };
  const recorder = new TraceRecorder(metadata);
  const state: StepState = {
    source: null,
    activeFrameId: null,
    frames: [],
    globals: { removed: unset() },
    returnValue: unset(),
    returnInfo: null,
    structures: [linearStructure(model)],
    search: null,
    metrics: {
      calls: 0,
      comparisons: 0,
      assignments: 0,
      arithmetic: 0,
      maxDepth: 0,
      inserts: 0,
      removes: 0,
      rejected: 0,
      maxSize: 0,
    },
  };
  recorder.emit(
    state,
    'initial',
    `빈 ${mode === 'queue' ? '큐' : '스택'}와 용량 ${model.capacity}개를 준비했습니다. ${options.direct ? '삽입하거나 삭제할 값을 예상하고 직접 조작해 보세요.' : '다음으로 조건 검사와 삽입·삭제를 관찰하세요.'}`,
  );
  try {
    commands.forEach((command, index) => {
      const position = positions[index]!;
      const result = applyLinearCommand(model, command);
      state.returnValue = unset();
      state.structures = [linearStructure(model)];
      state.source = { codeId: id, line: position.condition };
      state.metrics.comparisons++;
      recorder.emit(
        state,
        'compare',
        `${command.type === 'insert' ? `저장된 원소 ${model.items.length}개가 용량 ${model.capacity}개보다 작은지` : '구조에 원소가 있는지'} 검사했습니다. 조건은 ${result.transition.action === 'reject' ? '거짓' : '참'}입니다.`,
      );
      model = result.state;
      state.structures = [linearStructure(model, result.transition)];
      state.source = {
        codeId: id,
        line: result.transition.action === 'reject' ? position.rejected : position.success,
      };
      const changes: Change[] = [];
      if (result.transition.action === 'reject') {
        state.metrics.rejected!++;
        recorder.emit(
          state,
          'reject',
          `${result.transition.reason} 코드의 안내를 출력하고 구조와 이전 반환값을 유지합니다.`,
        );
      } else {
        changes.push({
          path: `structures.${mode}.items`,
          before: value(result.transition.before),
          after: value([...model.items]),
          description: `${command.type === 'insert' ? '삽입' : '삭제'}한 값: ${result.transition.value}`,
        });
        if (command.type === 'insert') {
          state.metrics.inserts!++;
          state.metrics.maxSize = Math.max(state.metrics.maxSize!, model.items.length);
        } else {
          state.metrics.removes!++;
          state.metrics.assignments++;
          state.returnValue = value(result.transition.value);
          changes.push({
            path: 'globals.removed',
            before: state.globals.removed!,
            after: state.returnValue,
            description: `removed ← ${result.transition.value}`,
          });
          state.globals.removed = state.returnValue;
        }
        recorder.emit(
          state,
          command.type,
          command.type === 'insert'
            ? `${result.transition.value}을 ${mode === 'queue' ? 'Rear 쪽 맨 뒤' : 'Top'}에 삽입했습니다. 현재 ${model.items.length}개입니다.`
            : `${mode === 'queue' ? 'Front의 가장 먼저 들어온' : 'Top의 가장 나중에 들어온'} 값 ${result.transition.value}을 삭제하여 반환하고 removed에 저장했습니다.`,
          changes,
        );
      }
    });
    if (!options.direct) {
      state.source = null;
      state.returnValue = unset();
      state.structures = [linearStructure(model)];
      recorder.emit(
        state,
        'complete',
        '예제 연산을 모두 마쳤습니다. 삭제 반환 순서를 확인하고 다른 자료구조의 같은 입력과 비교해 보세요.',
      );
    }
  } catch (error) {
    if (!(error instanceof TraceLimit)) throw error;
  }
  return recorder.finish();
}
