import type { SequenceStructure, SequenceTransition } from '../engine/types';

export type LinearMode = 'queue' | 'stack';
export type LinearCommand = { type: 'insert'; value: number } | { type: 'remove' };
export interface LinearState {
  readonly mode: LinearMode;
  readonly capacity: number;
  readonly items: readonly number[];
  readonly removedValues: readonly number[];
}
export const LINEAR_CAPACITY = 6;
export const MAX_OPERATIONS = 40;

export function parseLinearValue(
  raw: string,
): { ok: true; value: number } | { ok: false; error: string } {
  if (!/^-?\d+$/.test(raw.trim()) || Math.abs(Number(raw)) > 99) {
    return {
      ok: false,
      error: '−99부터 99까지의 정수를 입력해 주세요. 빈 값·소수·지수 표기는 사용할 수 없습니다.',
    };
  }
  return { ok: true, value: Number(raw) === 0 ? 0 : Number(raw) };
}

export function createLinearState(mode: LinearMode, capacity = LINEAR_CAPACITY): LinearState {
  if (!['queue', 'stack'].includes(mode)) throw new RangeError('큐 또는 스택을 선택해야 합니다.');
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 8)
    throw new RangeError('용량은 1부터 8까지여야 합니다.');
  return { mode, capacity, items: [], removedValues: [] };
}

/** 격자 탐색 전용: 최대 49칸의 인덱스를 저장하되 삽입·삭제는 같은 순수 전이를 쓴다. */
export function createTraversalQueue(capacity: number): LinearState {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 49)
    throw new RangeError('탐색 큐 용량은 1부터 49까지여야 합니다.');
  return { mode: 'queue', capacity, items: [], removedValues: [] };
}

/** 직접 조작과 예제 실행이 공유하는 순수 전이. 포인터와 반환 순서의 유일한 기준이다. */
export function applyLinearCommand(
  state: LinearState,
  command: LinearCommand,
): { state: LinearState; transition: SequenceTransition } {
  if (command.type !== 'insert' && command.type !== 'remove')
    throw new RangeError('지원하지 않는 연산입니다.');
  if (
    command.type === 'insert' &&
    (!Number.isInteger(command.value) || Math.abs(command.value) > 99)
  )
    throw new RangeError('값은 −99부터 99까지의 정수여야 합니다.');
  const before = [...state.items];
  const transition: SequenceTransition = {
    action: command.type,
    requested: command.type,
    value: null,
    before,
    fromIndex: null,
    toIndex: null,
    reason: null,
  };
  if (command.type === 'insert') {
    transition.value = command.value;
    if (state.items.length >= state.capacity) {
      transition.action = 'reject';
      transition.reason = `용량 ${state.capacity}개를 모두 사용하여 삽입하지 않았습니다.`;
      return { state, transition };
    }
    transition.toIndex = before.length;
    return { state: { ...state, items: [...before, command.value] }, transition };
  }
  if (!before.length) {
    transition.action = 'reject';
    transition.reason = `빈 ${state.mode === 'queue' ? '큐' : '스택'}에서는 삭제할 수 없습니다.`;
    return { state, transition };
  }
  const fromIndex = state.mode === 'queue' ? 0 : before.length - 1;
  const removed = before[fromIndex]!;
  transition.value = removed;
  transition.fromIndex = fromIndex;
  return {
    state: {
      ...state,
      items: before.filter((_, index) => index !== fromIndex),
      removedValues: [...state.removedValues, removed],
    },
    transition,
  };
}

export function linearStructure(
  state: LinearState,
  transition: SequenceTransition | null = null,
): SequenceStructure {
  const last = state.items.length ? state.items.length - 1 : null;
  return {
    kind: 'sequence',
    id: state.mode,
    mode: state.mode,
    items: [...state.items],
    capacity: state.capacity,
    pointers:
      state.mode === 'queue' ? { Front: last === null ? null : 0, Rear: last } : { Top: last },
    removedValues: [...state.removedValues],
    transition,
  };
}
