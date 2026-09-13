import { describe, expect, it } from 'vitest';
import { buildSumRun, parseSumInput } from './sum-recursive';
import { value } from '../engine/types';

describe('재귀 합 예제', () => {
  it.each([
    [0, 0],
    [1, 1],
    [2, 3],
    [4, 10],
    [12, 78],
  ])('n=%i의 결과는 %i이며 모든 호출이 복귀한다', (n, result) => {
    const run = buildSumRun(n);
    const end = run.steps.at(-1)!;
    expect(end.status).toBe('completed');
    expect(end.globals.result).toEqual(value(result));
    expect(end.frames).toEqual([]);
    expect(end.activeFrameId).toBeNull();
    // n+1번의 조건 검사와 호출, 비기저 호출마다 3번의 대입과 2번의 산술.
    expect(end.metrics).toEqual({
      calls: n + 1,
      comparisons: n + 1,
      assignments: 3 * n + 2,
      arithmetic: 2 * n,
      maxDepth: n + 1,
    });
  });

  it('n=2를 수작업으로 추적한 사건/코드 줄 순서와 일치한다', () => {
    const run = buildSumRun(2);
    expect(run.steps.map((step) => [step.event, step.source?.line ?? null])).toEqual([
      ['initial', null],
      ['assign', 9],
      ['call', 10],
      ['compare', 2],
      ['assign', 4],
      ['call', 5],
      ['compare', 2],
      ['assign', 4],
      ['call', 5],
      ['compare', 2],
      ['return', 3],
      ['assign', 5],
      ['assign', 6],
      ['return', 7],
      ['assign', 5],
      ['assign', 6],
      ['return', 7],
      ['assign', 10],
      ['complete', null],
    ]);
    const deepest = run.steps[9]!;
    expect(deepest.frames.map((frame) => frame.parameters.n)).toEqual([
      value(2),
      value(1),
      value(0),
    ]);
    expect(deepest.frames.map((frame) => frame.locals.subtotal)).toEqual([
      { kind: 'unset' },
      { kind: 'unset' },
      { kind: 'unset' },
    ]);
    const returned = run.steps[10]!;
    expect(returned.returnInfo).toEqual({
      frameId: 'frame-3',
      targetFrameId: 'frame-2',
      target: { codeId: 'sum-recursive', line: 5 },
      value: value(0),
    });
    expect(returned.frames.map((frame) => frame.id)).toEqual(['frame-1', 'frame-2']);
    expect(returned.frames[1]!.locals.subtotal).toEqual({ kind: 'unset' });
    expect(run.steps[11]!.frames[1]!.locals.subtotal).toEqual(value(0));
    expect(run.steps[11]!.frames[0]!.locals.subtotal).toEqual({ kind: 'unset' });
    expect(
      run.steps.filter((step) => step.event === 'return').map((step) => step.returnValue),
    ).toEqual([value(0), value(1), value(3)]);
  });

  it('화면 코드와 버전·한도·집계 규칙을 메타데이터에 보관한다', () => {
    const run = buildSumRun(4);
    expect(run.metadata.code.lines[8]).toBe('n = 4');
    expect(run.metadata.stepSemantics).toBe('after-event');
    expect(run.metadata.neighborOrder).toBeNull();
    for (const step of run.steps) {
      expect(step.index).toBe(run.steps.indexOf(step));
      if (step.source) expect(step.source.line).toBeGreaterThan(0);
      if (step.source) expect(step.source.line).toBeLessThanOrEqual(run.metadata.code.lines.length);
    }
  });

  it('매 사건의 누적 집계가 해당 연산에서만 증가한다', () => {
    const run = buildSumRun(3);
    for (let i = 1; i < run.steps.length; i++) {
      const current = run.steps[i]!;
      const previous = run.steps[i - 1]!;
      expect(current.metrics.calls - previous.metrics.calls).toBe(current.event === 'call' ? 1 : 0);
      expect(current.metrics.comparisons - previous.metrics.comparisons).toBe(
        current.event === 'compare' ? 1 : 0,
      );
      expect(current.metrics.assignments - previous.metrics.assignments).toBe(
        current.event === 'assign' ? 1 : 0,
      );
      expect(current.metrics.arithmetic - previous.metrics.arithmetic).toBe(
        current.event === 'assign' && [4, 6].includes(current.source!.line) ? 1 : 0,
      );
    }
  });

  it('같은 입력은 같은 실행을 만들고 이전 스냅샷은 변경할 수 없다', () => {
    const first = buildSumRun(2);
    expect(first).toEqual(buildSumRun(2));
    expect(JSON.parse(JSON.stringify(first))).toEqual(first);
    expect(Object.isFrozen(first.steps[2]!.frames[0]!.locals)).toBe(true);
    expect(first.steps[2]!.frames[0]!.locals.smaller).toEqual({ kind: 'unset' });
    expect(() =>
      Reflect.set(first.steps[2]!.frames[0]!.locals, 'smaller', value(999)),
    ).not.toThrow();
    expect(first.steps[2]!.frames[0]!.locals.smaller).toEqual({ kind: 'unset' });
  });

  it('호출 트리는 복귀 후에도 남고 프레임 ID와 부모 관계가 일치한다', () => {
    const run = buildSumRun(2);
    const tree = run.steps.at(-1)!.structures[0]!;
    if (tree.kind !== 'call-tree') throw new Error('호출 트리 누락');
    expect(tree.nodes.map((node) => [node.id, node.parentId, node.state])).toEqual([
      ['frame-1', null, 'returned'],
      ['frame-2', 'frame-1', 'returned'],
      ['frame-3', 'frame-2', 'returned'],
    ]);
  });

  it('단계 한도에 도달하면 마지막 완료 사건의 상태를 유지한다', () => {
    const full = buildSumRun(2);
    const limited = buildSumRun(2, { maxSteps: 5 });
    expect(limited.steps).toHaveLength(5);
    expect(limited.steps.at(-1)!.status).toBe('limit-reached');
    expect(limited.steps.at(-1)!.frames).toEqual(full.steps[3]!.frames);
    expect(limited.steps.at(-1)!.metrics).toEqual(full.steps[3]!.metrics);
    expect(limited.steps.at(-1)!.globals.result).toEqual({ kind: 'unset' });
    expect(buildSumRun(0, { maxSteps: 2 }).steps).toHaveLength(2);
  });

  it('호출 깊이 한도는 새 프레임을 만들기 전에 적용한다', () => {
    const end = buildSumRun(4, { maxDepth: 2 }).steps.at(-1)!;
    expect(end.status).toBe('limit-reached');
    expect(end.frames).toHaveLength(2);
    expect(end.metrics.calls).toBe(2);
    expect(end.metrics.maxDepth).toBe(2);
  });

  it.each(['', ' ', '-1', '1.5', '1e1', '0xA', 'Infinity', '13', '안녕'])(
    '잘못된 입력 %j를 거절한다',
    (raw) => {
      expect(parseSumInput(raw).ok).toBe(false);
    },
  );
  it.each([-1, 1.5, 13, NaN, Infinity])('직접 호출도 잘못된 값 %s를 거절한다', (n) => {
    expect(() => buildSumRun(n)).toThrow(RangeError);
  });
  it('최소 입력과 정수 앞뒤 공백을 허용한다', () => {
    expect(parseSumInput('0')).toEqual({ ok: true, n: 0 });
    expect(parseSumInput(' 12 ')).toEqual({ ok: true, n: 12 });
  });
});
