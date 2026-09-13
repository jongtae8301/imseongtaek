import { expect, it } from 'vitest';
import { editMaze, mazeGraph, mazeNeighbors, validateMaze, type Maze } from './maze';
import { applyLinearCommand, createTraversalQueue, createLinearState } from './linear';

const input: Maze = { rows: ['...', '.#.', '...'], start: '1,1', target: '3,3' };
it('격자를 같은 연결의 무방향 그래프로 바꾸고 방향 순서를 보존한다', () => {
  const graph = mazeGraph(input);
  expect(graph.vertices).toEqual(['1,1', '1,2', '1,3', '2,1', '2,3', '3,1', '3,2', '3,3']);
  expect(graph.edges).toHaveLength(8);
  expect(mazeNeighbors(input, '1,1')).toEqual(['1,2', '2,1']);
  expect(mazeNeighbors(input, '1,1', true)).toEqual(['2,1', '1,2']);
  expect(graph.edges.every(([a, b]) => a !== b && a !== '2,2' && b !== '2,2')).toBe(true);
});
it('벽·길·출발·출구 편집은 원본을 보존하고 끝점을 보호한다', () => {
  const closed = editMaze(input, '1,2', 'wall');
  expect(closed.rows[0]).toBe('.#.');
  expect(input.rows[0]).toBe('...');
  expect(editMaze(closed, '1,2', 'erase')).toEqual(input);
  expect(() => editMaze(input, input.start, 'wall')).toThrow('출발·출구');
  expect(() => editMaze(input, input.target, 'wall')).toThrow('출발·출구');
  expect(editMaze(input, '2,2', 'start')).toMatchObject({
    rows: ['...', '...', '...'],
    start: '2,2',
  });
  expect(editMaze(input, '1,1', 'target').target).toBe('1,1');
  expect(() => editMaze(input, '0,1', 'erase')).toThrow('미로 안');
});
it('잘못된 모양·문자·범위·벽 위 끝점을 거절한다', () => {
  for (const rows of [
    [],
    ['..'],
    ['..', '.'],
    ['..', 'x.'],
    Array<string>(8).fill('..'),
    ['........', '........'],
  ])
    expect(() => validateMaze({ ...input, rows })).toThrow();
  for (const start of ['2,2', '0,1', '1,01', '9,9'])
    expect(() => validateMaze({ ...input, start })).toThrow('출발과 출구');
});
it('격자 큐는 49개를 FIFO로 저장하고 일반 조작 큐의 8개 제한은 유지한다', () => {
  let queue = createTraversalQueue(49);
  for (let value = 0; value < 49; value++)
    queue = applyLinearCommand(queue, { type: 'insert', value }).state;
  expect(applyLinearCommand(queue, { type: 'insert', value: 49 }).transition.action).toBe('reject');
  for (let value = 0; value < 49; value++) {
    const removed = applyLinearCommand(queue, { type: 'remove' });
    expect(removed.transition.value).toBe(value);
    queue = removed.state;
  }
  expect(queue.items).toEqual([]);
  expect(() => createTraversalQueue(50)).toThrow();
  expect(() => createLinearState('queue', 9)).toThrow();
});
