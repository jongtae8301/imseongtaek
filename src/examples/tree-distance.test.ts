import { describe, expect, it } from 'vitest';
import { buildTreeDistanceRun, type DistanceMethod } from './tree-distance';
import { createGraph, graphSamples, type Graph } from '../structures/graph';
import type { Snapshot } from '../engine/types';
import { createPlayer } from '../player/controller';

const base = { graph: graphSamples.textbookTree, root: 'A', from: 'D', to: 'E' };
const methods: DistanceMethod[] = ['depth', 'array'];
const trace = (step: Snapshot) => step.structures.find((s) => s.kind === 'tree-distance')!;

// 부모 포인터/깊이/이진 배열을 사용하지 않는 독립 기준: 무방향 간선의 BFS 경로.
function referencePath(graph: Graph, from: string, to: string): string[] {
  const queue = [[from]];
  const seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    const current = path.at(-1)!;
    if (current === to) return path;
    for (const [a, b] of graph.edges) {
      const next = a === current ? b : b === current ? a : null;
      if (next !== null && !seen.has(next)) {
        seen.add(next);
        queue.push([...path, next]);
      }
    }
  }
  throw new Error('기준 그래프가 연결되어 있지 않습니다.');
}

describe('트리 거리·공통 조상', () => {
  it.each(methods)('%s: 교과서 49개 노드 쌍의 거리와 경로를 독립 BFS와 대조', (method) => {
    for (const from of base.graph.vertices)
      for (const to of base.graph.vertices) {
        const run = buildTreeDistanceRun({ ...base, from, to, method });
        const last = run.steps.at(-1)!;
        const expected = referencePath(base.graph, from, to);
        expect(last.status).toBe('completed');
        expect(trace(last).path).toEqual(expected);
        expect(trace(last).distance).toBe(expected.length - 1);
        // 교과서 노드들의 알려진 깊이로 경로상의 가장 얕은 정점을 독립 확인.
        const depths: Record<string, number> = { A: 0, B: 1, C: 1, D: 2, E: 2, F: 3, G: 3 };
        expect(trace(last).lca).toBe(expected.reduce((a, b) => (depths[a]! < depths[b]! ? a : b)));
        expect(run.metadata.neighborOrder).toBeNull();
      }
  });

  it('깊이가 같은 D/E에서 종료하지 않고 D→B, E→B로 이동한다', () => {
    const run = buildTreeDistanceRun({ ...base, method: 'depth' });
    const steps = run.steps;
    expect(trace(steps[0]!)).toMatchObject({ a: null, b: null, distance: null, lca: null });
    expect(steps[0]!.globals.distance).toEqual({ kind: 'unset' });
    expect(trace(steps[3]!)).toMatchObject({ a: 'D', b: 'E', distance: 0 });
    expect(trace(steps[6]!)).toMatchObject({
      a: 'B',
      b: 'E',
      distance: 0,
      currentEdge: ['D', 'B'],
      trailA: ['D', 'B'],
      path: [],
    });
    expect(steps[6]!.metrics).toMatchObject({ iterations: 1, arithmetic: 0 });
    expect(steps[6]!.source?.line).toBe(run.metadata.lineMap['move-a']);
    expect(trace(steps[7]!).distance).toBe(1);
    expect(steps[7]!.source?.line).toBe(run.metadata.lineMap.increment);
    expect(trace(steps[10]!)).toMatchObject({
      a: 'B',
      b: 'B',
      distance: 1,
      lca: null,
      currentEdge: ['E', 'B'],
    });
    expect(trace(steps[12]!)).toMatchObject({ distance: 2, lca: null, path: [] });
    expect(trace(steps[13]!)).toMatchObject({ lca: 'B', path: ['D', 'B', 'E'] });
    expect(steps.at(-1)!.metrics).toEqual({
      calls: 0,
      comparisons: 5,
      assignments: 8,
      arithmetic: 2,
      maxDepth: 0,
      iterations: 2,
    });
  });

  it('배열 방식은 큰 인덱스 E(5)부터 B(2)로 이동하며 같은 결과를 얻는다', () => {
    const run = buildTreeDistanceRun({ ...base, method: 'array' });
    expect(trace(run.steps[6]!)).toMatchObject({
      a: 'D',
      b: 'B',
      distance: 0,
      currentEdge: ['E', 'B'],
    });
    expect(run.steps[6]!.source?.line).toBe(run.metadata.lineMap['move-b']);
    expect(run.steps[6]!.metrics.arithmetic).toBe(1);
    expect(run.steps.at(-1)!.metrics).toMatchObject({
      comparisons: 5,
      assignments: 8,
      arithmetic: 4,
      iterations: 2,
    });
    expect(trace(run.steps.at(-1)!)).toMatchObject({
      distance: 2,
      lca: 'B',
      path: ['D', 'B', 'E'],
    });
  });

  it.each(methods)('%s: 같은 노드는 거리 0·자기 자신이 LCA, 이동은 없음', (method) => {
    const run = buildTreeDistanceRun({ ...base, from: 'G', to: 'G', method });
    expect(trace(run.steps.at(-1)!)).toMatchObject({ distance: 0, lca: 'G', path: ['G'] });
    expect(run.steps.at(-1)!.metrics).toMatchObject({
      comparisons: 1,
      assignments: 4,
      arithmetic: 0,
      iterations: 0,
    });
  });

  it.each(methods)('%s: 루트만 있는 최소 입력, 편향 트리 최대 입력과 비알파벳 순서', (method) => {
    const vertices = ['Z', 'C', 'Y', 'B', 'X', 'A', 'W', 'D'];
    const chain = createGraph(
      vertices,
      vertices.slice(1).map((v, i) => [vertices[i]!, v]),
      true,
    );
    const run = buildTreeDistanceRun({ graph: chain, root: 'Z', from: 'D', to: 'Z', method });
    expect(trace(run.steps.at(-1)!)).toMatchObject({
      distance: 7,
      lca: 'Z',
      path: [...vertices].reverse(),
    });
    expect(run.steps.at(-1)!.metrics.iterations).toBe(7);
    const one = buildTreeDistanceRun({
      graph: createGraph(['Z'], [], true),
      root: 'Z',
      from: 'Z',
      to: 'Z',
      method,
    });
    expect(trace(one.steps.at(-1)!)).toMatchObject({ distance: 0, lca: 'Z', path: ['Z'] });
  });

  it('일반 트리의 모든 노드 쌍도 깊이 방식으로 계산한다', () => {
    const graph = graphSamples.generalTree;
    for (const from of graph.vertices)
      for (const to of graph.vertices) {
        const last = buildTreeDistanceRun({ graph, root: 'A', from, to, method: 'depth' }).steps.at(
          -1,
        )!;
        expect(trace(last).path).toEqual(referencePath(graph, from, to));
      }
    expect(() => buildTreeDistanceRun({ ...base, graph, method: 'array' })).toThrow('이진 트리');
  });

  it.each(methods)('%s: 코드 줄과 사건별 집계·변경 값이 일치한다', (method) => {
    const run = buildTreeDistanceRun({ ...base, from: 'G', to: 'C', method });
    for (let i = 1; i < run.steps.length; i++) {
      const step = run.steps[i]!,
        before = run.steps[i - 1]!;
      const key = Object.entries(run.metadata.lineMap).find(
        ([, line]) => line === step.source?.line,
      )?.[0];
      const moving = key === 'move-a' || key === 'move-b';
      expect(step.metrics.comparisons - before.metrics.comparisons).toBe(
        step.event === 'compare' ? 1 : 0,
      );
      expect(step.metrics.assignments - before.metrics.assignments).toBe(
        step.event === 'assign' ? 1 : 0,
      );
      expect(step.metrics.arithmetic - before.metrics.arithmetic).toBe(
        key === 'increment' || (moving && method === 'array') ? 1 : 0,
      );
      expect(step.metrics.iterations! - before.metrics.iterations!).toBe(moving ? 1 : 0);
      if (step.event === 'assign') {
        const variable = step.changes[0]!.path.replace('globals.', '');
        expect(step.changes[0]!.before).toEqual(before.globals[variable]);
        expect(step.changes[0]!.after).toEqual(step.globals[variable]);
      }
      expect(step.search).toBeNull();
      expect(step.frames).toEqual([]);
    }
  });

  it.each(methods)(
    '%s: 모든 중단 지점에서 직전 상태를 보존하고 결과를 조기 확정하지 않는다',
    (method) => {
      const full = buildTreeDistanceRun({ ...base, method });
      for (let maxSteps = 2; maxSteps < full.steps.length; maxSteps++) {
        const run = buildTreeDistanceRun({ ...base, method, maxSteps });
        expect(run.steps).toHaveLength(maxSteps);
        const last = run.steps.at(-1)!,
          previous = run.steps.at(-2)!;
        expect(last.status).toBe('limit-reached');
        expect(last.source).toBeNull();
        expect(last.structures).toEqual(previous.structures);
        expect(last.metrics).toEqual(previous.metrics);
        expect(last.globals.lca).toEqual({ kind: 'unset' });
        expect(trace(last).path).toEqual([]);
      }
    },
  );

  it('재현성·JSON·깊은 동결·재생 왕복·처음으로·입력 변경 초기화', () => {
    const run = buildTreeDistanceRun({ ...base, method: 'depth' });
    expect(run).toEqual(buildTreeDistanceRun({ ...base, method: 'depth' }));
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    expect(Object.isFrozen(trace(run.steps[6]!).trailA)).toBe(true);
    const player = createPlayer(run);
    player.seek(7);
    const saved = player.getSnapshot();
    player.previous();
    player.next();
    expect(player.getSnapshot()).toEqual(saved);
    player.reset();
    expect(player.getSnapshot().index).toBe(0);
    player.play();
    player.load(null);
    expect(player.getSnapshot()).toMatchObject({ playing: false, index: 0, run: null });
    player.dispose();
  });

  it('잘못된 입력의 원인과 수정 방법을 한국어로 안내한다', () => {
    for (const maxSteps of [0, 1, 101, NaN, 2.5])
      expect(() => buildTreeDistanceRun({ ...base, method: 'depth', maxSteps })).toThrow('2–100');
    expect(() => buildTreeDistanceRun({ ...base, from: 'H', method: 'depth' })).toThrow(
      '등록된 정점',
    );
    expect(() => buildTreeDistanceRun({ ...base, root: 'D', method: 'depth' })).toThrow(
      '루트는 부모가 없어야',
    );
    expect(() =>
      buildTreeDistanceRun({ ...base, graph: graphSamples.cycle, method: 'depth' }),
    ).toThrow('부모→자식');
    const cycle = createGraph(
      ['A', 'B', 'C'],
      [
        ['B', 'C'],
        ['C', 'B'],
      ],
      true,
    );
    expect(() =>
      buildTreeDistanceRun({ ...base, graph: cycle, from: 'B', to: 'C', method: 'depth' }),
    ).toThrow('분리된 사이클');
    const twoParents = createGraph(
      ['A', 'B', 'C'],
      [
        ['A', 'B'],
        ['A', 'C'],
        ['B', 'C'],
      ],
      true,
    );
    expect(() =>
      buildTreeDistanceRun({ ...base, graph: twoParents, from: 'B', to: 'C', method: 'depth' }),
    ).toThrow('부모가 정확히 하나');
  });
});
