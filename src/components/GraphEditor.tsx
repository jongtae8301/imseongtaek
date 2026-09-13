import { useEffect, useState } from 'react';
import { GraphCanvas, type GraphPoint } from './GraphPanels';
import {
  adjacencyMatrix,
  createGraph,
  listText,
  matrixText,
  parseList,
  parseMatrix,
  setDirection,
  setEdge,
  treeInfo,
  type Graph,
} from '../structures/graph';

export function GraphEditor({
  graph,
  isTree,
  onChange,
  onDraft,
  root,
}: {
  graph: Graph;
  isTree: boolean;
  onChange: (graph: Graph) => void;
  onDraft: (pending: boolean) => void;
  root?: string;
}) {
  const [mode, setMode] = useState<'matrix' | 'list'>('matrix');
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [newVertex, setNewVertex] = useState('');
  const [from, setFrom] = useState(graph.vertices[0]!);
  const [to, setTo] = useState(graph.vertices[1] ?? graph.vertices[0]!);
  const [remove, setRemove] = useState(graph.vertices.at(-1)!);
  const [selected, setSelected] = useState(graph.vertices[0]!);
  const [tool, setTool] = useState<'move' | 'add' | 'connect' | 'disconnect' | 'delete'>('move');
  const [anchor, setAnchor] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, GraphPoint>>({});
  useEffect(() => {
    setRaw(null);
    setError('');
    setFrom((v) => (graph.vertices.includes(v) ? v : graph.vertices[0]!));
    setTo((v) => (graph.vertices.includes(v) ? v : (graph.vertices[1] ?? graph.vertices[0]!)));
    setRemove((v) => (graph.vertices.includes(v) ? v : graph.vertices.at(-1)!));
    setSelected((v) => (graph.vertices.includes(v) ? v : graph.vertices[0]!));
    setAnchor(null);
    setPositions((previous) =>
      Object.fromEntries(Object.entries(previous).filter(([v]) => graph.vertices.includes(v))),
    );
  }, [graph]);
  function change(action: () => Graph) {
    try {
      onChange(action());
      setError('');
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }
  let previewTree;
  if (isTree && root) {
    try {
      previewTree = treeInfo(graph, root);
    } catch {
      /* 잘못된 트리는 원래 연결 그대로 보이고 준비 시 검증한다. */
    }
  }
  function chooseVertex(vertex: string) {
    setSelected(vertex);
    if (raw !== null) return;
    if (tool === 'delete')
      change(() =>
        createGraph(
          graph.vertices.filter((v) => v !== vertex),
          graph.edges.filter(([a, b]) => a !== vertex && b !== vertex),
          graph.directed,
        ),
      );
    if (tool === 'connect' || tool === 'disconnect') {
      if (anchor === null) setAnchor(vertex);
      else {
        change(() => setEdge(graph, anchor, vertex, tool === 'connect'));
        setAnchor(null);
      }
    }
  }
  const matrix = adjacencyMatrix(graph);
  return (
    <details className="graph-editor">
      <summary>
        그림·연결 편집 · 인접행렬 · 인접리스트{' '}
        <span>
          {graph.vertices.length}개 정점 / {graph.edges.length}개 간선
        </span>
      </summary>
      <div className="graph-editor-body">
        <p className="panel-footnote">
          정점 1–8개 · A–Z 한 글자 · 자기 루프·중복 간선 없음. 편집하면 실행을 멈추고 이전 기록을
          지웁니다.
        </p>
        <div className="graph-editor-workbench">
          <section className="graph-draft-preview" aria-label="편집 중인 그래프">
            <h3>편집 중인 그래프 · 실행 전 연결 미리보기</h3>
            <p className="panel-footnote">
              {raw !== null
                ? '문자 입력은 아직 적용하지 않았습니다. 아래 그림은 마지막으로 적용한 연결입니다.'
                : isTree
                  ? '부모 → 자식 간선을 보여 줍니다. 트리의 유효성은 탐색 준비에서 확인합니다.'
                  : '정점·간선 변경을 바로 보여 줍니다. 탐색 상태는 탐색 준비 후 표시됩니다.'}
            </p>
            <fieldset className="graph-tools" disabled={raw !== null}>
              <legend>그림 편집 도구</legend>
              {(
                [
                  ['move', '선택·이동'],
                  ['add', '정점 넣기'],
                  ['connect', '연결하기'],
                  ['disconnect', '연결 지우기'],
                  ['delete', '정점 지우기'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={tool === key}
                  onClick={() => {
                    setTool(key);
                    setAnchor(null);
                    setError('');
                  }}
                >
                  {label}
                </button>
              ))}
              <button onClick={() => setPositions({})}>자동 배치</button>
            </fieldset>
            <p className="graph-tool-hint" role="status">
              {raw !== null
                ? '문자 입력을 적용하거나 취소하면 그림을 수정할 수 있습니다.'
                : tool === 'move'
                  ? '정점을 끌어 배치하세요. 위치 이동은 연결과 실행 기록을 바꾸지 않습니다.'
                  : tool === 'add'
                    ? '그림의 빈 곳을 누르면 다음 알파벳 정점을 넣습니다. 키보드로는 오른쪽 정점 추가를 이용하세요.'
                    : tool === 'delete'
                      ? '지울 정점을 누르세요. 그 정점에 연결된 간선도 함께 지웁니다.'
                      : anchor
                        ? `${anchor} ${graph.directed ? '→' : '↔'} 연결의 다른 정점을 누르세요.`
                        : tool === 'connect'
                          ? '연결할 두 정점을 차례로 누르세요. 트리는 부모, 자식 순서입니다.'
                          : '간선을 누르거나, 연결을 지울 두 정점을 차례로 누르세요.'}
              {anchor && <button onClick={() => setAnchor(null)}>선택 취소</button>}
            </p>
            <GraphCanvas
              graph={graph}
              completed={false}
              selected={selected}
              onSelect={chooseVertex}
              preview
              tree={previewTree}
              positions={positions}
              editing={
                raw !== null
                  ? undefined
                  : {
                      movable: tool === 'move',
                      onMove: (vertex, point) =>
                        setPositions((previous) => ({ ...previous, [vertex]: point })),
                      onBlank: (point) => {
                        if (tool !== 'add') return;
                        const vertex = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
                          .split('')
                          .find((v) => !graph.vertices.includes(v))!;
                        if (
                          change(() =>
                            createGraph([...graph.vertices, vertex], graph.edges, graph.directed),
                          )
                        ) {
                          setPositions((previous) => ({ ...previous, [vertex]: point }));
                          setSelected(vertex);
                        }
                      },
                      edgeRemoval: tool === 'disconnect',
                      onEdge: (a, b) => change(() => setEdge(graph, a, b, false)),
                    }
              }
            />
            <p className="draft-connections">
              선택 {selected} · {graph.directed ? '나가는 연결' : '연결된 정점'}:{' '}
              {graph.vertices
                .filter((v) =>
                  graph.edges.some(
                    ([a, b]) =>
                      (a === selected && b === v) || (!graph.directed && b === selected && a === v),
                  ),
                )
                .join(', ') || '없음'}
            </p>
          </section>
          <div className="graph-editor-inputs">
            <fieldset disabled={raw !== null}>
              <legend>정점과 간선</legend>
              {!isTree && (
                <label className="direction-control">
                  간선 방향{' '}
                  <select
                    aria-label="간선 방향"
                    value={String(graph.directed)}
                    onChange={(e) => change(() => setDirection(graph, e.target.value === 'true'))}
                  >
                    <option value="false">무방향</option>
                    <option value="true">방향</option>
                  </select>
                </label>
              )}
              <p className="panel-footnote">
                {isTree
                  ? '트리 간선은 부모 → 자식으로 입력합니다. 탐색 준비 시 루트와 연결 구조를 검증합니다.'
                  : '무방향 → 방향 전환은 양방향 간선을 만듭니다. 방향 → 무방향은 반대 방향의 두 간선을 하나로 합칩니다.'}
              </p>
              <div className="graph-edit-row">
                <label>
                  새 정점{' '}
                  <input
                    aria-label="새 정점"
                    maxLength={1}
                    value={newVertex}
                    onChange={(e) => setNewVertex(e.target.value.toUpperCase())}
                    autoComplete="off"
                  />
                </label>
                <button
                  onClick={() =>
                    change(() =>
                      createGraph([...graph.vertices, newVertex], graph.edges, graph.directed),
                    )
                  }
                >
                  정점 추가
                </button>
                <label>
                  삭제할 정점{' '}
                  <select value={remove} onChange={(e) => setRemove(e.target.value)}>
                    {graph.vertices.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() =>
                    change(() =>
                      createGraph(
                        graph.vertices.filter((v) => v !== remove),
                        graph.edges.filter(([a, b]) => a !== remove && b !== remove),
                        graph.directed,
                      ),
                    )
                  }
                >
                  정점 삭제
                </button>
              </div>
              <div className="graph-edit-row">
                <label>
                  간선 시작{' '}
                  <select value={from} onChange={(e) => setFrom(e.target.value)}>
                    {graph.vertices.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  간선 끝{' '}
                  <select value={to} onChange={(e) => setTo(e.target.value)}>
                    {graph.vertices.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => change(() => setEdge(graph, from, to, true))}>
                  간선 연결
                </button>
                <button onClick={() => change(() => setEdge(graph, from, to, false))}>
                  간선 해제
                </button>
              </div>
            </fieldset>
            <div className="representation-tabs" role="group" aria-label="입력 표현 선택">
              <button
                aria-pressed={mode === 'matrix'}
                disabled={raw !== null && mode !== 'matrix'}
                onClick={() => setMode('matrix')}
              >
                인접행렬 편집
              </button>
              <button
                aria-pressed={mode === 'list'}
                disabled={raw !== null && mode !== 'list'}
                onClick={() => setMode('list')}
              >
                인접리스트 편집
              </button>
            </div>
            <div className="representation-editor">
              <div>
                <label htmlFor="graph-text">
                  {mode === 'matrix' ? '행렬 입력' : '리스트 입력'}
                </label>
                <textarea
                  id="graph-text"
                  spellCheck={false}
                  rows={Math.max(4, graph.vertices.length)}
                  value={raw ?? (mode === 'matrix' ? matrixText(graph) : listText(graph))}
                  onChange={(e) => {
                    setRaw(e.target.value);
                    setAnchor(null);
                    setError('');
                    onDraft(true);
                  }}
                  aria-describedby="representation-help"
                  aria-invalid={!!error}
                />
                <p id="representation-help" className="panel-footnote">
                  {mode === 'matrix'
                    ? `행·열 순서: ${graph.vertices.join(', ')}. 공백으로 구분한 0과 1만 입력합니다. 무방향은 대칭이어야 합니다.`
                    : '한 행에 A: B C 형식으로 적습니다. 행 순서가 정점 순서가 됩니다. 무방향 연결은 양쪽에 적고, 이웃 없는 정점도 A: 로 적어 주세요.'}
                </p>
                <div className="graph-edit-row">
                  <button
                    className="primary-button"
                    onClick={() => {
                      try {
                        const next =
                          mode === 'matrix'
                            ? parseMatrix(raw ?? matrixText(graph), graph.vertices, graph.directed)
                            : parseList(raw ?? listText(graph), graph.directed);
                        setRaw(null);
                        onDraft(false);
                        onChange(next);
                        setError('');
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }}
                  >
                    표현 적용
                  </button>
                  {raw !== null && (
                    <button
                      onClick={() => {
                        setRaw(null);
                        setError('');
                        onDraft(false);
                      }}
                    >
                      문자 입력 취소
                    </button>
                  )}
                </div>
              </div>
              <div
                className="table-scroll"
                tabIndex={0}
                data-scroll-region
                aria-label="클릭으로 연결 편집"
              >
                <table className="adjacency-table">
                  <caption>행 = 시작 · 열 = 끝 {graph.directed ? '→' : '↔'}</caption>
                  <thead>
                    <tr>
                      <th scope="col">정점</th>
                      {graph.vertices.map((v) => (
                        <th scope="col" key={v}>
                          {v}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {matrix.map((row, i) => (
                      <tr key={graph.vertices[i]}>
                        <th scope="row">{graph.vertices[i]}</th>
                        {row.map((cell, j) => (
                          <td key={j}>
                            <button
                              disabled={i === j || raw !== null}
                              aria-label={`${graph.vertices[i]}에서 ${graph.vertices[j]} 연결 ${cell ? '해제' : '추가'}`}
                              aria-pressed={cell === 1}
                              onClick={() =>
                                change(() =>
                                  setEdge(graph, graph.vertices[i]!, graph.vertices[j]!, !cell),
                                )
                              }
                            >
                              {cell}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {error && (
              <p role="alert" className="input-error">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
