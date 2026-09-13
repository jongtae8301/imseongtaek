import { describe, expect, it } from 'vitest';
import { applyLinearCommand, createLinearState, linearStructure, parseLinearValue } from './linear';
import type { LinearCommand, LinearMode } from './linear';

describe.each<LinearMode>(['queue', 'stack'])('%s의 공통 구조 모델', (mode) => {
  it('빈 구조의 포인터와 삭제 거절', () => {
    const initial = createLinearState(mode);
    expect(linearStructure(initial).pointers).toEqual(
      mode === 'queue' ? { Front: null, Rear: null } : { Top: null },
    );
    const result = applyLinearCommand(initial, { type: 'remove' });
    expect(result.state).toBe(initial);
    expect(result.transition.action).toBe('reject');
    expect(result.transition.value).toBeNull();
  });
  it('FIFO/LIFO에 따라 삽입 2,1,3의 반환 순서와 포인터가 다르다', () => {
    let state = createLinearState(mode);
    for (const item of [2, 1, 3])
      state = applyLinearCommand(state, { type: 'insert', value: item }).state;
    expect(state.items).toEqual([2, 1, 3]);
    expect(linearStructure(state).pointers).toEqual(
      mode === 'queue' ? { Front: 0, Rear: 2 } : { Top: 2 },
    );
    state = applyLinearCommand(state, { type: 'remove' }).state;
    expect(state.items).toEqual(mode === 'queue' ? [1, 3] : [2, 1]);
    expect(linearStructure(state).pointers).toEqual(
      mode === 'queue' ? { Front: 0, Rear: 1 } : { Top: 1 },
    );
    state = applyLinearCommand(state, { type: 'remove' }).state;
    state = applyLinearCommand(state, { type: 'remove' }).state;
    expect(state.removedValues).toEqual(mode === 'queue' ? [2, 1, 3] : [3, 1, 2]);
    expect(state.items).toEqual([]);
  });
  it('용량 초과는 무시하며 삭제 후 새 삽입이 가능하다', () => {
    const empty = createLinearState(mode, 1);
    const full = applyLinearCommand(empty, { type: 'insert', value: 0 }).state;
    expect(linearStructure(full).pointers).toEqual(
      mode === 'queue' ? { Front: 0, Rear: 0 } : { Top: 0 },
    );
    const rejected = applyLinearCommand(full, { type: 'insert', value: 9 });
    expect(rejected.state).toBe(full);
    expect(rejected.transition.action).toBe('reject');
    const removed = applyLinearCommand(full, { type: 'remove' });
    expect(removed.transition.value).toBe(0);
    expect(applyLinearCommand(removed.state, { type: 'insert', value: -99 }).state.items).toEqual([
      -99,
    ]);
    expect(empty.items).toEqual([]);
  });
  it('중복된 0도 별도 원소로 처리하고 이전 상태를 변경하지 않는다', () => {
    let state = createLinearState(mode);
    for (let i = 0; i < 2; i++)
      state = applyLinearCommand(state, { type: 'insert', value: 0 }).state;
    const previous = state;
    state = applyLinearCommand(state, { type: 'remove' }).state;
    expect(state.items).toEqual([0]);
    expect(state.removedValues).toEqual([0]);
    expect(previous.items).toEqual([0, 0]);
    state = applyLinearCommand(state, { type: 'remove' }).state;
    expect(state.removedValues).toEqual([0, 0]);
  });
  it('최대 용량 12개를 채우고 넘친 삽입은 거절하며 삭제 순서를 유지한다', () => {
    let state = createLinearState(mode, 12);
    for (let item = 0; item < 12; item++)
      state = applyLinearCommand(state, { type: 'insert', value: item }).state;
    expect(state.items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const overflow = applyLinearCommand(state, { type: 'insert', value: 12 });
    expect(overflow.transition.action).toBe('reject');
    expect(overflow.state).toBe(state);
    const removed = applyLinearCommand(state, { type: 'remove' });
    expect(removed.transition.value).toBe(mode === 'queue' ? 0 : 11);
    expect(removed.state.items).toHaveLength(11);
  });
});

it.each(['', ' ', '1.2', '1e1', '0x10', '100', '-100', 'NaN', '안녕'])(
  '잘못된 값 %j 거절',
  (raw) => {
    expect(parseLinearValue(raw).ok).toBe(false);
  },
);
it.each(['-99', '99', '0', ' 2 '])('허용 범위 정수 %j 파싱', (raw) => {
  expect(parseLinearValue(raw)).toEqual({ ok: true, value: Number(raw) });
});
it('직접 호출의 비정상 값과 잘못된 용량도 검증한다', () => {
  for (const value of [NaN, Infinity, 1.1, 100])
    expect(() => applyLinearCommand(createLinearState('queue'), { type: 'insert', value })).toThrow(
      RangeError,
    );
  for (const capacity of [0, 13, NaN, 1.1])
    expect(() => createLinearState('queue', capacity)).toThrow(RangeError);
  expect(() =>
    applyLinearCommand(createLinearState('queue'), { type: 'unknown' } as unknown as LinearCommand),
  ).toThrow(RangeError);
});
