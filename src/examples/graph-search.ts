import { TraceLimit, TraceRecorder } from '../engine/trace';
import {
  unset,
  value,
  type Change,
  type ExecutionRun,
  type RunMetadata,
  type StepEvent,
  type StepState,
} from '../engine/types';
import { createGraph, neighbors, treeInfo, type Graph } from '../structures/graph';
import { applyLinearCommand, createTraversalQueue, linearStructure } from '../structures/linear';
import {
  MAZE_DIRECTIONS,
  mazeGraph,
  mazeNeighbors,
  validateMaze,
  type Maze,
} from '../structures/maze';

export type SearchAlgorithm = 'bfs' | 'dfs';
export interface SearchInput {
  graph: Graph;
  start: string;
  target: string | null;
  reverse: boolean;
  treeRoot?: string;
  maxSteps?: number;
  maze?: Maze;
  recording?: 'full' | 'discoveries';
}

function sourceCode(
  graph: Graph,
  algorithm: SearchAlgorithm,
  start: string,
  reverse: boolean,
  maze?: Maze,
) {
  const lines: string[] = [];
  const lineMap: Record<string, number> = {};
  const add = (key: string, text: string) => {
    lines.push(text);
    lineMap[key] = lines.length;
  };
  if (algorithm === 'bfs') add('import', 'from collections import deque');
  if (maze) {
    add('grid', `grid = ${JSON.stringify(maze.rows)}`);
    add(
      'moves',
      `moves = ${JSON.stringify(reverse ? [...MAZE_DIRECTIONS].reverse() : MAZE_DIRECTIONS)}`,
    );
    add('adj', 'adj = {}');
    add('grid-row', 'for r, row in enumerate(grid):');
    add('grid-column', '    for c, cell in enumerate(row):');
    add('grid-open', "        if cell == '.':");
    add('grid-key', "            adj[f'{r+1},{c+1}'] = [");
    add('grid-neighbor', "                f'{r+dr+1},{c+dc+1}' for dr, dc in moves");
    add('grid-bounds', '                if 0 <= r+dr < len(grid) and 0 <= c+dc < len(row)');
    add('grid-wall', "                and grid[r+dr][c+dc] == '.'");
    add('adj-end', '            ]');
  } else {
    add('adj', 'adj = {');
    graph.vertices.forEach((v) =>
      add(`adj-${v}`, `    '${v}': ${JSON.stringify(neighbors(graph, v, reverse))},`),
    );
    add('adj-end', '}');
  }
  add('start', `start = '${start}'`);
  add('visited', 'visited = set()');
  add('order', 'order = []');
  add('processed', 'processed = []');
  add('parents', 'parent = {}');
  if (algorithm === 'bfs') {
    add('queue', 'queue = deque()');
    add('discover-start', 'visited.add(start)');
    add('parent-start', 'parent[start] = None');
    add('insert-start', 'queue.append(start)');
    add('while', 'while queue:');
    add('remove', '    u = queue.popleft()');
    add('visit', '    order.append(u)');
    add('edge', '    for v in adj[u]:');
    add('compare', '        if v not in visited:');
    add('discover', '            visited.add(v)');
    add('parent', '            parent[v] = u');
    add('insert', '            queue.append(v)');
    add('process', '    processed.append(u)');
  } else {
    add('definition', 'def dfs(u):');
    add('discover', '    visited.add(u)');
    add('visit', '    order.append(u)');
    add('edge', '    for v in adj[u]:');
    add('compare', '        if v not in visited:');
    add('parent', '            parent[v] = u');
    add('call', '            dfs(v)');
    add('process', '    processed.append(u)');
    add('return', '    return');
    add('parent-start', 'parent[start] = None');
    add('call-start', 'dfs(start)');
  }
  return { lines, lineMap };
}

/** 탐색 자체와 모든 파생 상태를 여기에서 계산한다. UI에는 불변 Step만 전달한다. */
export function buildSearchRun(algorithm: SearchAlgorithm, input: SearchInput): ExecutionRun {
  const maze = input.maze ? validateMaze(input.maze) : undefined;
  const compact = input.recording === 'discoveries';
  if (compact && !maze) throw new Error('발견 장면 기록은 미로 비교에서만 사용합니다.');
  if (
    maze &&
    (input.start !== maze.start || input.target !== maze.target || input.treeRoot !== undefined)
  )
    throw new Error('미로의 출발·출구와 탐색 입력이 일치해야 합니다.');
  const graph = maze
    ? mazeGraph(maze)
    : createGraph(input.graph.vertices, input.graph.edges, input.graph.directed);
  if (
    !graph.vertices.includes(input.start) ||
    (input.target !== null && !graph.vertices.includes(input.target))
  )
    throw new Error('시작과 목표는 등록된 정점 중에서 선택해 주세요.');
  const tree = input.treeRoot === undefined ? null : treeInfo(graph, input.treeRoot);
  const stepLimit = maze ? 2000 : 500;
  const capacity = maze ? maze.rows.length * maze.rows[0]!.length : 8;
  const maxSteps = input.maxSteps ?? stepLimit;
  if (!Number.isInteger(maxSteps) || maxSteps < 2 || maxSteps > stepLimit)
    throw new Error(`실행 한도는 2–${stepLimit}단계여야 합니다.`);
  const { lines, lineMap } = sourceCode(graph, algorithm, input.start, input.reverse, maze);
  const adjacency = Object.fromEntries(
    graph.vertices.map((v) => [
      v,
      maze ? mazeNeighbors(maze, v, input.reverse) : neighbors(graph, v, input.reverse),
    ]),
  );
  const codeId = `${maze ? 'maze' : 'graph'}-${algorithm}`;
  const metadata: RunMetadata = {
    exampleId: tree ? `tree-${algorithm}` : codeId,
    input: {
      graph: { directed: graph.directed, vertices: graph.vertices, edges: graph.edges },
      start: input.start,
      target: input.target,
      reverse: input.reverse,
      treeRoot: input.treeRoot ?? null,
      ...(maze
        ? {
            maze: { rows: maze.rows, start: maze.start, target: maze.target },
            recording: compact ? 'discoveries' : 'full',
          }
        : {}),
    },
    algorithmVersion: maze ? '1.1.0' : '1.0.0',
    code: { id: codeId, language: 'python', lines },
    lineMap,
    neighborOrder: maze
      ? input.reverse
        ? ['왼쪽', '아래', '오른쪽', '위']
        : ['위', '오른쪽', '아래', '왼쪽']
      : input.reverse
        ? [...graph.vertices].reverse()
        : [...graph.vertices],
    stepSemantics: 'after-event',
    limits: {
      maxSteps,
      maxDepth: capacity,
      maxInput: capacity,
      capacity,
      ...(compact ? { maxOperations: 50000 } : {}),
    },
    metricRules: {
      calls: '함수 호출: dfs 진입마다 1회. BFS 내장 메서드 호출은 펼치거나 합산하지 않습니다.',
      comparisons:
        '조건 검사: if의 방문 여부와 BFS while의 참·거짓 평가마다 1회. for 반복자의 종료 검사는 제외합니다.',
      assignments:
        '대입: 실행 중 parent 항목, u, v의 대입마다 1회. 준비 코드와 매개 변수 바인딩은 제외합니다.',
      arithmetic: maze
        ? '산술 연산: 탐색 본문에는 산술식이 없습니다. 격자→인접리스트 준비와 화면용 경로·깊이 계산은 집계하지 않습니다.'
        : '산술 연산: 표시한 탐색 코드에는 산술식이 없습니다. 화면용 경로·깊이 계산은 집계하지 않습니다.',
      maxDepth: '최대 호출 깊이: 동시에 살아 있는 dfs 프레임 수. BFS는 0입니다.',
      discoveries: '발견: visited에 처음 넣는 정점마다 1회. BFS는 큐 삽입 전에 표시합니다.',
      visits:
        '방문: order에 정점을 기록할 때 1회. BFS는 큐에서 꺼낸 후, DFS는 함수 진입 후 기록합니다.',
      edgeScans:
        '이웃 확인: for가 실제 이웃 하나를 가져올 때 1회. 무방향 간선은 양 끝에서 각각 확인합니다.',
      skipped:
        '중복 건너뜀: if에서 이미 발견한 이웃을 만날 때 1회. 펼치지 않은 하위 정점 수를 세지 않습니다.',
      finished: '처리 완료: 해당 정점의 모든 이웃 처리가 끝나 processed에 넣을 때 1회.',
      inserts: '큐 삽입: BFS queue.append가 실행될 때 1회. DFS는 0입니다.',
      removes: '큐 삭제: BFS queue.popleft가 실행될 때 1회. DFS는 0입니다.',
      maxSize:
        algorithm === 'bfs'
          ? '최대 대기 큐 크기: 동시에 대기하는 정점 수. 처리 중 정점은 제외합니다.'
          : '최대 콜 스택 크기: 동시에 살아 있는 dfs 호출 수. 최대 호출 깊이와 같은 값이며 합산하지 않습니다.',
    },
  };
  const recorder = new TraceRecorder(metadata);
  const search = {
    algorithm,
    start: input.start,
    target: input.target,
    current: null as string | null,
    discovered: [] as string[],
    processed: [] as string[],
    frontier: [] as string[],
    path: [] as string[],
    visitOrder: [] as string[],
    parents: {} as Record<string, string | null>,
    distances: {} as Record<string, number>,
    currentEdge: null as [string, string] | null,
    targetPath: [] as string[],
    outcome: 'pending' as const,
    pruned: [] as { target: string; reason: string }[],
  };
  const state: StepState = {
    source: null,
    activeFrameId: null,
    frames: [],
    globals: {},
    returnValue: unset(),
    returnInfo: null,
    structures: [],
    search,
    metrics: {
      calls: 0,
      comparisons: 0,
      assignments: 0,
      arithmetic: 0,
      maxDepth: 0,
      inserts: 0,
      removes: 0,
      maxSize: 0,
      discoveries: 0,
      visits: 0,
      edgeScans: 0,
      skipped: 0,
      finished: 0,
    },
  };
  let queue = createTraversalQueue(capacity);
  let last: Record<string, unknown> = {};
  let operations = 0;
  const pathTo = (vertex: string | null): string[] => {
    if (vertex === null || !(vertex in search.parents)) return [];
    const path: string[] = [];
    let cursor: string | null = vertex;
    while (cursor !== null) {
      path.unshift(cursor);
      cursor = search.parents[cursor] ?? null;
    }
    return path;
  };
  const bump = (key: keyof typeof state.metrics) => {
    state.metrics[key] = (state.metrics[key] ?? 0) + 1;
  };
  function emit(event: StepEvent, key: string | null, explanation: string) {
    // 같은 실행기의 사건을 집계하되, 코드 없는 비교에는 발견+부모가 갖춰진 장면만 저장한다.
    // 저장하지 않는 사건도 실행 한도에 포함한다. 애니메이션 장면 수와 연산 수는 다르다.
    if (compact && ++operations > 50000) recorder.limit('미로 탐색 실행 한도에 도달했습니다.');
    state.metrics.maxSize = Math.max(
      state.metrics.maxSize ?? 0,
      algorithm === 'bfs' ? queue.items.length : state.frames.length,
    );
    if (
      compact &&
      event !== 'initial' &&
      event !== 'complete' &&
      !(algorithm === 'bfs' ? key === 'parent' || key === 'parent-start' : event === 'discover')
    )
      return;
    state.source = key ? { codeId, line: lineMap[key]! } : null;
    if (event !== 'return') {
      state.returnInfo = null;
      if (event !== 'remove') state.returnValue = unset();
    }
    search.frontier =
      algorithm === 'bfs'
        ? queue.items.map((i) => graph.vertices[i]!)
        : state.frames.map((frame) =>
            String(frame.parameters.u?.kind === 'value' ? frame.parameters.u.value : ''),
          );
    search.path = pathTo(search.current);
    search.targetPath = pathTo(input.target);
    state.globals = {
      ...state.globals,
      start: value(input.start),
      visited: value(search.discovered),
      order: value(search.visitOrder),
      processed: value(search.processed),
      parent: value(search.parents),
    };
    if (algorithm === 'bfs') {
      state.globals.u ??= unset();
      state.globals.v ??= unset();
    }
    state.structures = [
      { kind: 'graph', id: 'input-graph', ...graph },
      ...(tree ? [{ kind: 'tree' as const, id: 'input-tree', info: tree }] : []),
    ];
    if (algorithm === 'bfs')
      state.structures.push({
        ...linearStructure(queue),
        id: 'frontier',
        items: [...search.frontier],
        removedValues: queue.removedValues.map((i) => graph.vertices[i]!),
      });
    else
      state.structures.push({
        kind: 'sequence',
        id: 'frontier',
        mode: 'stack',
        items: [...search.frontier],
        pointers: { Top: search.frontier.length ? search.frontier.length - 1 : null },
        capacity,
        removedValues: [],
        transition: null,
      });
    state.metrics.maxSize = Math.max(state.metrics.maxSize ?? 0, search.frontier.length);
    const now = {
      discovered: search.discovered,
      processed: search.processed,
      frontier: search.frontier,
      current: search.current,
      currentEdge: search.currentEdge,
      parents: search.parents,
      visitOrder: search.visitOrder,
      frames: state.frames,
      globals: state.globals,
    };
    const names: Record<string, string> = {
      discovered: '발견 기록',
      processed: '처리 완료',
      frontier: algorithm === 'bfs' ? '대기 큐' : '콜 스택',
      current: '현재 정점',
      currentEdge: '현재 이웃 간선',
      parents: '탐색 부모',
      visitOrder: '방문 순서',
      frames: '호출 프레임',
    };
    const changes: Change[] =
      event === 'initial'
        ? []
        : Object.entries(now)
            .filter(
              ([field, item]) =>
                field !== 'globals' && JSON.stringify(last[field]) !== JSON.stringify(item),
            )
            .map(([field, item]) => ({
              path: field === 'frames' ? 'frames' : `search.${field}`,
              before:
                last[field] === undefined
                  ? unset()
                  : value(JSON.parse(JSON.stringify(last[field]))),
              after: value(JSON.parse(JSON.stringify(item))),
              description: `${names[field]} 변경`,
            }));
    if (event !== 'initial') {
      const previousGlobals = last.globals as StepState['globals'];
      for (const [name, item] of Object.entries(state.globals)) {
        if (JSON.stringify(previousGlobals[name]) !== JSON.stringify(item))
          changes.push({
            path: `globals.${name}`,
            before: previousGlobals[name] ?? unset(),
            after: item,
            description: `전역 ${name} 변경`,
          });
      }
      const previousFrames = new Map(
        (last.frames as StepState['frames']).map((frame) => [frame.id, frame]),
      );
      for (const frame of state.frames) {
        const previousFrame = previousFrames.get(frame.id);
        for (const scope of ['parameters', 'locals'] as const)
          for (const [name, item] of Object.entries(frame[scope])) {
            const before = previousFrame?.[scope][name] ?? unset();
            if (JSON.stringify(before) !== JSON.stringify(item))
              changes.push({
                path: `frames.${frame.id}.${scope}.${name}`,
                before,
                after: item,
                description: `${frame.id}의 ${name} 변경`,
              });
          }
      }
    }
    recorder.emit(state, event, explanation, changes);
    last = structuredClone(now);
  }
  function parent(vertex: string, from: string | null) {
    search.parents[vertex] = from;
    search.distances[vertex] = from === null ? 0 : search.distances[from]! + 1;
    bump('assignments');
    emit(
      'assign',
      from === null ? 'parent-start' : 'parent',
      `${vertex}의 탐색 부모를 ${from ?? 'None(시작 정점)'}으로 기록합니다.`,
    );
  }
  function discover(vertex: string, initial = false) {
    search.discovered.push(vertex);
    bump('discoveries');
    emit(
      'discover',
      initial ? 'discover-start' : 'discover',
      `${vertex}를 처음 발견해 visited에 기록합니다. 이 기록은 탐색이 끝날 때까지 유지합니다.`,
    );
  }
  function visit(vertex: string) {
    search.visitOrder.push(vertex);
    bump('visits');
    emit(
      'visit',
      'visit',
      `${vertex}를 방문 순서 order에 기록합니다: ${search.visitOrder.join(' → ')}.`,
    );
  }
  function candidate(u: string, v: string): boolean {
    search.currentEdge = [u, v];
    search.pruned = [];
    bump('edgeScans');
    bump('assignments');
    if (algorithm === 'dfs') state.frames.at(-1)!.locals.v = value(v);
    else state.globals.v = value(v);
    emit('edge', 'edge', `${u}의 다음 이웃 ${v}를 확인합니다.`);
    bump('comparisons');
    const fresh = !search.discovered.includes(v);
    if (!fresh) {
      bump('skipped');
      search.pruned = [{ target: v, reason: '이미 발견한 정점이므로 중복 탐색하지 않음' }];
    }
    emit(
      'compare',
      'compare',
      fresh
        ? `${v}는 아직 발견하지 않았습니다. 새 탐색 대상으로 선택합니다.`
        : `${v}는 이미 발견했습니다. 큐 삽입·재귀 호출을 건너뜁니다.`,
    );
    return fresh;
  }
  function process(vertex: string) {
    search.currentEdge = null;
    search.pruned = [];
    search.processed.push(vertex);
    bump('finished');
    emit('process', 'process', `${vertex}의 모든 이웃 확인을 마쳤습니다. 처리 완료로 표시합니다.`);
  }
  const enqueue = (vertex: string, initial = false) => {
    queue = applyLinearCommand(queue, {
      type: 'insert',
      value: graph.vertices.indexOf(vertex),
    }).state;
    bump('inserts');
    emit(
      'insert',
      initial ? 'insert-start' : 'insert',
      `${vertex}를 큐의 Rear에 삽입합니다. Front부터 먼저 꺼냅니다.`,
    );
  };
  let frameCount = 0;
  function dfs(vertex: string, from: string | null) {
    const parentFrame = state.frames.at(-1);
    const location = { codeId, line: lineMap[from === null ? 'call-start' : 'call']! };
    const frame = {
      id: `dfs-${++frameCount}`,
      functionName: 'dfs',
      parentId: parentFrame?.id ?? null,
      parameters: { u: value(vertex) },
      locals: { v: unset() },
      callSite: location,
      returnTo: location,
    };
    state.frames.push(frame);
    state.activeFrameId = frame.id;
    search.current = vertex;
    search.currentEdge = null;
    search.pruned = [];
    bump('calls');
    state.metrics.maxDepth = Math.max(state.metrics.maxDepth, state.frames.length);
    emit(
      'call',
      from === null ? 'call-start' : 'call',
      `dfs(${vertex})를 호출합니다. 새 프레임 ${frame.id}의 u는 ${vertex}입니다.`,
    );
    discover(vertex);
    visit(vertex);
    for (const next of adjacency[vertex]!) {
      if (candidate(vertex, next)) {
        parent(next, vertex);
        dfs(next, vertex);
      }
    }
    process(vertex);
    state.frames.pop();
    state.activeFrameId = parentFrame?.id ?? null;
    search.current = from;
    state.returnValue = { kind: 'none' };
    state.returnInfo = {
      frameId: frame.id,
      targetFrameId: parentFrame?.id ?? null,
      target: location,
      value: { kind: 'none' },
    };
    emit(
      'return',
      'return',
      `${frame.id}를 제거하고 None을 반환합니다. ${from ? `dfs(${from})의 호출 줄 ${location.line}로 복귀합니다.` : '최상위 호출이 끝났습니다.'}`,
    );
  }
  try {
    emit(
      'initial',
      null,
      `그래프와 빈 기록을 준비했습니다. ${input.start}에서 닿는 정점만 ${algorithm.toUpperCase()}로 탐색합니다. 목표를 찾아도 이 탐색을 끝까지 진행합니다.`,
    );
    if (algorithm === 'bfs') {
      discover(input.start, true);
      parent(input.start, null);
      enqueue(input.start, true);
      while (true) {
        bump('comparisons');
        emit(
          'compare',
          'while',
          queue.items.length
            ? '큐가 비어 있지 않습니다. Front의 정점을 꺼냅니다.'
            : '큐가 비었습니다. 도달 가능한 정점을 모두 처리했습니다.',
        );
        if (!queue.items.length) break;
        const vertex = graph.vertices[queue.items[0]!]!;
        queue = applyLinearCommand(queue, { type: 'remove' }).state;
        search.current = vertex;
        search.currentEdge = null;
        search.pruned = [];
        bump('removes');
        bump('assignments');
        state.globals.u = value(vertex);
        state.returnValue = value(vertex);
        emit(
          'remove',
          'remove',
          `Front에서 ${vertex}를 꺼내 u에 대입합니다. 현재 처리할 정점은 대기 큐에서 빠집니다.`,
        );
        visit(vertex);
        for (const next of adjacency[vertex]!) {
          if (candidate(vertex, next)) {
            discover(next);
            parent(next, vertex);
            enqueue(next);
          }
        }
        process(vertex);
      }
    } else {
      parent(input.start, null);
      dfs(input.start, null);
    }
    search.current = null;
    search.currentEdge = null;
    search.pruned = [];
    state.search!.outcome =
      input.target === null
        ? 'traversed'
        : input.target in search.parents
          ? 'found'
          : 'unreachable';
    const unreachable = graph.vertices.filter((v) => !search.discovered.includes(v));
    emit(
      'complete',
      null,
      `탐색 완료. 방문 순서: ${search.visitOrder.join(' → ')}.${input.target ? (state.search!.outcome === 'found' ? ` 목표 ${input.target}까지의 ${algorithm === 'bfs' ? '최단 경로(모든 간선 비용 1)' : '발견 경로(최단 보장 없음)'}: ${pathTo(input.target).join(' → ')}.` : ` 목표 ${input.target}는 시작 정점에서 도달할 수 없습니다.`) : ''}${unreachable.length ? ` 미도달 정점: ${unreachable.join(', ')}.` : ''}`,
    );
  } catch (error) {
    if (!(error instanceof TraceLimit)) throw error;
  }
  return recorder.finish();
}

export const graphLesson = {
  title: '같은 그래프, 다른 탐색 순서',
  unit: 'Ⅱ 데이터 구조 · 그래프와 트리',
  origin: '교과 개념을 바탕으로 만든 변형 예제',
  goal: '그래프 표현을 연결하고, 큐를 쓰는 BFS와 재귀 콜 스택을 쓰는 DFS의 상태 변화를 설명한다.',
  observe:
    '현재 정점, 발견 기록, 대기 큐·콜 스택, 처리 완료, 탐색 부모와 경로. 트리에서는 루트·부모·자식·형제·단말·깊이도 관찰한다.',
  predict:
    'A의 이웃이 B, C일 때 BFS와 DFS는 다음에 어느 정점을 방문할까요? 이웃 순서를 뒤집으면 무엇이 달라질까요?',
  explain:
    '발견과 방문, 처리 완료가 다른 이유를 큐 또는 호출 프레임의 변화와 연결해 설명해 보세요.',
  compare:
    '같은 입력으로 BFS·DFS 결과 비교를 열어 방문 순서와 경로를 비교하세요. DFS의 경로가 더 길어질 수 있는 이유를 찾아보세요.',
  reapply:
    '간선을 하나 바꾸거나 연결되지 않은 정점을 추가하고, 새 방문 순서와 도달 가능 여부를 예상한 뒤 확인하세요.',
};
