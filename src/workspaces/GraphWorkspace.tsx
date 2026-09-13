import { useRef, useState, type ReactNode } from 'react';
import type { ExecutionRun } from '../engine/types';
import {
  buildSearchRun,
  graphLesson,
  type SearchAlgorithm,
  type SearchInput,
} from '../examples/graph-search';
import { createGraph, graphSamples, type Graph } from '../structures/graph';
import { usePlayer } from '../player/use-player';
import { CodePanel } from '../components/CodePanel';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { PlaybackControls } from '../components/PlaybackControls';
import { RunSummary } from '../components/RunSummary';
import { LessonGuide } from '../components/LessonGuide';
import { GraphEditor } from '../components/GraphEditor';
import { GraphStatePanel, GraphStructuresPanel, GraphVisualPanel } from '../components/GraphPanels';
import {
  ObservationControls,
  ObservationPanels,
  useObservationView,
} from '../components/ObservationPanels';

const initialGraphRun = buildSearchRun('bfs', {
  graph: graphSamples.cycle,
  start: 'A',
  target: 'F',
  reverse: false,
});
const initialTreeRun = buildSearchRun('bfs', {
  graph: graphSamples.tree,
  start: 'A',
  target: 'F',
  reverse: false,
  treeRoot: 'A',
});

type SearchComparison = Record<SearchAlgorithm, ExecutionRun>;
function Comparison({
  runs,
  algorithm,
  index,
  positions,
  onInspect,
}: {
  runs: SearchComparison;
  algorithm: SearchAlgorithm;
  index: number;
  positions: Record<SearchAlgorithm, number>;
  onInspect: (algorithm: SearchAlgorithm) => void;
}) {
  return (
    <section className="search-comparison" aria-label="BFS·DFS 결과 비교">
      <h2>같은 입력으로 결과 비교</h2>
      <p>
        아래는 각 알고리즘의 독립된 최종 기록입니다. 단계 보기로 큐·콜 스택과 방문 과정을
        관찰하세요. 같은 단계 번호는 같은 계산량을 뜻하지 않습니다.
      </p>
      <div className="comparison-grid">
        {Object.values(runs).map((run) => {
          const last = run.steps.at(-1)!;
          const search = last.search!;
          return (
            <article key={search.algorithm} data-comparison={search.algorithm}>
              <h3>
                {search.algorithm.toUpperCase()}{' '}
                <small>{last.status === 'completed' ? '정상 종료' : '한도 도달 · 미완료'}</small>
              </h3>
              <dl className="search-facts">
                <div>
                  <dt>방문 순서</dt>
                  <dd>{search.visitOrder.join(' → ') || '아직 없음'}</dd>
                </div>
                <div>
                  <dt>목표 경로</dt>
                  <dd>
                    {search.targetPath.join(' → ') ||
                      (search.outcome === 'unreachable'
                        ? '도달 불가'
                        : search.target === null
                          ? '목표 미지정'
                          : '아직 없음')}
                  </dd>
                </div>
                <div>
                  <dt>발견 / 이웃 확인 / 중복 건너뜀</dt>
                  <dd>
                    {last.metrics.discoveries}개 / {last.metrics.edgeScans}회 /{' '}
                    {last.metrics.skipped}회
                  </dd>
                </div>
                <div>
                  <dt>최대 {search.algorithm === 'bfs' ? '큐' : '콜 스택'}</dt>
                  <dd>{last.metrics.maxSize}개</dd>
                </div>
                <div>
                  <dt>실행 기록</dt>
                  <dd>{run.steps.length - 1}단계 (초기 상태 제외)</dd>
                </div>
              </dl>
              <button
                aria-pressed={algorithm === search.algorithm}
                onClick={() => onInspect(search.algorithm)}
              >
                {search.algorithm.toUpperCase()} 단계 보기
              </button>
              <p className="panel-footnote">
                관찰 위치 {algorithm === search.algorithm ? index : positions[search.algorithm]} /{' '}
                {run.steps.length - 1} · 위치를 따로 기억합니다.
              </p>
              <p className="panel-footnote">
                {search.algorithm === 'bfs'
                  ? '모든 간선 비용 1 → 발견한 경로는 최단'
                  : '발견 경로 → 최단 경로 보장 없음'}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function GraphWorkspace({
  isTree = false,
  activityControl,
}: {
  isTree?: boolean;
  activityControl?: ReactNode;
}) {
  const view = useObservationView();
  const [graph, setGraph] = useState<Graph>(isTree ? graphSamples.tree : graphSamples.cycle);
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('bfs');
  const [start, setStart] = useState('A');
  const [target, setTarget] = useState('F');
  const [root, setRoot] = useState('A');
  const [reverse, setReverse] = useState(false);
  const [selected, setSelected] = useState('A');
  const [rawPending, setRawPending] = useState(false);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<SearchComparison | null>(null);
  const positions = useRef<Record<SearchAlgorithm, number>>({ bfs: 0, dfs: 0 });
  const { player, run, step, index, playing, delay } = usePlayer(
    isTree ? initialTreeRun : initialGraphRun,
  );
  function invalidate() {
    player.load(null);
    setComparison(null);
    setError('');
    positions.current = { bfs: 0, dfs: 0 };
  }
  function changeGraph(next: Graph) {
    invalidate();
    setGraph(createGraph(next.vertices, next.edges, next.directed));
    setRawPending(false);
    if (!next.vertices.includes(start)) setStart(next.vertices[0]!);
    if (!next.vertices.includes(target)) setTarget('');
    if (!next.vertices.includes(root)) setRoot(next.vertices[0]!);
    if (!next.vertices.includes(selected)) setSelected(next.vertices[0]!);
  }
  function input(): SearchInput {
    return {
      graph,
      start,
      target: target || null,
      reverse,
      ...(isTree ? { treeRoot: root } : {}),
    };
  }
  function apply() {
    try {
      player.load(buildSearchRun(algorithm, input()));
      setComparison(null);
      positions.current = { bfs: 0, dfs: 0 };
      setError('');
    } catch (err) {
      player.load(null);
      setError((err as Error).message);
    }
  }
  function compare() {
    if (!run) return;
    const next: SearchComparison = {
      bfs: algorithm === 'bfs' ? run : buildSearchRun('bfs', input()),
      dfs: algorithm === 'dfs' ? run : buildSearchRun('dfs', input()),
    };
    positions.current = {
      bfs: algorithm === 'bfs' ? index : 0,
      dfs: algorithm === 'dfs' ? index : 0,
    };
    player.load(next[algorithm]);
    player.seek(index);
    setComparison(next);
  }
  function inspect(next: SearchAlgorithm) {
    if (!comparison) return;
    positions.current[algorithm] = index;
    setAlgorithm(next);
    player.load(comparison[next]);
    player.seek(positions.current[next]);
    view.revealCode();
  }
  return (
    <>
      <main id="workspace" className={view.focused ? 'is-focused' : ''}>
        <ObservationControls
          view={view}
          title={`${isTree ? '트리' : '그래프'} · ${algorithm.toUpperCase()} · 시작 ${start} / 목표 ${target || '미지정'}`}
        />
        {activityControl}
        <div className="graph-options">
          <p className="graph-lesson-origin">
            {isTree ? '트리 관계와 너비·깊이 우선 탐색' : graphLesson.title} · {graphLesson.origin}
          </p>
          <div className="sample-buttons" role="group" aria-label="그래프 예제">
            <span>예제 선택</span>
            {(isTree
              ? [
                  ['tree', '이진 트리'],
                  ['generalTree', '일반 트리'],
                ]
              : [
                  ['cycle', '사이클 그래프'],
                  ['disconnected', '단절 그래프'],
                  ['directed', '방향 그래프'],
                ]
            ).map(([key, title]) => (
              <button
                key={key}
                onClick={() => changeGraph(graphSamples[key as keyof typeof graphSamples])}
              >
                {title}
              </button>
            ))}
          </div>
          <div className="search-options">
            <label>
              탐색 방법
              <select
                value={algorithm}
                onChange={(e) => {
                  invalidate();
                  setAlgorithm(e.target.value as SearchAlgorithm);
                }}
              >
                <option value="bfs">BFS · 너비 우선</option>
                <option value="dfs">DFS · 깊이 우선 (재귀)</option>
              </select>
            </label>
            {isTree && (
              <label>
                트리 루트
                <select
                  value={root}
                  onChange={(e) => {
                    invalidate();
                    setRoot(e.target.value);
                  }}
                >
                  {graph.vertices.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              시작 정점
              <select
                value={start}
                onChange={(e) => {
                  invalidate();
                  setStart(e.target.value);
                }}
              >
                {graph.vertices.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              목표 정점
              <select
                value={target}
                onChange={(e) => {
                  invalidate();
                  setTarget(e.target.value);
                }}
              >
                <option value="">미지정</option>
                {graph.vertices.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              이웃 방문 순서
              <select
                value={String(reverse)}
                onChange={(e) => {
                  invalidate();
                  setReverse(e.target.value === 'true');
                }}
              >
                <option value="false">정점 순서대로</option>
                <option value="true">정점 역순으로</option>
              </select>
            </label>
            <button className="primary-button" disabled={rawPending} onClick={apply}>
              탐색 준비
            </button>
          </div>
          <p className="panel-footnote">
            방문할 이웃의 우선순위:{' '}
            {(reverse ? [...graph.vertices].reverse() : graph.vertices).join(' → ')} · 시작점에서
            닿는 영역만 탐색 · 모든 간선 비용 1 · 입력과 기록은 브라우저 내부에서만 처리
          </p>
        </div>
        <GraphEditor
          graph={graph}
          isTree={isTree}
          root={isTree ? root : undefined}
          onChange={changeGraph}
          onDraft={(pending) => {
            invalidate();
            setRawPending(pending);
          }}
        />
        {error && (
          <p role="alert" className="input-error">
            {error}
          </p>
        )}
        {rawPending && (
          <p className="input-notice">
            문자 입력을 편집 중입니다. 표현 적용 또는 문자 입력 취소 후 탐색을 준비해 주세요.
          </p>
        )}
        <details className="learning-prompt">
          <summary>예상해 보기</summary>
          <p>{graphLesson.predict}</p>
        </details>
        <ObservationPanels
          view={view}
          summary={
            <RunSummary
              step={step}
              playing={playing}
              message={
                !run
                  ? '입력이 바뀌어 이전 기록을 지웠습니다. 탐색 준비를 눌러 시작하세요.'
                  : undefined
              }
            />
          }
          actions={
            comparison && (
              <>
                <span>같은 그래프 · 관찰 위치 별도 유지</span>
                {(['bfs', 'dfs'] as const).map((key) => (
                  <button key={key} aria-pressed={algorithm === key} onClick={() => inspect(key)}>
                    {key.toUpperCase()} 과정
                  </button>
                ))}
              </>
            )
          }
        >
          <CodePanel run={run} step={step} profile="graph" />
          <GraphVisualPanel step={step} selected={selected} onSelect={setSelected} />
          <GraphStatePanel step={step} selected={selected} />
          <GraphStructuresPanel step={step} />
          <HistoryPanel run={run} step={step} onSeek={(n) => player.seek(n)} />
          <AnalysisPanel run={run} step={step} profile="graph" />
        </ObservationPanels>
        <div className="comparison-actions">
          <button disabled={!run} onClick={compare}>
            BFS·DFS 결과 비교
          </button>
          {comparison && <button onClick={() => setComparison(null)}>비교 닫기</button>}
        </div>
        {comparison && (
          <Comparison
            runs={comparison}
            algorithm={algorithm}
            index={index}
            positions={positions.current}
            onInspect={inspect}
          />
        )}
        <LessonGuide lesson={graphLesson} />
        <footer className="page-footer">
          <span>
            InfoScope <small>· 정보과학 통합 시각화</small>
          </span>
          <span>예상 → 관찰 → 설명 → 재적용</span>
        </footer>
      </main>
      <PlaybackControls
        player={player}
        step={step}
        playing={playing}
        index={index}
        count={run?.steps.length ?? 0}
        delay={delay}
      />
    </>
  );
}
