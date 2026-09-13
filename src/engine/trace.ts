import type {
  Change,
  ExecutionRun,
  RunMetadata,
  Snapshot,
  Step,
  StepEvent,
  StepState,
} from './types';
import { unset } from './types';

export function deepFreeze<T>(object: T): T {
  if (object !== null && typeof object === 'object') {
    Object.values(object).forEach(deepFreeze);
    Object.freeze(object);
  }
  return object;
}

/** 실행 한도는 제어 흐름용 예외이며 정상 완료와 구분한다. */
export class TraceLimit extends Error {}

export class TraceRecorder {
  private readonly steps: Snapshot[] = [];
  constructor(private readonly metadata: RunMetadata) {
    if (!Number.isInteger(metadata.limits.maxSteps) || metadata.limits.maxSteps < 2) {
      throw new RangeError('최대 단계 수는 초기 상태와 종료 상태를 포함해 2 이상이어야 합니다.');
    }
  }

  emit(state: StepState, event: StepEvent, explanation: string, changes: Change[] = []): void {
    // 종료 기록 한 자리를 예약한다. 한도 이후 계산 중인 상태는 저장하지 않는다.
    if (this.steps.length >= this.metadata.limits.maxSteps - 1 && event !== 'complete') {
      this.limit(
        `최대 ${this.metadata.limits.maxSteps}단계에 도달하여 실행을 중단했습니다. 마지막으로 실행한 상태를 표시합니다.`,
      );
    }
    if (this.steps.length >= this.metadata.limits.maxSteps)
      this.limit('실행 단계 한도에 도달했습니다.');
    const step: Step = {
      ...structuredClone(state),
      index: this.steps.length,
      event,
      status: event === 'complete' ? 'completed' : 'running',
      explanation,
      changes: structuredClone(changes),
    };
    this.steps.push(deepFreeze(step));
  }

  limit(reason: string): never {
    const previous = this.steps.at(-1);
    if (!previous) throw new Error('초기 상태를 기록한 뒤 실행 한도를 검사해야 합니다.');
    const terminal = structuredClone(previous) as Step;
    terminal.index = this.steps.length;
    terminal.event = 'limit';
    terminal.status = 'limit-reached';
    terminal.source = null;
    terminal.returnValue = unset();
    terminal.returnInfo = null;
    terminal.changes = [];
    terminal.explanation = reason;
    this.steps.push(deepFreeze(terminal));
    throw new TraceLimit(reason);
  }

  finish(): ExecutionRun {
    return deepFreeze({ metadata: structuredClone(this.metadata), steps: [...this.steps] });
  }
}
