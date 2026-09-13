import { afterEach, expect, it, vi } from 'vitest';
import { buildMazeRun, exitMilestone } from '../examples/maze-search';
import { mazeSamples } from '../structures/maze';
import { createPlayer } from './controller';
import { buildMazeComparison, type MazeComparison } from './maze-comparison';

afterEach(() => vi.useRealTimers());
const square = { rows: ['..', '..'], start: '1,1', target: '2,1' };
const runs = { bfs: buildMazeRun('bfs', square), dfs: buildMazeRun('dfs', square) };

it('원본 Step을 발견 1칸씩 묶고 먼저 찾은 BFS는 경로와 지표를 유지한다', () => {
  const comparison = buildMazeComparison(runs);
  expect(
    comparison.steps.map(({ bfs, dfs }) => [
      bfs.search!.discovered.length,
      dfs.search!.discovered.length,
    ]),
  ).toEqual([
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [3, 4],
  ]);
  expect(comparison.steps[3]!.bfsDone).toBe(true);
  expect(comparison.steps[3]!.dfsDone).toBe(false);
  expect(comparison.steps[3]!.bfs).toBe(comparison.steps[4]!.bfs);
  expect(comparison.steps.at(-1)!.bfs).toBe(exitMilestone(runs.bfs));
  expect(comparison.steps.at(-1)!.dfs).toBe(exitMilestone(runs.dfs));
  for (const frame of comparison.steps)
    for (const key of ['bfs', 'dfs'] as const) expect(runs[key].steps).toContain(frame[key]);
});
it('기본 미로에서는 먼저 찾은 DFS를 고정하고 BFS의 6회·DFS의 10회 경로를 비교한다', () => {
  const input = mazeSamples.detour!.maze;
  const comparison = buildMazeComparison({
    bfs: buildMazeRun('bfs', input),
    dfs: buildMazeRun('dfs', input),
  });
  const finishedDfs = comparison.steps.find((f) => f.dfsDone && !f.bfsDone)!;
  expect(finishedDfs).toBeDefined();
  const last = comparison.steps.at(-1)!;
  expect(last.dfs).toBe(finishedDfs.dfs);
  expect(last.bfs.search!.targetPath.length - 1).toBe(6);
  expect(last.dfs.search!.targetPath.length - 1).toBe(10);
  expect(last.bfs.metrics.discoveries).toBe(18);
  expect(last.dfs.metrics.discoveries).toBe(11);
});
it('도달 불가와 한도 중단의 마지막 상태를 생략하지 않는다', () => {
  const blocked = { rows: ['.#', '#.'], start: '1,1', target: '2,2' };
  const comparison = buildMazeComparison({
    bfs: buildMazeRun('bfs', blocked),
    dfs: buildMazeRun('dfs', blocked, false, 2),
  });
  const last = comparison.steps.at(-1)!;
  expect(last.bfs).toMatchObject({ status: 'completed', search: { outcome: 'unreachable' } });
  expect(last.dfs.status).toBe('limit-reached');
  expect(last.bfsDone && last.dfsDone).toBe(true);
});
it('출발=출구는 두 탐색 모두 첫 발견에서 0회 이동으로 멈춘다', () => {
  const input = { ...square, target: square.start };
  const comparison = buildMazeComparison({
    bfs: buildMazeRun('bfs', input),
    dfs: buildMazeRun('dfs', input),
  });
  expect(comparison.steps).toHaveLength(2);
  for (const key of ['bfs', 'dfs'] as const)
    expect(comparison.steps[1]![key].search!.targetPath).toEqual(['1,1']);
});
it('공통 타이머 하나로 함께 재생·정지·속도 변경·복원하고 입력 변경 시 초기화한다', () => {
  vi.useFakeTimers();
  const comparison = buildMazeComparison(runs);
  const player = createPlayer<MazeComparison>(comparison);
  player.play();
  player.play();
  expect(vi.getTimerCount()).toBe(1);
  vi.advanceTimersByTime(2000);
  const before = player.getSnapshot().run!.steps[player.getSnapshot().index];
  player.previous();
  player.next();
  expect(player.getSnapshot().run!.steps[player.getSnapshot().index]).toBe(before);
  expect(vi.getTimerCount()).toBe(0);
  player.play();
  player.setDelay(500);
  vi.advanceTimersByTime(10000);
  expect(player.getSnapshot()).toMatchObject({ index: 4, playing: false });
  expect(vi.getTimerCount()).toBe(0);
  player.reset();
  player.play();
  player.load(null);
  vi.advanceTimersByTime(10000);
  expect(player.getSnapshot()).toMatchObject({ index: 0, run: null, playing: false });
  player.dispose();
});
