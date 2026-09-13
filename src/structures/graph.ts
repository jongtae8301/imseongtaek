/** 정점 순서가 모든 표현과 기본 이웃 방문 순서의 기준이다. */
export interface Graph {
  directed: boolean;
  vertices: string[];
  edges: [string, string][];
}
export interface TreeNode {
  vertex: string;
  parent: string | null;
  children: string[];
  siblings: string[];
  depth: number;
  leaf: boolean;
  arrayIndex: number | null;
}
export interface TreeInfo {
  root: string;
  nodes: TreeNode[];
  binary: boolean;
  height: number;
  array: (string | null)[];
}
export const MAX_VERTICES = 8;

export function createGraph(
  vertices: readonly string[],
  edges: readonly (readonly [string, string])[],
  directed = false,
): Graph {
  if (vertices.length < 1 || vertices.length > MAX_VERTICES)
    throw new Error('정점은 1–8개여야 합니다. 정점을 추가하거나 줄여 주세요.');
  if (vertices.some((v) => !/^[A-Z]$/.test(v)) || new Set(vertices).size !== vertices.length)
    throw new Error('정점 이름은 중복 없는 영문 대문자 한 글자(A–Z)로 입력해 주세요.');
  const seen = new Set<string>();
  const canonical = edges.map(([a, b]): [string, string] => {
    if (!vertices.includes(a) || !vertices.includes(b))
      throw new Error('간선의 양 끝은 등록된 정점이어야 합니다.');
    if (a === b) throw new Error('자기 루프는 지원하지 않습니다. 대각선 값을 0으로 고쳐 주세요.');
    const pair: [string, string] =
      !directed && vertices.indexOf(a) > vertices.indexOf(b) ? [b, a] : [a, b];
    const key = pair.join(':');
    if (seen.has(key))
      throw new Error('중복 간선은 지원하지 않습니다. 같은 연결을 한 번만 입력해 주세요.');
    seen.add(key);
    return pair;
  });
  canonical.sort(
    (a, b) =>
      vertices.indexOf(a[0]) - vertices.indexOf(b[0]) ||
      vertices.indexOf(a[1]) - vertices.indexOf(b[1]),
  );
  return { vertices: [...vertices], edges: canonical, directed };
}
export function neighbors(graph: Graph, vertex: string, reverse = false): string[] {
  const linked = new Set(
    graph.edges.flatMap(([a, b]) =>
      a === vertex ? [b] : !graph.directed && b === vertex ? [a] : [],
    ),
  );
  const result = graph.vertices.filter((v) => linked.has(v));
  return reverse ? result.reverse() : result;
}
export function adjacencyMatrix(graph: Graph): number[][] {
  return graph.vertices.map((a) => {
    const linked = neighbors(graph, a);
    return graph.vertices.map((b) => Number(linked.includes(b)));
  });
}
export function matrixText(graph: Graph): string {
  return adjacencyMatrix(graph)
    .map((row) => row.join(' '))
    .join('\n');
}
export function listText(graph: Graph): string {
  return graph.vertices.map((v) => `${v}: ${neighbors(graph, v).join(' ')}`.trimEnd()).join('\n');
}
export function parseMatrix(text: string, vertices: string[], directed: boolean): Graph {
  if (text.length > 1024)
    throw new Error('행렬 입력은 1,024자 이내로 줄여 주세요. 정점은 최대 8개입니다.');
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((row) => row.trim().split(/\s+/));
  if (rows.length !== vertices.length || rows.some((row) => row.length !== vertices.length))
    throw new Error(
      `현재 정점 순서 ${vertices.join(', ')}에 맞춰 ${vertices.length}×${vertices.length} 행렬을 입력해 주세요.`,
    );
  if (rows.some((row) => row.some((cell) => cell !== '0' && cell !== '1')))
    throw new Error('인접행렬에는 0과 1만 사용할 수 있습니다.');
  const edges: [string, string][] = [];
  rows.forEach((row, i) =>
    row.forEach((cell, j) => {
      if (i === j && cell !== '0')
        throw new Error('자기 루프는 지원하지 않습니다. 대각선을 0으로 고쳐 주세요.');
      if (!directed && cell !== rows[j]?.[i])
        throw new Error(
          '무방향 그래프의 행렬은 대칭이어야 합니다. 서로 마주 보는 값을 같게 고쳐 주세요.',
        );
      if (cell === '1' && (directed || i < j)) edges.push([vertices[i]!, vertices[j]!]);
    }),
  );
  return createGraph(vertices, edges, directed);
}
/** 행 순서는 정점 순서가 된다. 이웃 표기는 입력 순서와 무관하게 정점 순서로 정규화한다. */
export function parseList(text: string, directed: boolean): Graph {
  if (text.length > 1024)
    throw new Error('리스트 입력은 1,024자 이내로 줄여 주세요. 정점은 최대 8개입니다.');
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((row) => {
      const match = /^([A-Z])\s*:\s*([A-Z\s]*)$/.exec(row.trim());
      if (!match)
        throw new Error('각 행을 A: B C 형식으로 입력해 주세요. 이웃이 없으면 A: 로 적습니다.');
      return { vertex: match[1]!, linked: match[2]!.trim() ? match[2]!.trim().split(/\s+/) : [] };
    });
  const vertices = rows.map((row) => row.vertex);
  createGraph(vertices, [], directed);
  const edges: [string, string][] = [];
  rows.forEach(({ vertex, linked }, i) => {
    if (new Set(linked).size !== linked.length)
      throw new Error(`${vertex}의 이웃이 중복되었습니다. 한 번만 입력해 주세요.`);
    linked.forEach((target) => {
      const j = vertices.indexOf(target);
      if (j < 0)
        throw new Error(`${target} 정점의 행이 없습니다. 이웃 없는 정점도 한 행을 적어 주세요.`);
      if (!directed && !rows[j]!.linked.includes(vertex))
        throw new Error(`무방향 연결 ${vertex}–${target}는 양쪽 행에 모두 적어 주세요.`);
      if (directed || i <= j) edges.push([vertex, target]);
    });
  });
  return createGraph(vertices, edges, directed);
}
export function setEdge(graph: Graph, from: string, to: string, present: boolean): Graph {
  // 삭제 요청에도 정점과 자기 루프 정책을 적용한다.
  createGraph(graph.vertices, [[from, to]], graph.directed);
  const rest = graph.edges.filter(
    ([a, b]) => !(a === from && b === to) && !(!graph.directed && a === to && b === from),
  );
  return createGraph(graph.vertices, present ? [...rest, [from, to]] : rest, graph.directed);
}
export function setDirection(graph: Graph, directed: boolean): Graph {
  if (directed === graph.directed) return createGraph(graph.vertices, graph.edges, directed);
  if (directed)
    return createGraph(
      graph.vertices,
      graph.edges.flatMap(
        ([a, b]) =>
          [
            [a, b],
            [b, a],
          ] as [string, string][],
      ),
      true,
    );
  const pairs = new Map<string, [string, string]>();
  graph.edges.forEach(([a, b]) => {
    const pair: [string, string] =
      graph.vertices.indexOf(a) < graph.vertices.indexOf(b) ? [a, b] : [b, a];
    pairs.set(pair.join(':'), pair);
  });
  return createGraph(graph.vertices, [...pairs.values()], false);
}
export function treeInfo(graph: Graph, root: string): TreeInfo {
  if (!graph.directed) throw new Error('트리는 부모→자식 방향 그래프로 입력해 주세요.');
  if (!graph.vertices.includes(root)) throw new Error('등록된 정점을 루트로 선택해 주세요.');
  for (const vertex of graph.vertices) {
    const count = graph.edges.filter(([, b]) => b === vertex).length;
    if (count !== (vertex === root ? 0 : 1))
      throw new Error(
        `${vertex}: 루트는 부모가 없어야 하고, 나머지 정점은 부모가 정확히 하나여야 합니다. 간선이나 루트를 수정해 주세요.`,
      );
  }
  const nodes: TreeNode[] = [];
  const visited = new Set<string>();
  function walk(vertex: string, parent: string | null, depth: number) {
    if (visited.has(vertex)) throw new Error('사이클이 있습니다. 되돌아가는 간선을 제거해 주세요.');
    visited.add(vertex);
    const children = neighbors(graph, vertex);
    nodes.push({
      vertex,
      parent,
      children,
      depth,
      leaf: children.length === 0,
      siblings: parent ? neighbors(graph, parent).filter((v) => v !== vertex) : [],
      arrayIndex: null,
    });
    children.forEach((child) => walk(child, vertex, depth + 1));
  }
  walk(root, null, 0);
  if (visited.size !== graph.vertices.length)
    throw new Error(
      '루트에서 닿지 않는 정점 또는 분리된 사이클이 있습니다. 모든 정점을 하나의 트리로 연결해 주세요.',
    );
  const binary = nodes.every((node) => node.children.length <= 2);
  const array: (string | null)[] = [null];
  if (binary) {
    function place(vertex: string, index: number) {
      const node = nodes.find((n) => n.vertex === vertex)!;
      node.arrayIndex = index;
      while (array.length <= index) array.push(null);
      array[index] = vertex;
      node.children.forEach((child, i) => place(child, index * 2 + i));
    }
    place(root, 1);
  }
  return { root, nodes, binary, array, height: Math.max(...nodes.map((node) => node.depth)) };
}

export const graphSamples = {
  textbookTree: createGraph(
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['B', 'E'],
      ['E', 'F'],
      ['E', 'G'],
    ],
    true,
  ),
  cycle: createGraph(
    ['A', 'B', 'C', 'D', 'E', 'F'],
    [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['B', 'E'],
      ['C', 'F'],
      ['D', 'F'],
    ],
  ),
  disconnected: createGraph(
    ['A', 'B', 'C', 'D', 'E', 'F'],
    [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['D', 'E'],
    ],
  ),
  directed: createGraph(
    ['A', 'B', 'C', 'D', 'E'],
    [
      ['A', 'B'],
      ['B', 'C'],
      ['C', 'A'],
      ['C', 'D'],
      ['E', 'D'],
    ],
    true,
  ),
  tree: createGraph(
    ['A', 'B', 'C', 'D', 'E', 'F'],
    [
      ['A', 'B'],
      ['A', 'C'],
      ['B', 'D'],
      ['B', 'E'],
      ['C', 'F'],
    ],
    true,
  ),
  generalTree: createGraph(
    ['A', 'B', 'C', 'D', 'E'],
    [
      ['A', 'B'],
      ['A', 'C'],
      ['A', 'D'],
      ['C', 'E'],
    ],
    true,
  ),
};
