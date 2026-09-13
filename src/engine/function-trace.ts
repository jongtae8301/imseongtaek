import { TraceLimit, TraceRecorder } from './trace';
import {
  unset,
  value,
  type CallNode,
  type Change,
  type Frame,
  type RunMetadata,
  type RuntimeValue,
  type StepEvent,
  type StepState,
} from './types';

/** 제한된 예제 실행기들이 공유하는 호출·복귀 기록 도구. 코드 해석기는 아니다. */
export class FunctionTrace {
  readonly state: StepState;
  private readonly recorder: TraceRecorder;
  private readonly nodes: CallNode[] = [];
  constructor(
    readonly metadata: RunMetadata,
    globals: string[],
  ) {
    this.recorder = new TraceRecorder(metadata);
    this.state = {
      source: null,
      activeFrameId: null,
      frames: [],
      globals: Object.fromEntries(globals.map((name) => [name, unset()])),
      returnValue: unset(),
      returnInfo: null,
      structures: [{ kind: 'call-tree', id: 'calls', nodes: this.nodes }],
      search: null,
      metrics: {
        calls: 0,
        comparisons: 0,
        assignments: 0,
        arithmetic: 0,
        maxDepth: 0,
        iterations: 0,
      },
    };
  }
  private location(key: string) {
    const line = this.metadata.lineMap[key];
    if (line === undefined) throw new Error(`표시 코드 위치 ${key}가 없습니다.`);
    return { codeId: this.metadata.code.id, line };
  }
  emit(event: StepEvent, key: string | null, explanation: string, changes: Change[] = []) {
    this.state.source = key === null ? null : this.location(key);
    if (event !== 'return') {
      this.state.returnValue = unset();
      this.state.returnInfo = null;
    }
    this.recorder.emit(this.state, event, explanation, changes);
  }
  assign(
    target: Record<string, RuntimeValue>,
    name: string,
    item: RuntimeValue,
    path: string,
    key: string,
    arithmetic = 0,
    iteration = false,
  ) {
    const before = target[name] ?? unset();
    target[name] = item;
    this.state.metrics.assignments++;
    this.state.metrics.arithmetic += arithmetic;
    if (iteration) this.state.metrics.iterations!++;
    const rendered =
      item.kind === 'value'
        ? JSON.stringify(item.value)
        : item.kind === 'none'
          ? 'None'
          : '아직 없음';
    this.emit(
      'assign',
      key,
      `${path.startsWith('globals.') ? '전역' : '현재 호출'}의 ${name}에 ${rendered}을 저장합니다.`,
      [{ path, before, after: item, description: `${name} ← ${rendered}` }],
    );
  }
  global(name: string, item: RuntimeValue, key: string, arithmetic = 0) {
    this.assign(this.state.globals, name, item, `globals.${name}`, key, arithmetic);
  }
  local(
    frame: Frame,
    name: string,
    item: RuntimeValue,
    key: string,
    arithmetic = 0,
    iteration = false,
  ) {
    this.assign(
      frame.locals,
      name,
      item,
      `frames.${frame.id}.locals.${name}`,
      key,
      arithmetic,
      iteration,
    );
  }
  compare(key: string, truth: boolean, condition: string) {
    this.state.metrics.comparisons++;
    this.emit(
      'compare',
      key,
      `${condition}을 검사했습니다. 결과는 ${truth ? '참' : '거짓'}입니다.`,
    );
  }
  enter(
    functionName: string,
    parameters: Record<string, number>,
    locals: string[],
    key: string,
  ): Frame {
    if (this.state.frames.length >= this.metadata.limits.maxDepth)
      this.recorder.limit(
        `최대 호출 깊이 ${this.metadata.limits.maxDepth}에 도달해 새 호출을 중단했습니다. 정상 종료가 아닙니다.`,
      );
    const parent = this.state.frames.at(-1);
    const frame: Frame = {
      id: `frame-${this.nodes.length + 1}`,
      functionName,
      parentId: parent?.id ?? null,
      parameters: Object.fromEntries(
        Object.entries(parameters).map(([name, item]) => [name, value(item)]),
      ),
      locals: Object.fromEntries(locals.map((name) => [name, unset()])),
      callSite: this.location(key),
      returnTo: this.location(key),
    };
    if (parent) this.nodes.find((node) => node.id === parent.id)!.state = 'waiting';
    this.state.frames.push(frame);
    this.state.activeFrameId = frame.id;
    const label = `${functionName}(${Object.values(parameters).join(', ')})`;
    this.nodes.push({
      id: frame.id,
      parentId: frame.parentId,
      label,
      depth: this.state.frames.length,
      state: 'active',
      returnValue: unset(),
    });
    this.state.metrics.calls++;
    this.state.metrics.maxDepth = Math.max(this.state.metrics.maxDepth, this.state.frames.length);
    this.emit(
      'call',
      key,
      `${label} 호출: ${frame.id}를 만들었습니다. 호출 지점의 대입은 반환 뒤에 완료합니다.`,
      [
        {
          path: `frames.${frame.id}`,
          before: unset(),
          after: value(frame.id),
          description: `${frame.id} 프레임 생성`,
        },
      ],
    );
    return frame;
  }
  leave(frame: Frame, result: RuntimeValue, key: string) {
    if (this.state.frames.at(-1)?.id !== frame.id)
      throw new Error('Top 프레임만 반환할 수 있습니다.');
    this.state.frames.pop();
    this.state.activeFrameId = frame.parentId;
    const node = this.nodes.find((item) => item.id === frame.id)!;
    node.state = 'returned';
    node.returnValue = result;
    if (frame.parentId) this.nodes.find((item) => item.id === frame.parentId)!.state = 'active';
    this.state.returnValue = result;
    this.state.returnInfo = {
      frameId: frame.id,
      targetFrameId: frame.parentId,
      target: frame.returnTo,
      value: result,
    };
    const rendered = result.kind === 'value' ? JSON.stringify(result.value) : 'None · 반환값 없음';
    this.emit(
      'return',
      key,
      `${frame.id}가 ${rendered}을 반환했습니다. 프레임을 제거하고 ${frame.parentId ?? '전역'}의 ${frame.returnTo.line}번 줄로 복귀합니다.`,
      [
        {
          path: `frames.${frame.id}`,
          before: value(frame.id),
          after: unset(),
          description: `${frame.id} 제거 · ${rendered} 반환`,
        },
      ],
    );
  }
  run(execute: () => void) {
    this.emit(
      'initial',
      null,
      '함수 정의를 준비했습니다. 변수 대입은 아직 실행하지 않았습니다. 다음 상태를 예상하고 한 단계씩 진행해 보세요.',
    );
    try {
      execute();
      this.emit(
        'complete',
        null,
        '정상 종료했습니다. result, 변수의 범위와 호출·복귀 기록을 자신의 말로 설명해 보세요.',
      );
    } catch (error) {
      if (!(error instanceof TraceLimit)) throw error;
    }
    return this.recorder.finish();
  }
}
