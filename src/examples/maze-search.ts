import type { ExecutionRun } from '../engine/types';
import { mazeGraph, validateMaze, type Maze } from '../structures/maze';
import { buildSearchRun, type SearchAlgorithm } from './graph-search';

export function buildMazeRun(
  algorithm: SearchAlgorithm,
  input: Maze,
  reverse = false,
  maxSteps = 2000,
  recording: 'full' | 'discoveries' = 'full',
) {
  const maze = validateMaze(input);
  return buildSearchRun(algorithm, {
    graph: mazeGraph(maze),
    start: maze.start,
    target: maze.target,
    reverse,
    maxSteps,
    maze,
    recording,
  });
}

/** 같은 기준: 출구가 발견 기록과 부모 경로에 모두 포함된 첫 스냅샷. */
export function exitMilestone(run: ExecutionRun) {
  return (
    run.steps.find(
      (step) =>
        step.search?.target !== null &&
        step.search?.discovered.includes(step.search.target) &&
        step.search.targetPath.length > 0,
    ) ?? null
  );
}

export const mazeLesson = {
  title: '미로에서 만나는 BFS와 DFS',
  unit: 'Ⅱ 데이터 구조 · 그래프 / Ⅲ 알고리즘 · 탐색',
  origin: '교과의 그래프 탐색 개념을 바탕으로 새로 만든 미로 변형 예제',
  goal: '길을 정점, 상하좌우 연결을 간선으로 해석하고 BFS·DFS의 경로와 탐색 상태를 비교한다.',
  observe:
    '나란히 놓인 두 미로의 새로 발견한 칸, 발견한 칸 수와 출구 경로의 이동 횟수를 관찰한다. 좌표는 1부터 세는 행,열이다.',
  predict:
    '먼저 출구에 닿는 방법과 더 짧은 길을 찾는 방법은 항상 같을까요? 갈림길에서 다음 칸을 예상해 보세요.',
  explain:
    'BFS는 왜 같은 거리의 칸을 먼저 살펴볼까요? DFS가 돌아가는 길을 택하는 이유를 이웃 순서와 연결해 설명하세요.',
  compare:
    '같이 탐색하거나 결과 비교를 눌러 두 미로의 발견한 칸 수와 경로 길이를 비교하세요. 재생 속도는 실제 계산 속도가 아닙니다.',
  reapply:
    '벽 하나를 옮기거나 이웃 순서를 뒤집은 뒤 경로를 예상해 보세요. 출구를 막았을 때에는 전체 탐색 완료와 한도 중단을 구분하세요.',
};
