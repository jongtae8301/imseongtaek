import { describe, expect, it } from 'vitest';
import { buildMazeRun, exitMilestone } from './maze-search';
import { mazeSamples, type Maze } from '../structures/maze';
import { createPlayer } from '../player/controller';

const square: Maze = { rows: ['..', '..'], start: '1,1', target: '2,1' };
describe('미로의 독립적인 수작업 추적', () => {
  it('2×2 사이클: BFS는 1회 이동, DFS는 오른쪽을 돌아 3회 이동한다', () => {
    const bfs = buildMazeRun('bfs', square),
      dfs = buildMazeRun('dfs', square);
    expect(exitMilestone(bfs)?.search?.targetPath).toEqual(['1,1', '2,1']);
    expect(exitMilestone(dfs)?.search?.targetPath).toEqual(['1,1', '1,2', '2,2', '2,1']);
    expect(exitMilestone(bfs)?.metrics).toMatchObject({ discoveries: 3, edgeScans: 2 });
    expect(exitMilestone(dfs)?.metrics).toMatchObject({ discoveries: 4, edgeScans: 4 });
    expect(bfs.steps.at(-1)?.search?.visitOrder).toEqual(['1,1', '1,2', '2,1', '2,2']);
    expect(dfs.steps.at(-1)?.search?.visitOrder).toEqual(['1,1', '1,2', '2,2', '2,1']);
    for (const run of [bfs, dfs]) {
      expect(run.steps.at(-1)?.status).toBe('completed');
      expect(run.steps.at(-1)?.metrics).toMatchObject({
        discoveries: 4,
        visits: 4,
        edgeScans: 8,
        finished: 4,
      });
      expect(run.steps.at(-1)?.search?.frontier).toEqual([]);
      expect(exitMilestone(run)!.index).toBeLessThan(run.steps.length - 1);
    }
    expect(dfs.steps.at(-1)?.metrics.maxDepth).toBe(4);
  });
  it('발견과 부모 기록이 모두 있는 시점을 사용하고 큐·프레임과 코드가 대응한다', () => {
    const bfs = buildMazeRun('bfs', square),
      dfs = buildMazeRun('dfs', square);
    const firstBfs = bfs.steps.find(
      (s) => s.event === 'discover' && s.search!.discovered.includes(square.target),
    )!;
    expect(firstBfs.search!.targetPath).toEqual([]);
    const firstDfsParent = dfs.steps.find((s) => s.search!.targetPath.length > 0)!;
    expect(firstDfsParent.search!.discovered).not.toContain(square.target);
    const queued = bfs.steps.find((s) => s.event === 'insert' && s.search!.frontier.length === 2)!;
    expect(queued.search!.frontier).toEqual(['1,2', '2,1']);
    expect(bfs.metadata.code.lines[queued.source!.line - 1]).toContain('queue.append(v)');
    const foundDfs = exitMilestone(dfs)!;
    expect(foundDfs.frames.map((f) => f.parameters.u)).toEqual(
      ['1,1', '1,2', '2,2', '2,1'].map((v) => ({ kind: 'value', value: v })),
    );
    expect(dfs.metadata.code.lines[foundDfs.source!.line - 1]).toContain('visited.add(u)');
    expect(dfs.steps.at(-1)?.frames).toEqual([]);
  });
  it('이웃 역순은 실제 방문 순서·경로와 표시 코드에 함께 반영된다', () => {
    const run = buildMazeRun('dfs', square, true);
    expect(exitMilestone(run)?.search?.targetPath).toEqual(['1,1', '2,1']);
    expect(run.metadata.neighborOrder).toEqual(['왼쪽', '아래', '오른쪽', '위']);
    expect(run.metadata.code.lines[run.metadata.lineMap.moves! - 1]).toBe(
      'moves = [[0,-1],[1,0],[0,1],[-1,0]]',
    );
  });
  it('기본 미로의 직선 6회와 위쪽 우회 10회 경로를 비교한다', () => {
    expect(
      exitMilestone(buildMazeRun('bfs', mazeSamples.detour!.maze))!.search!.targetPath,
    ).toEqual(['3,1', '3,2', '3,3', '3,4', '3,5', '3,6', '3,7']);
    expect(
      exitMilestone(buildMazeRun('dfs', mazeSamples.detour!.maze))!.search!.targetPath,
    ).toEqual(['3,1', '2,1', '1,1', '1,2', '1,3', '1,4', '1,5', '1,6', '1,7', '2,7', '3,7']);
  });
  it.each(['bfs', 'dfs'] as const)(
    '%s는 도달 불가·한도·0회 이동과 대각선 금지를 구분한다',
    (algorithm) => {
      const blocked = buildMazeRun(algorithm, { rows: ['.#', '#.'], start: '1,1', target: '2,2' });
      expect(blocked.steps.at(-1)).toMatchObject({
        status: 'completed',
        search: { outcome: 'unreachable', discovered: ['1,1'] },
      });
      expect(exitMilestone(blocked)).toBeNull();
      const limited = buildMazeRun(algorithm, square, false, 2);
      expect(limited.steps).toHaveLength(2);
      expect(limited.steps.at(-1)).toMatchObject({
        status: 'limit-reached',
        search: { outcome: 'pending' },
      });
      expect(exitMilestone(limited)).toBeNull();
      const same = buildMazeRun(algorithm, { ...square, target: square.start });
      expect(exitMilestone(same)?.search?.targetPath).toEqual(['1,1']);
    },
  );
  it.each(['bfs', 'dfs'] as const)(
    '%s는 최대 49칸을 중복 처리하지 않고 기본 한도 안에서 완료한다',
    (algorithm) => {
      const run = buildMazeRun(algorithm, mazeSamples.blank!.maze);
      const last = run.steps.at(-1)!;
      expect(last.status).toBe('completed');
      expect(last.metrics).toMatchObject({
        discoveries: 49,
        visits: 49,
        finished: 49,
        edgeScans: 168,
      }); // 수평42+수직42개 간선 × 양방향
      expect(new Set(last.search!.visitOrder).size).toBe(49);
      expect(run.steps.length).toBeLessThan(2000);
      expect(run.metadata.limits).toMatchObject({ maxInput: 49, maxDepth: 49 });
      if (algorithm === 'bfs') expect(last.search!.targetPath).toHaveLength(13); // 맨해튼 거리12
    },
  );
  it('재현·직렬화·불변성과 이전→다음 왕복을 보장한다', () => {
    const run = buildMazeRun('dfs', square);
    expect(buildMazeRun('dfs', square)).toEqual(run);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
    expect(Object.isFrozen(run.steps[1]!.search)).toBe(true);
    const player = createPlayer(run);
    const n = exitMilestone(run)!.index;
    player.seek(n);
    const before = JSON.stringify(player.getSnapshot().run!.steps[n]);
    player.previous();
    player.next();
    expect(player.getSnapshot().index).toBe(n);
    expect(JSON.stringify(player.getSnapshot().run!.steps[n])).toBe(before);
    expect(run.steps[0]!.search!.discovered).toEqual([]);
    player.dispose();
  });
});
