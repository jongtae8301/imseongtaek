import { describe, expect, it } from 'vitest';
import {
  buildFunctionComparison,
  buildFunctionRun,
  parseFunctionInput,
  type FunctionMethod,
  type FunctionProblem,
} from './functions';
import { createPlayer } from '../player/controller';

const methods: FunctionMethod[] = ['recursive', 'iterative'];
const cases: [Exclude<FunctionProblem, 'scope'>, number, number][] = [
  ['sum', 0, 0],
  ['sum', 1, 1],
  ['sum', 4, 10],
  ['sum', 12, 78],
  ['factorial', 0, 1],
  ['factorial', 1, 1],
  ['factorial', 4, 24],
  ['factorial', 12, 479001600],
  ['fibonacci', 0, 0],
  ['fibonacci', 1, 1],
  ['fibonacci', 2, 1],
  ['fibonacci', 4, 3],
  ['fibonacci', 6, 8],
  ['fibonacci', 8, 21],
];
describe.each(methods)('%s 방식의 알려진 수학 결과', (method) => {
  it.each(cases)('%s(%i) = %i', (problem, n, expected) => {
    const run = buildFunctionRun(problem, method, n),
      last = run.steps.at(-1)!;
    expect(last.status).toBe('completed');
    expect(last.globals.result).toEqual({ kind: 'value', value: expected });
    expect(last.frames).toEqual([]);
    expect(run.steps.length).toBeLessThanOrEqual(run.metadata.limits.maxSteps);
    const tree = last.structures.find((s) => s.kind === 'call-tree')!;
    expect(tree.nodes.every((node) => node.state === 'returned')).toBe(true);
    expect(tree.nodes.length).toBe(last.metrics.calls);
  });
});

describe('일반 함수의 변수 범위와 None 반환', () => {
  it('매개 변수 total 변경은 전역을 바꾸지 않고 global 이후 대입만 전역을 바꾼다', () => {
    const run = buildFunctionRun('scope', 'recursive', 4),
      steps = run.steps;
    expect(steps.map((s) => s.event)).toEqual([
      'initial',
      'assign',
      'assign',
      'call',
      'call',
      'assign',
      'assign',
      'return',
      'assign',
      'call',
      'scope',
      'assign',
      'return',
      'assign',
      'return',
      'assign',
      'complete',
    ]);
    expect(steps[6]!.globals.total).toEqual({ kind: 'value', value: 10 });
    expect(steps[6]!.frames.at(-1)!.parameters.total).toEqual({ kind: 'value', value: 14 });
    expect(steps[6]!.changes[0]!.path).toBe('frames.frame-2.parameters.total');
    expect(steps[8]!.frames[0]!.locals.preview).toEqual({ kind: 'value', value: 14 });
    expect(steps[10]!.globals.total).toEqual({ kind: 'value', value: 10 });
    expect(steps[10]!.metrics.assignments).toBe(5);
    expect(steps[11]!.globals.total).toEqual({ kind: 'value', value: 14 });
    expect(steps[11]!.changes[0]!.path).toBe('globals.total');
    expect(steps[12]!.returnInfo).toMatchObject({
      frameId: 'frame-3',
      targetFrameId: 'frame-1',
      target: { line: run.metadata.lineMap.globalCall },
      value: { kind: 'none' },
    });
    expect(steps[12]!.frames[0]!.locals.receipt).toEqual({ kind: 'unset' });
    expect(steps[13]!.frames[0]!.locals.receipt).toEqual({ kind: 'none' });
    expect(steps[16]!.metrics).toEqual({
      calls: 3,
      comparisons: 0,
      assignments: 8,
      arithmetic: 2,
      maxDepth: 2,
      iterations: 0,
    });
    expect(steps[16]!.globals.result).toEqual({ kind: 'value', value: 14 });
  });
  it('0 입력과 다시 실행할 때 전역 초기화', () => {
    const zero = buildFunctionRun('scope', 'recursive', 0);
    expect(zero.steps.at(-1)!.globals).toEqual({
      n: { kind: 'value', value: 0 },
      total: { kind: 'value', value: 10 },
      result: { kind: 'value', value: 10 },
    });
    buildFunctionRun('scope', 'recursive', 12);
    expect(buildFunctionRun('scope', 'recursive', 0)).toEqual(zero);
  });
});

describe('다중 재귀와 반복의 중간 상태', () => {
  it('fib(4)는 n−2 호출을 마친 뒤 n−1을 호출한다', () => {
    const run = buildFunctionRun('fibonacci', 'recursive', 4);
    expect(
      run.steps.filter((s) => s.event === 'call').map((s) => s.frames.at(-1)!.parameters.n),
    ).toEqual([4, 2, 0, 1, 3, 1, 2, 0, 1].map((n) => ({ kind: 'value', value: n })));
    const right = run.steps.find((s) => s.event === 'call' && s.activeFrameId === 'frame-5')!;
    expect(right.frames[0]!.locals).toMatchObject({
      left: { kind: 'value', value: 1 },
      right: { kind: 'unset' },
      first_n: { kind: 'value', value: 2 },
      second_n: { kind: 'value', value: 3 },
    });
    const firstReturn = run.steps.find((s) => s.event === 'return')!;
    expect(firstReturn.returnValue).toEqual({ kind: 'value', value: 0 });
    expect(firstReturn.activeFrameId).toBe('frame-2');
    expect(firstReturn.frames.at(-1)!.locals.left).toEqual({ kind: 'unset' });
    expect(firstReturn.source?.line).toBe(run.metadata.lineMap.baseReturn);
    const after = run.steps[firstReturn.index + 1]!;
    expect(after.source?.line).toBe(run.metadata.lineMap.left);
    expect(after.frames.at(-1)!.locals.left).toEqual({ kind: 'value', value: 0 });
    const final = run.steps.at(-1)!;
    expect(final.metrics).toEqual({
      calls: 9,
      comparisons: 9,
      assignments: 22,
      arithmetic: 12,
      maxDepth: 4,
      iterations: 0,
    });
    expect(
      final.structures
        .find((s) => s.kind === 'call-tree')!
        .nodes.filter((n) => n.parentId === 'frame-1')
        .map((n) => n.label),
    ).toEqual(['fib(2)', 'fib(3)']);
  });
  it('피보나치 반복은 이전 a·b를 단계별로 이동하고 i=0부터 시작한다', () => {
    const run = buildFunctionRun('fibonacci', 'iterative', 2);
    const next = run.steps.find((s) => s.source?.line === run.metadata.lineMap.next)!;
    expect(next.frames[0]!.locals).toEqual({
      a: { kind: 'value', value: 0 },
      b: { kind: 'value', value: 1 },
      i: { kind: 'value', value: 0 },
      next_value: { kind: 'value', value: 1 },
    });
    const shift = run.steps[next.index + 1]!;
    expect(shift.frames[0]!.locals.a).toEqual({ kind: 'value', value: 1 });
    const finalCondition = run.steps.filter((s) => s.event === 'compare').at(-1)!;
    expect(finalCondition.explanation).toContain('2 < 2');
    expect(finalCondition.explanation).toContain('거짓');
    expect(run.steps.at(-1)!.metrics).toEqual({
      calls: 1,
      comparisons: 3,
      assignments: 13,
      arithmetic: 4,
      maxDepth: 1,
      iterations: 2,
    });
  });
  it.each(['sum', 'factorial'] as const)('%s 반복은 1부터 n까지 누적한다', (problem) => {
    const run = buildFunctionRun(problem, 'iterative', 4),
      last = run.steps.at(-1)!;
    expect(last.metrics).toEqual({
      calls: 1,
      comparisons: 5,
      assignments: 12,
      arithmetic: 8,
      maxDepth: 1,
      iterations: 4,
    });
    expect(
      run.steps
        .filter((s) => s.source?.line === run.metadata.lineMap.total)
        .map((s) => s.frames[0]!.locals.total),
    ).toEqual(
      (problem === 'sum' ? [1, 3, 6, 10] : [1, 2, 6, 24]).map((n) => ({ kind: 'value', value: n })),
    );
  });
  it('팩토리얼 종료 조건과 누적 비용', () => {
    const run = buildFunctionRun('factorial', 'recursive', 4),
      last = run.steps.at(-1)!;
    expect(last.metrics).toEqual({
      calls: 5,
      comparisons: 5,
      assignments: 14,
      arithmetic: 8,
      maxDepth: 5,
      iterations: 0,
    });
    const base = run.steps.find((s) => s.event === 'return')!;
    expect(base.returnValue).toEqual({ kind: 'value', value: 1 });
    expect(run.steps).toHaveLength(31);
  });
});

describe('계약·재현성·한도·비교', () => {
  it.each(['factorial', 'fibonacci', 'scope'] as const)(
    '%s 스냅샷은 이후 실행에 영향을 받지 않는다',
    (problem) => {
      const run = buildFunctionRun(problem, 'recursive', 4);
      expect(buildFunctionRun(problem, 'recursive', 4)).toEqual(run);
      expect(JSON.parse(JSON.stringify(run))).toEqual(run);
      const call = run.steps.find((s) => s.event === 'call')!;
      expect(Object.isFrozen(call.frames[0]!.parameters)).toBe(true);
      expect(call.globals.result).toEqual({ kind: 'unset' });
      const player = createPlayer(run);
      player.seek(10);
      const previous = player.getSnapshot();
      player.previous();
      player.next();
      expect(player.getSnapshot()).toEqual(previous);
      player.reset();
      expect(player.getSnapshot().index).toBe(0);
      player.dispose();
      for (let i = 1; i < run.steps.length; i++) {
        const step = run.steps[i]!,
          before = run.steps[i - 1]!;
        expect(step.metrics.calls - before.metrics.calls).toBe(step.event === 'call' ? 1 : 0);
        expect(step.metrics.assignments - before.metrics.assignments).toBe(
          step.event === 'assign' ? 1 : 0,
        );
        expect(step.metrics.comparisons - before.metrics.comparisons).toBe(
          step.event === 'compare' ? 1 : 0,
        );
        expect(step.frames.filter((f) => f.id === step.activeFrameId)).toHaveLength(
          step.activeFrameId ? 1 : 0,
        );
        expect(step.frames.length).toBeLessThanOrEqual(step.metrics.maxDepth);
        if (step.source) {
          const line = run.metadata.code.lines[step.source.line - 1]!;
          if (step.event === 'return') expect(line.trim()).toMatch(/^return/);
          if (step.event === 'assign') expect(line).toContain(' = ');
          if (step.event === 'scope') expect(line.trim()).toBe('global total');
        }
      }
    },
  );
  it.each(['sum', 'factorial', 'fibonacci'] as const)(
    '%s의 두 방식에 같은 입력과 한도를 적용한다',
    (problem) => {
      const comparison = buildFunctionComparison(problem, 4);
      expect(comparison.sameResult).toBe(true);
      expect(comparison.recursive.metadata.input).toEqual(comparison.iterative.metadata.input);
      expect(comparison.recursive.metadata.limits).toEqual(comparison.iterative.metadata.limits);
      expect(comparison.iterative.steps.at(-1)!.metrics.maxDepth).toBe(1);
    },
  );
  it('한도 도달을 부분 결과 일치나 정상 종료로 보고하지 않는다', () => {
    const full = buildFunctionRun('fibonacci', 'recursive', 8);
    expect(full.steps).toHaveLength(370);
    expect(full.steps.at(-1)!.metrics.calls).toBe(67);
    const short = buildFunctionRun('fibonacci', 'recursive', 8, { maxSteps: 20 });
    expect(short.steps).toHaveLength(20);
    expect(short.steps.at(-1)!).toMatchObject({
      status: 'limit-reached',
      frames: full.steps[18]!.frames,
      metrics: full.steps[18]!.metrics,
      source: null,
    });
    const comparison = buildFunctionComparison('fibonacci', 8, { maxSteps: 50 });
    expect(comparison.recursive.steps.at(-1)!.status).toBe('limit-reached');
    expect(comparison.iterative.steps.at(-1)!.status).toBe('completed');
    expect(comparison.sameResult).toBe(null);
    expect(buildFunctionRun('scope', 'recursive', 4, { maxDepth: 1 }).steps.at(-1)!).toMatchObject({
      status: 'limit-reached',
      activeFrameId: 'frame-1',
    });
    expect(
      buildFunctionRun('scope', 'recursive', 4, { maxSteps: 2 }).steps.at(-1)!.globals.n,
    ).toEqual({ kind: 'unset' });
  });
  it.each(['', '-1', '1.5', '1e2', 'NaN', 'Infinity', '99999999999999999', '9'])(
    '피보나치 입력 %j 거절',
    (raw) => expect(parseFunctionInput('fibonacci', raw).ok).toBe(false),
  );
  it('각 예제의 입력 한도와 실행 한도를 검증한다', () => {
    expect(parseFunctionInput('factorial', '12')).toEqual({ ok: true, n: 12 });
    expect(parseFunctionInput('fibonacci', ' 0 ')).toEqual({ ok: true, n: 0 });
    expect(() => buildFunctionRun('fibonacci', 'recursive', 9)).toThrow();
    expect(() => buildFunctionRun('factorial', 'recursive', 13)).toThrow();
    expect(() => buildFunctionRun('scope', 'iterative', 4)).toThrow();
    expect(() => buildFunctionRun('sum', 'recursive', 4, { maxSteps: 501 })).toThrow();
    expect(() => buildFunctionRun('fibonacci', 'recursive', 4, { maxDepth: 0 })).toThrow();
  });
});
