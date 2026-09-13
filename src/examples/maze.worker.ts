import { buildMazeRun } from './maze-search';
import type { Maze } from '../structures/maze';
import { buildMazeComparison } from '../player/maze-comparison';

self.onmessage = (event: MessageEvent<{ maze: Maze; reverse: boolean; maxSteps: number }>) => {
  try {
    const { maze, reverse, maxSteps } = event.data;
    self.postMessage({
      comparison: buildMazeComparison({
        bfs: buildMazeRun('bfs', maze, reverse, maxSteps, 'discoveries'),
        dfs: buildMazeRun('dfs', maze, reverse, maxSteps, 'discoveries'),
      }),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : '미로 탐색을 준비하지 못했습니다.',
    });
  }
};
