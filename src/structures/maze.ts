import type { Graph } from './graph';

export interface Maze {
  rows: string[];
  start: string;
  target: string;
}
export type MazeTool = 'wall' | 'erase' | 'start' | 'target';
export const MAZE_MAX_ROWS = 15;
export const MAZE_MAX_COLUMNS = 21;
export const MAZE_MAX_CELLS = MAZE_MAX_ROWS * MAZE_MAX_COLUMNS;
export const MAZE_DIRECTIONS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
] as const;
export const cellId = (row: number, column: number) => `${row + 1},${column + 1}`;

export function validateMaze(maze: Maze): Maze {
  const { rows, start, target } = maze;
  if (
    !Array.isArray(rows) ||
    rows.length < 2 ||
    rows.length > MAZE_MAX_ROWS ||
    rows.some(
      (row) =>
        typeof row !== 'string' ||
        row.length < 2 ||
        row.length > MAZE_MAX_COLUMNS ||
        row.length !== rows[0]!.length ||
        !/^[.#]+$/.test(row),
    )
  )
    throw new Error(
      '미로는 세로 2–15칸, 가로 2–21칸의 직사각형이어야 하며 .(길), #(벽)만 쓸 수 있습니다.',
    );
  const open = new Set(
    rows.flatMap((row, r) => [...row].flatMap((cell, c) => (cell === '.' ? [cellId(r, c)] : []))),
  );
  if (!open.has(start) || !open.has(target))
    throw new Error('출발과 출구는 미로 안의 길 위에 있어야 합니다.');
  return { rows: [...rows], start, target };
}

export function mazeNeighbors(maze: Maze, vertex: string, reverse = false): string[] {
  const [r, c] = vertex.split(',').map(Number) as [number, number];
  const directions = reverse ? [...MAZE_DIRECTIONS].reverse() : MAZE_DIRECTIONS;
  return directions.flatMap(([dr, dc]) =>
    maze.rows[r - 1 + dr]?.[c - 1 + dc] === '.' ? [cellId(r - 1 + dr, c - 1 + dc)] : [],
  );
}

/** 일반 그래프 편집기의 8정점 제한과 별개인, 검증된 격자→그래프 어댑터. */
export function mazeGraph(input: Maze): Graph {
  const maze = validateMaze(input);
  const vertices = maze.rows.flatMap((row, r) =>
    [...row].flatMap((cell, c) => (cell === '.' ? [cellId(r, c)] : [])),
  );
  const indices = new Map(vertices.map((v, i) => [v, i]));
  const edges: [string, string][] = vertices.flatMap((v, i) =>
    mazeNeighbors(maze, v)
      .filter((u) => indices.get(u)! > i)
      .map((u): [string, string] => [v, u]),
  );
  return { directed: false, vertices, edges };
}

export function editMaze(input: Maze, vertex: string, tool: MazeTool): Maze {
  const maze = validateMaze(input);
  const [r, c] = vertex.split(',').map(Number) as [number, number];
  if (
    !Number.isInteger(r) ||
    !Number.isInteger(c) ||
    cellId(r - 1, c - 1) !== vertex ||
    maze.rows[r - 1]?.[c - 1] === undefined
  )
    throw new Error('미로 안의 칸을 선택해 주세요.');
  if (tool === 'wall' && (vertex === maze.start || vertex === maze.target))
    throw new Error('출발·출구에는 벽을 놓을 수 없습니다. 먼저 다른 칸으로 옮겨 주세요.');
  if (!['wall', 'erase', 'start', 'target'].includes(tool))
    throw new Error('지원하지 않는 미로 편집 도구입니다.');
  const row = [...maze.rows[r - 1]!];
  row[c - 1] = tool === 'wall' ? '#' : '.';
  maze.rows[r - 1] = row.join('');
  if (tool === 'start') maze.start = vertex;
  if (tool === 'target') maze.target = vertex;
  return maze;
}

export const mazeSamples: Record<string, { title: string; maze: Maze }> = {
  studio: {
    title: '갈림길 미로 · 9 × 13',
    maze: {
      rows: Array.from({ length: 9 }, (_, r) => (r % 2 ? '.#####.#####.' : '.............')),
      start: '5,1',
      target: '5,13',
    },
  },
  detour: {
    title: '갈림길과 돌아가는 길',
    maze: {
      rows: ['.......', '.#####.', '.......', '.#####.', '.......'],
      start: '3,1',
      target: '3,7',
    },
  },
  blocked: {
    title: '막힌 출구',
    maze: {
      rows: ['...#...', '.#.#.#.', '...#...', '.#.#.#.', '...#...'],
      start: '1,1',
      target: '5,7',
    },
  },
  blank: {
    title: '빈 미로 · 직접 만들기',
    maze: { rows: Array<string>(7).fill('.......'), start: '1,1', target: '7,7' },
  },
  large: {
    title: '넓은 빈 미로 · 15 × 21',
    maze: { rows: Array<string>(15).fill('.'.repeat(21)), start: '8,2', target: '8,20' },
  },
};
