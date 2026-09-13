import { describe, expect, it } from 'vitest';
import { buildSearchRun, type SearchAlgorithm } from './graph-search';
import { createGraph, graphSamples } from '../structures/graph';
import { createPlayer } from '../player/controller';

const input = { graph: graphSamples.cycle, start: 'A', target: 'F', reverse: false };
const algorithms: SearchAlgorithm[] = ['bfs', 'dfs'];
describe('수작업 추적과 독립된 기대 결과', () => {
  it('BFS의 방문 순서, 최단 경로와 집계', () => {
    const last = buildSearchRun('bfs', input).steps.at(-1)!;
    expect(last.status).toBe('completed');
    expect(last.search).toMatchObject({
      visitOrder: ['A', 'B', 'C', 'D', 'E', 'F'],
      targetPath: ['A', 'C', 'F'],
      frontier: [],
      outcome: 'found',
    });
    expect(last.metrics).toEqual({
      calls: 0,
      comparisons: 19,
      assignments: 24,
      arithmetic: 0,
      maxDepth: 0,
      inserts: 6,
      removes: 6,
      maxSize: 3,
      discoveries: 6,
      visits: 6,
      edgeScans: 12,
      skipped: 7,
      finished: 6,
    });
  });
  it('DFS의 방문·복귀 순서와 최단이 아닌 경로', () => {
    const run = buildSearchRun('dfs', input);
    const last = run.steps.at(-1)!;
    expect(last.search).toMatchObject({
      visitOrder: ['A', 'B', 'D', 'F', 'C', 'E'],
      processed: ['C', 'F', 'D', 'E', 'B', 'A'],
      targetPath: ['A', 'B', 'D', 'F'],
      frontier: [],
      outcome: 'found',
    });
    expect(last.metrics).toEqual({
      calls: 6,
      comparisons: 12,
      assignments: 18,
      arithmetic: 0,
      maxDepth: 5,
      inserts: 0,
      removes: 0,
      maxSize: 5,
      discoveries: 6,
      visits: 6,
      edgeScans: 12,
      skipped: 7,
      finished: 6,
    });
    expect(run.steps.filter((s) => s.event === 'call').map((s) => s.activeFrameId)).toEqual([
      'dfs-1',
      'dfs-2',
      'dfs-3',
      'dfs-4',
      'dfs-5',
      'dfs-6',
    ]);
    expect(last.frames).toEqual([]);
  });
  it('BFS 발견 → 부모 → 삽입 → 삭제 → 방문의 중간 상태', () => {
    const run = buildSearchRun('bfs', input);
    const steps = run.steps;
    expect(steps.slice(0, 7).map((s) => s.event)).toEqual([
      'initial',
      'discover',
      'assign',
      'insert',
      'compare',
      'remove',
      'visit',
    ]);
    expect(steps[1]!.search).toMatchObject({ discovered: ['A'], frontier: [], visitOrder: [] });
    expect(steps[3]!.search!.frontier).toEqual(['A']);
    expect(steps[5]!.search).toMatchObject({ current: 'A', frontier: [], visitOrder: [] });
    expect(steps[5]!.globals.u).toEqual({ kind: 'value', value: 'A' });
    expect(steps[5]!.returnValue).toEqual({ kind: 'value', value: 'A' });
    expect(steps[5]!.structures.find((s) => s.kind === 'sequence')!.removedValues).toEqual(['A']);
    const enqueuedE = steps.find((s) => s.event === 'insert' && s.search!.frontier.at(-1) === 'E')!;
    expect(enqueuedE.search!.frontier).toEqual(['C', 'D', 'E']);
    expect(enqueuedE.search!.current).toBe('B');
    const structure = enqueuedE.structures.find((s) => s.kind === 'sequence')!;
    expect(structure.pointers).toEqual({ Front: 0, Rear: 2 });
    expect(structure.items).toEqual(['C', 'D', 'E']);
  });
  it('DFS 프레임별 지역 변수와 실제 반환 직후 복귀 대상', () => {
    const run = buildSearchRun('dfs', input);
    const callC = run.steps.find((s) => s.event === 'call' && s.search!.current === 'C')!;
    expect(callC.frames.map((f) => f.parameters.u)).toEqual(
      ['A', 'B', 'D', 'F', 'C'].map((v) => ({ kind: 'value', value: v })),
    );
    expect(callC.frames.at(-1)!.locals.v).toEqual({ kind: 'unset' });
    expect(callC.frames[0]!.locals.v).toEqual({ kind: 'value', value: 'B' });
    const returned = run.steps.find((s) => s.event === 'return')!;
    expect(returned.search).toMatchObject({
      current: 'F',
      frontier: ['A', 'B', 'D', 'F'],
      processed: ['C'],
      discovered: ['A', 'B', 'D', 'F', 'C'],
    });
    expect(returned.returnInfo).toMatchObject({
      frameId: 'dfs-5',
      targetFrameId: 'dfs-4',
      value: { kind: 'none' },
      target: { line: run.metadata.lineMap.call },
    });
    expect(returned.frames.at(-1)!.locals.v).toEqual({ kind: 'value', value: 'C' });
    expect(returned.source?.line).toBe(run.metadata.lineMap.return);
  });
  it.each(algorithms)('%s의 코드 행과 매 사건의 지표 증가', (algorithm) => {
    const run = buildSearchRun(algorithm, input);
    for (let i = 1; i < run.steps.length; i++) {
      const step = run.steps[i]!;
      const before = run.steps[i - 1]!;
      const bumps: Record<string, string> = {
        call: 'calls',
        discover: 'discoveries',
        visit: 'visits',
        edge: 'edgeScans',
        process: 'finished',
        insert: 'inserts',
        remove: 'removes',
        compare: 'comparisons',
      };
      const metric = bumps[step.event];
      if (metric)
        expect(
          step.metrics[metric as keyof typeof step.metrics]! -
            before.metrics[metric as keyof typeof step.metrics]!,
        ).toBe(1);
      if (step.source) {
        const line = run.metadata.code.lines[step.source.line - 1]!;
        if (step.event === 'discover') expect(line).toContain('visited.add(');
        if (step.event === 'visit') expect(line).toContain('order.append(u)');
        if (step.event === 'call') expect(line.trim()).toMatch(/^dfs\(/);
        if (step.event === 'return') expect(line.trim()).toBe('return');
        if (step.event === 'edge') expect(line).toContain('for v in adj[u]');
        if (step.event === 'process') expect(line).toContain('processed.append(u)');
      } else expect(step.event).toBe('complete');
    }
  });
  it.each(algorithms)('%s는 단절 그래프의 도달 불가를 정상 종료 시에만 확정한다', (algorithm) => {
    const run = buildSearchRun(algorithm, { ...input, graph: graphSamples.disconnected });
    expect(run.steps.at(-1)!.search).toMatchObject({
      visitOrder: ['A', 'B', 'C'],
      targetPath: [],
      outcome: 'unreachable',
    });
    expect(run.steps.slice(0, -1).every((s) => s.search!.outcome === 'pending')).toBe(true);
  });
  it('방향과 이웃 방문 순서', () => {
    expect(
      buildSearchRun('bfs', { ...input, reverse: true }).steps.at(-1)!.search!.visitOrder,
    ).toEqual(['A', 'C', 'B', 'F', 'E', 'D']);
    expect(
      buildSearchRun('dfs', { ...input, reverse: true }).steps.at(-1)!.search!.visitOrder,
    ).toEqual(['A', 'C', 'F', 'D', 'B', 'E']);
    const run = buildSearchRun('bfs', {
      ...input,
      graph: graphSamples.directed,
      start: 'D',
      target: 'A',
    });
    expect(run.steps.at(-1)!.search).toMatchObject({ visitOrder: ['D'], outcome: 'unreachable' });
  });
  it.each(algorithms)('%s 한 정점, 시작=목표, 목표 없음, 완전 그래프의 중복 방지', (algorithm) => {
    const single = buildSearchRun(algorithm, {
      ...input,
      graph: createGraph(['A'], [], true),
      target: 'A',
    }).steps.at(-1)!;
    expect(single.search).toMatchObject({
      targetPath: ['A'],
      distances: { A: 0 },
      outcome: 'found',
    });
    const vertices = 'ABCDEFGH'.split('');
    const graph = createGraph(
      vertices,
      vertices.flatMap((a) =>
        vertices.filter((b) => a !== b).map((b) => [a, b] as [string, string]),
      ),
      true,
    );
    const last = buildSearchRun(algorithm, { ...input, graph, target: null }).steps.at(-1)!;
    expect(last.status).toBe('completed');
    expect(last.metrics.edgeScans).toBe(56);
    expect(last.metrics.discoveries).toBe(8);
    expect(last.metrics.skipped).toBe(49);
    expect(last.search!.outcome).toBe('traversed');
  });
  it.each(algorithms)('%s 한도 도달은 마지막으로 기록한 상태를 유지한다', (algorithm) => {
    const full = buildSearchRun(algorithm, input);
    const short = buildSearchRun(algorithm, { ...input, maxSteps: 10 });
    expect(short.steps).toHaveLength(10);
    expect(short.steps.at(-1)!).toMatchObject({
      status: 'limit-reached',
      event: 'limit',
      source: null,
      search: full.steps[8]!.search,
      metrics: full.steps[8]!.metrics,
      frames: full.steps[8]!.frames,
    });
    expect(short.steps.at(-1)!.search!.outcome).toBe('pending');
  });
  it.each(algorithms)('%s 결정성·JSON·동결·재생 왕복', (algorithm) => {
    const run = buildSearchRun(algorithm, input);
    expect(buildSearchRun(algorithm, input)).toEqual(run);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    expect(Object.isFrozen(run.steps[1]!.search!.discovered)).toBe(true);
    expect(run.steps[1]!.search!.discovered).toEqual(algorithm === 'bfs' ? ['A'] : []);
    const player = createPlayer(run);
    player.seek(12);
    const before = player.getSnapshot();
    player.previous();
    player.next();
    expect(player.getSnapshot()).toEqual(before);
    player.reset();
    expect(player.getSnapshot().index).toBe(0);
    player.dispose();
  });
  it('검증한 트리만 Step 구조에 포함한다', () => {
    const run = buildSearchRun('bfs', { ...input, graph: graphSamples.tree, treeRoot: 'A' });
    expect(run.steps[0]!.structures.find((s) => s.kind === 'tree')?.info.array).toEqual([
      null,
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ]);
    expect(() => buildSearchRun('dfs', { ...input, treeRoot: 'A' })).toThrow();
    expect(() => buildSearchRun('bfs', { ...input, start: 'Z' })).toThrow();
    expect(() => buildSearchRun('bfs', { ...input, target: 'Z' })).toThrow();
    expect(() => buildSearchRun('bfs', { ...input, maxSteps: 501 })).toThrow();
  });
});
