import { buildMazeRun } from './maze-search';
import type { Maze } from '../structures/maze';

self.onmessage = (event: MessageEvent<{ maze: Maze; reverse: boolean; maxSteps: number }>) => {
  try {
    const { maze, reverse, maxSteps } = event.data;
    self.postMessage({
      runs: {
        bfs: buildMazeRun('bfs', maze, reverse, maxSteps),
        dfs: buildMazeRun('dfs', maze, reverse, maxSteps),
      },
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : '미로 탐색을 준비하지 못했습니다.',
    });
  }
};
