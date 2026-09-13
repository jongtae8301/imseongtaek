import { TraceLimit, TraceRecorder } from '../engine/trace';
import {
  unset,
  value,
  type Change,
  type ExecutionRun,
  type RunMetadata,
  type StepEvent,
  type StepState,
  type TreeDistanceStructure,
} from '../engine/types';
import { createGraph, treeInfo, type Graph, type TreeInfo } from '../structures/graph';
import type { Lesson } from './lesson';

export type DistanceMethod = TreeDistanceStructure['method'];
export interface TreeDistanceInput {
  graph: Graph;
  root: string;
  from: string;
  to: string;
  method: DistanceMethod;
  maxSteps?: number;
}

function sourceCode(tree: TreeInfo, input: TreeDistanceInput) {
  const lines: string[] = [];
  const lineMap: Record<string, number> = {};
  const add = (key: string, line: string) => {
    lines.push(line);
    lineMap[key] = lines.length;
  };
  const mapping = (key: string, values: (string | number | null)[]) =>
    add(
      key,
      `${key} = {${tree.nodes.map((n, i) => `'${n.vertex}': ${values[i] === null ? 'None' : JSON.stringify(values[i])}`).join(', ')}}`,
    );
  if (input.method === 'array') {
    add('nodes', `nodes = [${tree.array.map((v) => (v === null ? 'None' : `'${v}'`)).join(', ')}]`);
    mapping(
      'position',
      tree.nodes.map((n) => n.arrayIndex),
    );
  } else {
    mapping(
      'parent',
      tree.nodes.map((n) => n.parent),
    );
    mapping(
      'depth',
      tree.nodes.map((n) => n.depth),
    );
  }
  add('a', `a = '${input.from}'`);
  add('b', `b = '${input.to}'`);
  add('distance', 'distance = 0');
  add('while', 'while a != b:');
  add(
    'compare',
    input.method === 'array' ? '    if position[a] > position[b]:' : '    if depth[a] >= depth[b]:',
  );
  add(
    'move-a',
    input.method === 'array' ? '        a = nodes[position[a] // 2]' : '        a = parent[a]',
  );
  add('else', '    else:');
  add(
    'move-b',
    input.method === 'array' ? '        b = nodes[position[b] // 2]' : '        b = parent[b]',
  );
  add('increment', '    distance = distance + 1');
  add('lca', 'lca = a');
  return { lines, lineMap };
}

/** 방향 간선을 변경하지 않고 검증된 부모 관계를 올라간다. 결과/경로는 실행기에서만 만든다. */
export function buildTreeDistanceRun(input: TreeDistanceInput): ExecutionRun {
  const graph = createGraph(input.graph.vertices, input.graph.edges, input.graph.directed);
  const tree = treeInfo(graph, input.root);
  if (!graph.vertices.includes(input.from) || !graph.vertices.includes(input.to))
    throw new Error('거리의 두 노드는 등록된 정점 중에서 선택해 주세요.');
  if (input.method !== 'depth' && input.method !== 'array')
    throw new Error('지원하는 거리 계산 방법을 선택해 주세요.');
  if (input.method === 'array' && !tree.binary)
    throw new Error(
      '배열 인덱스 방식은 이진 트리에만 적용합니다. 깊이 비교 방식을 선택하거나 자식 수를 두 개 이하로 수정해 주세요.',
    );
  const maxSteps = input.maxSteps ?? 100;
  if (!Number.isInteger(maxSteps) || maxSteps < 2 || maxSteps > 100)
    throw new Error('거리 실행 한도는 2–100단계여야 합니다.');
  const { lines, lineMap } = sourceCode(tree, input);
  const codeId = `tree-distance-${input.method}`;
  const metadata: RunMetadata = {
    exampleId: codeId,
    input: {
      graph: { directed: graph.directed, vertices: graph.vertices, edges: graph.edges },
      root: input.root,
      from: input.from,
      to: input.to,
      method: input.method,
    },
    algorithmVersion: '1.0.0',
    code: { id: codeId, language: 'python', lines },
    lineMap,
    neighborOrder: null,
    stepSemantics: 'after-event',
    limits: { maxSteps, maxDepth: 0, maxInput: 8 },
    metricRules: {
      calls: '함수 호출: 반복 구현으로 별도 함수 호출은 0회입니다.',
      comparisons: '비교: while의 두 노드 비교(마지막 거짓 포함)와 if의 깊이/인덱스 비교마다 1회.',
      assignments:
        '대입: a·b·distance·lca의 실행된 대입마다 1회. 준비된 부모·깊이·배열은 제외합니다.',
      arithmetic:
        input.method === 'array'
          ? '산술: 부모 인덱스 // 2와 distance + 1을 각각 1회.'
          : '산술: distance + 1마다 1회. 부모 조회는 산술이 아닙니다.',
      maxDepth: '최대 호출 깊이: 반복 구현이므로 0개 프레임입니다.',
      iterations:
        '반복 몸체: a 또는 b가 부모로 이동할 때 1회. 다음 distance 대입 전에는 누적 거리보다 1 클 수 있습니다.',
    },
  };
  const recorder = new TraceRecorder(metadata);
  const trace: TreeDistanceStructure = {
    kind: 'tree-distance',
    id: 'distance',
    method: input.method,
    from: input.from,
    to: input.to,
    a: null,
    b: null,
    distance: null,
    lca: null,
    trailA: [],
    trailB: [],
    currentEdge: null,
    path: [],
  };
  const parent = Object.fromEntries(tree.nodes.map((n) => [n.vertex, n.parent]));
  const depth = Object.fromEntries(tree.nodes.map((n) => [n.vertex, n.depth]));
  const position = Object.fromEntries(tree.nodes.map((n) => [n.vertex, n.arrayIndex]));
  const state: StepState = {
    source: null,
    activeFrameId: null,
    frames: [],
    globals: {
      ...(input.method === 'depth'
        ? { parent: value(parent), depth: value(depth) }
        : { nodes: value(tree.array), position: value(position) }),
      a: unset(),
      b: unset(),
      distance: unset(),
      lca: unset(),
    },
    returnValue: unset(),
    returnInfo: null,
    structures: [
      { kind: 'graph', id: 'graph', ...graph },
      { kind: 'tree', id: 'tree', info: tree },
      trace,
    ],
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
  function emit(event: StepEvent, key: string | null, text: string, changes: Change[] = []) {
    state.source = key ? { codeId, line: lineMap[key]! } : null;
    recorder.emit(state, event, text, changes);
  }
  function assign(
    key: 'a' | 'b' | 'distance' | 'lca',
    next: string | number,
    line: string,
    text: string,
  ) {
    const before = state.globals[key]!;
    state.globals[key] = value(next);
    state.metrics.assignments++;
    emit('assign', line, text, [
      { path: `globals.${key}`, before, after: value(next), description: text },
    ]);
  }
  try {
    emit(
      'initial',
      null,
      '부모·깊이와 배열은 입력 트리에서 준비했습니다. a와 b가 실제로 같은 노드가 될 때까지 부모로 이동합니다.',
    );
    trace.a = input.from;
    trace.trailA.push(input.from);
    assign('a', input.from, 'a', `첫 노드 a를 ${input.from}로 정했습니다.`);
    trace.b = input.to;
    trace.trailB.push(input.to);
    assign('b', input.to, 'b', `둘째 노드 b를 ${input.to}로 정했습니다.`);
    trace.distance = 0;
    assign('distance', 0, 'distance', '누적 거리 distance를 0으로 초기화했습니다.');
    while (true) {
      trace.currentEdge = null;
      state.metrics.comparisons++;
      const different = trace.a !== trace.b;
      emit(
        'compare',
        'while',
        `${trace.a}와 ${trace.b}는 ${different ? '다른 노드이므로 부모 이동을 계속합니다.' : '같은 노드이므로 반복을 끝냅니다.'}`,
      );
      if (!different) break;
      const moveA: boolean =
        input.method === 'array'
          ? position[trace.a!]! > position[trace.b!]!
          : depth[trace.a!]! >= depth[trace.b!]!;
      state.metrics.comparisons++;
      emit(
        'compare',
        'compare',
        input.method === 'array'
          ? `배열 인덱스 ${position[trace.a!]} > ${position[trace.b!]}는 ${moveA ? '참' : '거짓'}입니다. ${moveA ? 'a' : 'b'}를 올립니다.`
          : `깊이 ${depth[trace.a!]} ≥ ${depth[trace.b!]}는 ${moveA ? '참' : '거짓'}입니다. ${moveA ? 'a' : 'b'}를 올립니다. 같은 깊이에서는 a부터 이동합니다.`,
      );
      const key = moveA ? 'a' : 'b';
      const previous = trace[key]!;
      const next =
        input.method === 'array'
          ? tree.array[Math.floor(position[previous]! / 2)]!
          : parent[previous]!;
      if (input.method === 'array') state.metrics.arithmetic++;
      trace[key] = next;
      (moveA ? trace.trailA : trace.trailB).push(next);
      trace.currentEdge = [previous, next];
      state.metrics.iterations!++;
      assign(
        key,
        next,
        `move-${key}`,
        `${key}: ${previous} → 부모 ${next}. distance는 다음 줄에서 증가합니다.`,
      );
      trace.distance!++;
      state.metrics.arithmetic++;
      assign(
        'distance',
        trace.distance!,
        'increment',
        `부모 간선 하나를 이동했으므로 누적 거리는 ${trace.distance}입니다.`,
      );
    }
    trace.lca = trace.a;
    trace.path = [...trace.trailA, ...trace.trailB.slice(0, -1).reverse()];
    assign(
      'lca',
      trace.lca!,
      'lca',
      `최소 공통 조상은 ${trace.lca}입니다. 두 노드 사이 경로의 간선 수는 ${trace.distance}입니다.`,
    );
    emit(
      'complete',
      null,
      `${input.from}–${input.to} 거리 ${trace.distance}, 최소 공통 조상 ${trace.lca}. 간선 방향 표시는 부모→자식이며 거리는 두 노드 사이 이동 간선 수입니다.`,
    );
  } catch (error) {
    if (!(error instanceof TraceLimit)) throw error;
  }
  return recorder.finish();
}

export const treeDistanceLesson: Lesson = {
  title: '두 노드는 어디에서 만날까?',
  unit: 'Ⅱ 데이터 구조 · 트리',
  origin:
    '교과서 인쇄 140–144쪽의 트리 거리 활동을 바탕으로 구성. 배열 방식은 원문 원리, 깊이 방식은 일반 트리로 확장한 예제',
  goal: '부모를 따라 이동하여 최소 공통 조상을 찾고 두 노드 사이 거리를 설명한다.',
  observe: 'a·b의 현재 노드와 깊이/인덱스, 각 이동 기록, 누적 거리, 공통 조상과 최종 경로.',
  predict:
    'D와 E는 깊이가 같습니다. 여기서 멈춰도 될까요? 두 노드가 어디에서 만날지 예상해 보세요.',
  explain:
    '깊이가 같다는 것과 같은 노드라는 것은 어떻게 다른가요? 부모 이동과 distance의 증가를 연결해 설명해 보세요.',
  compare:
    '같은 이진 트리와 노드 쌍에서 깊이 방식과 배열 방식을 바꿔 관찰하세요. 이동 순서가 달라도 거리와 공통 조상이 같은 이유를 설명해 보세요.',
  reapply:
    'A–G, F–G, 같은 노드 두 개를 각각 선택해 보세요. 일반 트리에서는 깊이 방식을 적용하세요.',
};
