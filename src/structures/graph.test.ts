import { describe, expect, it } from 'vitest';
import {
  adjacencyMatrix,
  createGraph,
  graphSamples,
  listText,
  matrixText,
  neighbors,
  parseList,
  parseMatrix,
  setDirection,
  setEdge,
  treeInfo,
} from './graph';

describe('하나의 그래프 모델과 표현 왕복', () => {
  it.each(Object.entries(graphSamples))('%s의 행렬·리스트 왕복', (_name, graph) => {
    expect(parseMatrix(matrixText(graph), graph.vertices, graph.directed)).toEqual(graph);
    expect(parseList(listText(graph), graph.directed)).toEqual(graph);
  });
  it('무방향 연결은 행렬 양쪽을 함께 바꾼다', () => {
    const graph = setEdge(createGraph(['A', 'B'], []), 'B', 'A', true);
    expect(graph.edges).toEqual([['A', 'B']]);
    expect(adjacencyMatrix(graph)).toEqual([
      [0, 1],
      [1, 0],
    ]);
    expect(setEdge(graph, 'A', 'B', false).edges).toEqual([]);
    expect(setEdge(graph, 'B', 'A', true)).toEqual(graph);
  });
  it('방향은 반대 간선을 자동으로 뜻하지 않는다', () => {
    const graph = createGraph(['A', 'B'], [['A', 'B']], true);
    expect(neighbors(graph, 'B')).toEqual([]);
    expect(adjacencyMatrix(graph)).toEqual([
      [0, 1],
      [0, 0],
    ]);
  });
  it('방향 전환의 쌍 생성·병합 정책', () => {
    const graph = createGraph(['A', 'B'], [['A', 'B']]);
    const directed = setDirection(graph, true);
    expect(directed.edges).toEqual([
      ['A', 'B'],
      ['B', 'A'],
    ]);
    expect(setDirection(directed, false)).toEqual(graph);
  });
  it('리스트 행 순서로 정점을 정의하고 이웃은 그 순서로 정규화한다', () => {
    const graph = parseList('C: B A\nA: C\nB: C', false);
    expect(graph.vertices).toEqual(['C', 'A', 'B']);
    expect(neighbors(graph, 'C')).toEqual(['A', 'B']);
    expect(neighbors(graph, 'C', true)).toEqual(['B', 'A']);
    expect(listText(graph)).toBe('C: A B\nA: C\nB: C');
  });
  it.each(['', '0 1\n0 0', '0 2\n2 0', '1 0\n0 0', '0 1 0\n1 0 1'])('잘못된 행렬 %j', (raw) => {
    expect(() => parseMatrix(raw, ['A', 'B'], false)).toThrow();
  });
  it.each(['', 'A B', 'A: B\nB:', 'A: B B\nB: A', 'A: C\nB: A', 'A: A', 'A:\nA:', 'a: B\nB: a'])(
    '잘못된 리스트 %j',
    (raw) => {
      expect(() => parseList(raw, false)).toThrow();
    },
  );
  it('정점 한도·형식·간선 입력을 검증한다', () => {
    expect(() => parseMatrix('0'.repeat(1025), ['A'], false)).toThrow('1,024자');
    expect(() => parseList('A'.repeat(1025), false)).toThrow('1,024자');
    expect(() => createGraph([], [])).toThrow();
    expect(() => createGraph('ABCDEFGHI'.split(''), [])).toThrow();
    expect(() => createGraph(['AA'], [])).toThrow();
    expect(() => createGraph(['A', 'A'], [])).toThrow();
    expect(() => createGraph(['A'], [['A', 'B']])).toThrow();
    expect(() =>
      createGraph(
        ['A', 'B'],
        [
          ['A', 'B'],
          ['B', 'A'],
        ],
      ),
    ).toThrow();
    expect(parseList('A:', true)).toEqual(createGraph(['A'], [], true));
  });
});

describe('트리 검증과 관계', () => {
  it('루트·부모·자식·형제·단말·깊이와 1기반 이진 배열', () => {
    const tree = treeInfo(graphSamples.tree, 'A');
    expect(tree.height).toBe(2);
    expect(tree.nodes.find((n) => n.vertex === 'B')).toEqual({
      vertex: 'B',
      parent: 'A',
      children: ['D', 'E'],
      siblings: ['C'],
      depth: 1,
      leaf: false,
      arrayIndex: 2,
    });
    expect(tree.nodes.filter((n) => n.leaf).map((n) => n.vertex)).toEqual(['D', 'E', 'F']);
    expect(tree.array).toEqual([null, 'A', 'B', 'C', 'D', 'E', 'F']);
  });
  it('오른쪽 하위 트리와 빈 인덱스를 구분한다', () => {
    const graph = createGraph(
      ['A', 'B', 'C', 'D'],
      [
        ['A', 'B'],
        ['A', 'C'],
        ['C', 'D'],
      ],
      true,
    );
    expect(treeInfo(graph, 'A').array).toEqual([null, 'A', 'B', 'C', null, null, 'D']);
  });
  it('자식이 하나면 왼쪽이라는 명시적 규칙과 최대 깊이', () => {
    const vertices = 'ABCDEFGH'.split('');
    const graph = createGraph(
      vertices,
      vertices.slice(1).map((v, i) => [vertices[i]!, v]),
      true,
    );
    const tree = treeInfo(graph, 'A');
    expect(tree.height).toBe(7);
    expect(tree.array[128]).toBe('H');
    expect(tree.array).toHaveLength(129);
  });
  it('일반 트리와 한 정점 트리', () => {
    expect(treeInfo(graphSamples.generalTree, 'A').binary).toBe(false);
    expect(treeInfo(graphSamples.generalTree, 'A').nodes).toHaveLength(5);
    expect(treeInfo(createGraph(['A'], [], true), 'A')).toMatchObject({
      height: 0,
      binary: true,
      array: [null, 'A'],
    });
  });
  it('잘못된 루트·다중 부모·단절·사이클을 거절한다', () => {
    expect(() => treeInfo(graphSamples.cycle, 'A')).toThrow('부모→자식');
    expect(() => treeInfo(graphSamples.tree, 'B')).toThrow('부모');
    expect(() =>
      treeInfo(
        createGraph(
          ['A', 'B', 'C'],
          [
            ['A', 'C'],
            ['B', 'C'],
          ],
          true,
        ),
        'A',
      ),
    ).toThrow();
    expect(() =>
      treeInfo(
        createGraph(
          ['A', 'B', 'C'],
          [
            ['B', 'C'],
            ['C', 'B'],
          ],
          true,
        ),
        'A',
      ),
    ).toThrow('분리된 사이클');
    expect(() => treeInfo(createGraph(['A', 'B'], [], true), 'A')).toThrow();
  });
});
