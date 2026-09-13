import type { ExecutionRun, Snapshot } from '../engine/types';
import { exitMilestone } from '../examples/maze-search';

export type MazeRuns = { bfs: ExecutionRun; dfs: ExecutionRun };
export interface MazeComparison {
  readonly steps: readonly {
    bfs: Snapshot;
    dfs: Snapshot;
    bfsDone: boolean;
    dfsDone: boolean;
  }[];
}

/** 알고리즘을 다시 실행하지 않고, 새 칸의 발견·부모가 함께 기록된 원본 Step만 고른다. */
function discoveryFrames(run: ExecutionRun): Snapshot[] {
  const initial = run.steps[0],
    end = exitMilestone(run) ?? run.steps.at(-1);
  if (!initial || !end) throw new Error('비교할 미로 실행 기록이 없습니다.');
  const frames = [initial];
  let discoveries = initial.search?.discovered.length ?? 0;
  for (const step of run.steps) {
    if (step.index > end.index) break;
    const search = step.search;
    const last = search?.discovered.at(-1);
    if (search && last && search.discovered.length > discoveries && last in search.parents) {
      frames.push(step);
      discoveries = search.discovered.length;
    }
  }
  if (frames.at(-1) !== end) frames.push(end);
  return frames;
}

/** 한 박자는 양쪽의 새 칸 발견 1회. 실제 시간·같은 연산량을 나타내지 않는다. */
export function buildMazeComparison(runs: MazeRuns): MazeComparison {
  const bfs = discoveryFrames(runs.bfs),
    dfs = discoveryFrames(runs.dfs);
  return {
    steps: Array.from({ length: Math.max(bfs.length, dfs.length) }, (_, i) => ({
      bfs: bfs[Math.min(i, bfs.length - 1)]!,
      dfs: dfs[Math.min(i, dfs.length - 1)]!,
      bfsDone: i >= bfs.length - 1,
      dfsDone: i >= dfs.length - 1,
    })),
  };
}
