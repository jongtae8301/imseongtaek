import { useId, useRef, useState, type PointerEvent } from 'react';
import type { DeepReadonly, Snapshot, SearchState, TreeDistanceStructure } from '../engine/types';
import type { Graph, TreeInfo } from '../structures/graph';
import { Panel } from './Panel';
import { Values } from './StatePanel';
import { formatValue } from './format';

export const graphFrom = (step: Snapshot | null) =>
  step?.structures.find((item) => item.kind === 'graph');
export const treeFrom = (step: Snapshot | null) =>
  step?.structures.find((item) => item.kind === 'tree')?.info;
export const distanceFrom = (step: Snapshot | null) =>
  step?.structures.find((item) => item.kind === 'tree-distance');
const chain = (items: readonly string[]) => (items.length ? items.join(' → ') : '없음');

export type GraphPoint = { x: number; y: number };
export type GraphEditing = {
  movable: boolean;
  onMove: (vertex: string, point: GraphPoint) => void;
  onBlank: (point: GraphPoint) => void;
  onEdge: (from: string, to: string) => void;
  edgeRemoval: boolean;
};

function vertexStatus(
  vertex: string,
  search: DeepReadonly<SearchState> | null | undefined,
  completed: boolean,
) {
  if (search?.current === vertex) return { key: 'current', text: '● 현재' };
  if (search?.processed.includes(vertex)) return { key: 'processed', text: '✓ 완료' };
  if (search?.frontier.includes(vertex))
    return { key: 'waiting', text: search.algorithm === 'bfs' ? '… 대기' : '… 호출 중' };
  if (search?.discovered.includes(vertex)) return { key: 'discovered', text: '＋ 발견' };
  return { key: 'unseen', text: completed ? '미도달' : '미발견' };
}

export function GraphCanvas({
  graph,
  tree,
  search,
  completed,
  selected,
  onSelect,
  preview = false,
  distance,
  positions: placed = {},
  editing,
}: {
  graph: DeepReadonly<Graph>;
  tree?: DeepReadonly<TreeInfo>;
  search?: DeepReadonly<SearchState> | null;
  completed: boolean;
  selected: string;
  onSelect: (vertex: string) => void;
  preview?: boolean;
  distance?: DeepReadonly<TreeDistanceStructure>;
  positions?: Record<string, GraphPoint>;
  editing?: GraphEditing;
}) {
  const [zoom, setZoom] = useState(1);
  const drag = useRef<{ vertex: string; x: number; y: number; moved: boolean } | null>(null);
  const draggedClick = useRef(false);
  const markerId = useId().replace(/:/g, '');
  const width = 560;
  const height = tree ? Math.max(290, (tree.height + 1) * 110 + 40) : 340;
  const positions: Record<string, { x: number; y: number }> = {};
  if (tree) {
    tree.nodes.forEach((node) => {
      const level = tree.nodes.filter((n) => n.depth === node.depth);
      positions[node.vertex] = {
        x: (width * (level.findIndex((n) => n.vertex === node.vertex) + 1)) / (level.length + 1),
        y: 55 + node.depth * 110,
      };
    });
  } else
    graph.vertices.forEach((v, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI * 2) / graph.vertices.length;
      positions[v] =
        graph.vertices.length === 1
          ? { x: 280, y: 150 }
          : { x: 280 + 205 * Math.cos(angle), y: 155 + 112 * Math.sin(angle) };
    });
  for (const vertex of graph.vertices)
    if (placed[vertex])
      positions[vertex] = {
        x: Math.max(36, Math.min(width - 36, placed[vertex].x)),
        y: Math.max(36, Math.min(height - 58, placed[vertex].y)),
      };
  function point(event: { clientX: number; clientY: number }, svg: SVGSVGElement): GraphPoint {
    const location = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      svg.getScreenCTM()!.inverse(),
    );
    return {
      x: Math.max(36, Math.min(width - 36, location.x)),
      y: Math.max(36, Math.min(height - 58, location.y)),
    };
  }
  function move(event: PointerEvent<SVGGElement>) {
    if (!drag.current || !editing?.movable) return;
    if (Math.hypot(event.clientX - drag.current.x, event.clientY - drag.current.y) > 4)
      drag.current.moved = true;
    if (drag.current.moved)
      editing.onMove(drag.current.vertex, point(event, event.currentTarget.ownerSVGElement!));
  }
  return (
    <>
      <div className="graph-canvas-toolbar">
        <span>
          {graph.directed ? '방향 →' : '무방향 ↔'} · 정점을 눌러 {preview ? '연결' : '관계'} 확인
        </span>
        <div>
          <button
            aria-label={preview ? '편집 그래프 축소' : '그래프 축소'}
            disabled={zoom <= 0.75}
            onClick={() => setZoom((z) => z - 0.25)}
          >
            −
          </button>
          <output aria-label={preview ? '편집 그래프 배율' : '그래프 배율'}>
            {Math.round(zoom * 100)}%
          </output>
          <button
            aria-label={preview ? '편집 그래프 확대' : '그래프 확대'}
            disabled={zoom >= 2}
            onClick={() => setZoom((z) => z + 0.25)}
          >
            ＋
          </button>
        </div>
      </div>
      <div
        className="graph-canvas-scroll"
        tabIndex={0}
        data-scroll-region
        aria-label="그래프 그림 가로 스크롤 영역"
      >
        <svg
          className={distance ? 'distance-graph' : undefined}
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: `${zoom * 100}%`, minWidth: 280 * zoom }}
          role="group"
          aria-label={
            preview
              ? '편집 중인 그래프 연결'
              : tree
                ? '루트와 부모 자식 트리'
                : '그래프 연결과 탐색 상태'
          }
          onClick={(event) => {
            if (
              editing &&
              (event.target === event.currentTarget ||
                (event.target as Element).hasAttribute('data-canvas-background'))
            )
              editing.onBlank(point(event, event.currentTarget));
          }}
        >
          <rect data-canvas-background width={width} height={height} fill="transparent" />
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
          </defs>
          {graph.edges.map(([a, b]) => {
            const p = positions[a]!;
            const q = positions[b]!;
            const dx = q.x - p.x,
              dy = q.y - p.y,
              length = Math.max(1, Math.hypot(dx, dy));
            const reciprocal = graph.directed && graph.edges.some(([x, y]) => x === b && y === a);
            const currentEdge = distance?.currentEdge ?? search?.currentEdge;
            const current =
              currentEdge &&
              ((currentEdge[0] === a && currentEdge[1] === b) ||
                ((!graph.directed || distance) && currentEdge[0] === b && currentEdge[1] === a));
            const route = (distance?.path ?? search?.targetPath)?.some(
              (v, i, arr) =>
                i > 0 &&
                ((arr[i - 1] === a && v === b) ||
                  ((!graph.directed || distance) && arr[i - 1] === b && v === a)),
            );
            const line = `M ${p.x + (dx / length) * 25} ${p.y + (dy / length) * 25} Q ${(p.x + q.x) / 2 + (reciprocal ? (-dy / length) * 22 : 0)} ${(p.y + q.y) / 2 + (reciprocal ? (dx / length) * 22 : 0)} ${q.x - (dx / length) * 29} ${q.y - (dy / length) * 29}`;
            return (
              <g key={`${a}-${b}`}>
                <path
                  className={`graph-edge ${current ? 'edge-current' : route ? 'edge-route' : ''}`}
                  d={line}
                  markerEnd={graph.directed ? `url(#${markerId})` : undefined}
                >
                  <title>
                    {a}
                    {graph.directed ? ' → ' : ' ↔ '}
                    {b}
                    {current
                      ? distance
                        ? ' · 부모 이동'
                        : ' · 확인 중'
                      : route
                        ? distance
                          ? ' · 두 노드 사이 경로'
                          : ' · 목표 경로'
                        : ''}
                  </title>
                </path>
                {editing?.edgeRemoval && (
                  <path
                    d={line}
                    className="graph-edge-hit"
                    role="button"
                    tabIndex={0}
                    aria-label={`편집 간선 ${a}${graph.directed ? ' → ' : ' ↔ '}${b} 해제`}
                    onClick={() => editing.onEdge(a, b)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        editing.onEdge(a, b);
                      }
                    }}
                  />
                )}
              </g>
            );
          })}
          {graph.vertices.map((vertex) => {
            const { x, y } = positions[vertex]!;
            const status = preview
              ? { key: 'unseen', text: '정점' }
              : distance
                ? distance.lca === vertex
                  ? { key: 'lca', text: '◎ LCA · a=b' }
                  : distance.a === vertex && distance.b === vertex
                    ? { key: 'current', text: '● a=b' }
                    : distance.a === vertex
                      ? { key: 'pointer-a', text: '● a' }
                      : distance.b === vertex
                        ? { key: 'pointer-b', text: '◆ b' }
                        : distance.trailA.includes(vertex) || distance.trailB.includes(vertex)
                          ? { key: 'processed', text: '↥ 이동 기록' }
                          : { key: 'unseen', text: '정점' }
                : vertexStatus(vertex, search, completed);
            return (
              <g
                key={vertex}
                className={`graph-node node-${status.key} ${selected === vertex ? 'node-selected' : ''}`}
                transform={`translate(${x} ${y})`}
                role="button"
                tabIndex={0}
                aria-label={
                  preview
                    ? `미리보기에서 ${vertex} 선택 · 정점`
                    : `정점 ${vertex} 선택 · ${status.text}`
                }
                aria-pressed={selected === vertex}
                data-draggable={editing?.movable || undefined}
                onPointerDown={(event) => {
                  draggedClick.current = false;
                  if (!editing?.movable || event.button !== 0) return;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drag.current = { vertex, x: event.clientX, y: event.clientY, moved: false };
                }}
                onPointerMove={move}
                onPointerUp={() => {
                  draggedClick.current = drag.current?.moved ?? false;
                  drag.current = null;
                }}
                onPointerCancel={() => {
                  drag.current = null;
                  draggedClick.current = false;
                }}
                onClick={(event) => {
                  if (event.detail > 0 && draggedClick.current) {
                    draggedClick.current = false;
                    return;
                  }
                  onSelect(vertex);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(vertex);
                  }
                }}
              >
                <circle className="selection-ring" r="29" />
                <circle r="23" />
                <text textAnchor="middle" dy="6" className="node-name">
                  {vertex}
                </text>
                <text textAnchor="middle" y="45" className="node-status">
                  {status.text}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      {!preview && (
        <div className="graph-legend">
          {distance ? (
            <>
              {distance.currentEdge && (
                <strong>이번 부모 이동: {distance.currentEdge.join(' → ')}</strong>
              )}
              <span>● a / ◆ b · 현재 포인터</span>
              <span>◎ LCA · 최소 공통 조상</span>
              <span>선: 주황 = 부모 이동 / 파랑 = 두 노드 사이 경로</span>
              <span>화살표는 부모→자식 관계 · 이동은 부모 방향</span>
            </>
          ) : (
            <>
              <span>● 현재</span>
              <span>＋ 발견</span>
              <span>… 대기·호출 중</span>
              <span>✓ 완료</span>
              <span>선: 주황 = 확인 중 / 파랑 = 목표 경로</span>
            </>
          )}
        </div>
      )}
    </>
  );
}

export function GraphVisualPanel({
  step,
  selected,
  onSelect,
}: {
  step: Snapshot | null;
  selected: string;
  onSelect: (v: string) => void;
}) {
  const graph = graphFrom(step);
  const tree = treeFrom(step);
  return (
    <Panel
      id="visualization"
      number="02"
      title="시각화"
      icon="tree"
      stepIndex={step?.index ?? null}
      meta={tree ? `루트 ${tree.root} · 높이 ${tree.height}` : '연결과 탐색 상태'}
    >
      {graph ? (
        <GraphCanvas
          graph={graph}
          tree={tree}
          search={step?.search}
          distance={distanceFrom(step)}
          completed={step?.status === 'completed'}
          selected={selected}
          onSelect={onSelect}
        />
      ) : (
        <p className="empty-small">입력을 적용하면 그래프와 탐색 상태가 표시됩니다.</p>
      )}
    </Panel>
  );
}

export function GraphStatePanel({ step, selected }: { step: Snapshot | null; selected: string }) {
  const search = step?.search;
  const tree = treeFrom(step);
  const graph = graphFrom(step);
  const relation = tree?.nodes.find((n) => n.vertex === selected);
  const frame = step?.frames.find((f) => f.id === step.activeFrameId);
  return (
    <Panel
      id="state"
      number="03"
      title="현재 상태"
      icon="state"
      stepIndex={step?.index ?? null}
      meta={search?.algorithm.toUpperCase()}
    >
      {step && search ? (
        <div className="state-content graph-state">
          <dl className="search-facts">
            <div>
              <dt>현재 정점</dt>
              <dd data-current-vertex>{search.current ?? '없음'}</dd>
            </div>
            <div>
              <dt>방문 순서 · order</dt>
              <dd data-visit-order>{chain(search.visitOrder)}</dd>
            </div>
            <div>
              <dt>현재 경로</dt>
              <dd>{chain(search.path)}</dd>
            </div>
            <div>
              <dt>목표 {search.target ?? '미지정'} 경로</dt>
              <dd data-target-path>
                {search.targetPath.length
                  ? chain(search.targetPath)
                  : search.outcome === 'unreachable'
                    ? '도달 불가'
                    : '아직 없음'}
              </dd>
            </div>
          </dl>
          <p className="panel-footnote">
            {search.algorithm === 'bfs'
              ? 'BFS 경로는 모든 간선 비용이 1일 때 최단입니다.'
              : 'DFS는 처음 발견한 경로를 기록하며 최단 경로를 보장하지 않습니다.'}{' '}
            목표를 발견해도 시작 정점에서 닿는 영역을 끝까지 탐색합니다.
          </p>
          <div className="vertex-inspector" data-vertex-info>
            <h3>
              선택 정점 {selected} ·{' '}
              {vertexStatus(selected, search, step.status === 'completed').text}
            </h3>
            <p>
              탐색 부모:{' '}
              {selected in search.parents
                ? (search.parents[selected] ?? '없음 · 시작 정점')
                : '아직 없음'}{' '}
              · 발견 경로의 간선 수: {search.distances[selected] ?? '아직 없음'}
            </p>
            {relation && (
              <p>
                트리 부모: {relation.parent ?? '없음 · 루트'} / 자식:{' '}
                {relation.children.join(', ') || '없음'} / 형제:{' '}
                {relation.siblings.join(', ') || '없음'} / 깊이: {relation.depth} /{' '}
                {relation.leaf ? '단말 노드' : '내부 노드'}
                {relation.arrayIndex !== null ? ` / 배열 인덱스: ${relation.arrayIndex}` : ''}
              </p>
            )}
          </div>
          {search.pruned.map((item) => (
            <p className="skip-notice" key={item.target}>
              ↷ {item.target}: {item.reason}
            </p>
          ))}
          {step.status === 'completed' && (
            <p className="panel-footnote">
              미도달 정점:{' '}
              {graph?.vertices.filter((v) => !search.discovered.includes(v)).join(', ') || '없음'}
            </p>
          )}
          <details>
            <summary>전역 변수와 활성 프레임</summary>
            <p className="panel-footnote">
              visited는 Python의 집합입니다. 여기서는 발견 순서를 관찰할 수 있도록 목록으로
              표시합니다. 아직 실행하지 않은 u·v는 ‘아직 없음’입니다.
            </p>
            <Values label="전역 변수" items={step.globals} prefix="globals" step={step} />
            {frame && (
              <>
                <Values
                  label={`매개 변수 · ${frame.id}`}
                  items={frame.parameters}
                  prefix={`frames.${frame.id}.parameters`}
                  step={step}
                />
                <Values
                  label="지역 변수"
                  items={frame.locals}
                  prefix={`frames.${frame.id}.locals`}
                  step={step}
                />
              </>
            )}
          </details>
          {step.returnInfo && (
            <p className="return-notice has-return">
              {step.returnInfo.frameId} 제거 → {step.returnInfo.targetFrameId ?? '전역'} ·{' '}
              {step.returnInfo.target.line}번 줄 복귀 · {formatValue(step.returnValue)}
            </p>
          )}
          {!!step.changes.length && (
            <p className="change-summary">
              △ 이번 단계: {step.changes.map((c) => c.description).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p className="empty-small">탐색 준비를 누르면 상태가 표시됩니다.</p>
      )}
    </Panel>
  );
}

export function GraphStructuresPanel({ step }: { step: Snapshot | null }) {
  const search = step?.search;
  const graph = graphFrom(step);
  const tree = treeFrom(step);
  const distance = distanceFrom(step);
  // 연결 표현만 변환한다. 방문 순서나 탐색 결과를 계산하지 않는다.
  const linked = (a: string, b: string) =>
    graph?.edges.some(([x, y]) => (x === a && y === b) || (!graph.directed && x === b && y === a));
  return (
    <Panel
      id="structures"
      number="04"
      title="자료구조"
      icon="stack"
      stepIndex={step?.index ?? null}
      meta={
        distance
          ? '부모·깊이 · 이진 배열'
          : search?.algorithm === 'dfs'
            ? '재귀 콜 스택 · LIFO'
            : '대기 큐 · FIFO'
      }
    >
      {step && (search || distance) && graph ? (
        <div className="graph-structures">
          {search && (
            <>
              <h3>
                {search.algorithm === 'bfs' ? '대기 큐 · Front → Rear' : '콜 스택 · 아래 → Top'}
              </h3>
              <div className="frontier-strip" data-frontier>
                {search.frontier.length ? (
                  search.frontier.map((v, i) => (
                    <div key={`${i}-${v}`}>
                      <strong>{v}</strong>
                      <small>
                        {search.algorithm === 'bfs'
                          ? [i === 0 ? 'Front' : '', i === search.frontier.length - 1 ? 'Rear' : '']
                              .filter(Boolean)
                              .join(' / ')
                          : i === search.frontier.length - 1
                            ? 'Top'
                            : `깊이 ${i + 1}`}
                      </small>
                    </div>
                  ))
                ) : (
                  <p>
                    빈 {search.algorithm === 'bfs' ? '큐 · Front/Rear 없음' : '스택 · Top 없음'}
                  </p>
                )}
              </div>
              <p className="panel-footnote">
                {search.algorithm === 'bfs'
                  ? '현재 처리 중인 정점은 큐에서 빠져 있습니다.'
                  : '프레임은 현재 호출과 복귀를 기다리는 조상 호출을 함께 담습니다. 방문 기록은 복귀해도 지우지 않습니다.'}
              </p>
              {search.algorithm === 'dfs' && (
                <ol className="dfs-frames" aria-label="DFS 호출 프레임">
                  {[...step.frames].reverse().map((frame) => (
                    <li
                      key={frame.id}
                      className={frame.id === step.activeFrameId ? 'active-frame' : ''}
                    >
                      <strong>
                        {frame.id} {frame.id === step.activeFrameId ? '● 활성' : '… 복귀 대기'}
                      </strong>
                      <span>
                        u = {formatValue(frame.parameters.u)} · v = {formatValue(frame.locals.v)}
                      </span>
                      <small>
                        부모 호출 {frame.parentId ?? '전역'} · 복귀 {frame.returnTo.line}번 줄
                      </small>
                    </li>
                  ))}
                </ol>
              )}
              <p className="search-record">
                ＋ 발견: {search.discovered.join(', ') || '없음'}
                <br />✓ 처리 완료: {search.processed.join(', ') || '없음'}
              </p>
            </>
          )}
          {distance && (
            <p className="panel-footnote">
              ● a = {distance.a ?? '아직 없음'} / ◆ b = {distance.b ?? '아직 없음'} · 부모 조회로
              이동하며 큐·콜 스택은 사용하지 않습니다.
            </p>
          )}
          <details>
            <summary>같은 연결의 인접행렬·인접리스트</summary>
            <div className="representation-editor">
              <div className="table-scroll" tabIndex={0} data-scroll-region>
                <table className="adjacency-table">
                  <caption>행·열 순서: {graph.vertices.join(', ')}</caption>
                  <thead>
                    <tr>
                      <th>정점</th>
                      {graph.vertices.map((v) => (
                        <th key={v} scope="col">
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {graph.vertices.map((a) => (
                      <tr key={a}>
                        <th scope="row">{a}</th>
                        {graph.vertices.map((b) => (
                          <td key={b}>{linked(a, b) ? 1 : 0}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <pre aria-label="현재 인접리스트">
                {graph.vertices
                  .map((a) => `${a}: ${graph.vertices.filter((b) => linked(a, b)).join(' ')}`)
                  .join('\n')}
              </pre>
            </div>
            <p className="panel-footnote">
              {distance
                ? '부모→자식 연결을 그대로 표시합니다. 거리 계산은 아래 부모 관계를 따라 올라갑니다.'
                : '표현은 정점 순서로 정렬합니다. 실제 이웃 방문 순서는 위 설정과 Python 코드의 adj를 따릅니다.'}
            </p>
          </details>
          {tree && (
            <details open>
              <summary>트리 관계와 배열 표현</summary>
              <div className="table-scroll" tabIndex={0} data-scroll-region>
                <table className="tree-table">
                  <caption>
                    루트 {tree.root} · 루트 깊이 0 · 높이 {tree.height}
                  </caption>
                  <thead>
                    <tr>
                      <th>정점</th>
                      <th>부모</th>
                      <th>자식</th>
                      <th>형제</th>
                      <th>깊이</th>
                      <th>단말</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tree.nodes.map((n) => (
                      <tr
                        key={n.vertex}
                        className={
                          distance && (distance.a === n.vertex || distance.b === n.vertex)
                            ? 'tree-pointer-row'
                            : ''
                        }
                      >
                        <th scope="row">
                          {n.vertex}
                          {distance?.a === n.vertex ? ' ●a' : ''}
                          {distance?.b === n.vertex ? ' ◆b' : ''}
                        </th>
                        <td>{n.parent ?? '없음'}</td>
                        <td>{n.children.join(', ') || '없음'}</td>
                        <td>{n.siblings.join(', ') || '없음'}</td>
                        <td>{n.depth}</td>
                        <td>{n.leaf ? '예' : '아니요'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tree.binary ? (
                <>
                  <p className="panel-footnote">
                    이진 트리 · 루트 1, 왼쪽 2i, 오른쪽 2i+1, 부모 ⌊i/2⌋. 정점 순서의 첫 자식을
                    왼쪽으로 두며, 자식이 하나면 왼쪽으로 둡니다. 0번은 사용하지 않습니다.
                  </p>
                  <div
                    className="binary-array"
                    tabIndex={0}
                    data-scroll-region
                    aria-label="이진 트리 배열"
                  >
                    {tree.array.slice(1).map((v, i) => (
                      <div
                        key={i}
                        className={
                          v && distance && (distance.a === v || distance.b === v)
                            ? 'tree-pointer-row'
                            : ''
                        }
                      >
                        <small>{i + 1}</small>
                        <strong>{v ?? '빈칸'}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="panel-footnote">
                  자식이 셋 이상인 정점이 있어 이진 트리가 아닙니다. 이진 트리 배열 규칙을 적용하지
                  않습니다.
                </p>
              )}
            </details>
          )}
        </div>
      ) : (
        <p className="empty-small">탐색 준비를 누르면 구조가 표시됩니다.</p>
      )}
    </Panel>
  );
}
