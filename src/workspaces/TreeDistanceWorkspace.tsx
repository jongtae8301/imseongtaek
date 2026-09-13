import { useState, type ReactNode } from 'react';
import {
  buildTreeDistanceRun,
  treeDistanceLesson,
  type DistanceMethod,
} from '../examples/tree-distance';
import { createGraph, graphSamples, type Graph } from '../structures/graph';
import { usePlayer } from '../player/use-player';
import { CodePanel } from '../components/CodePanel';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { GraphEditor } from '../components/GraphEditor';
import { GraphVisualPanel, GraphStructuresPanel } from '../components/GraphPanels';
import { TreeDistancePanel } from '../components/TreeDistancePanel';
import { LessonGuide } from '../components/LessonGuide';
import { RunSummary } from '../components/RunSummary';
import { PlaybackControls } from '../components/PlaybackControls';
import {
  ObservationControls,
  ObservationPanels,
  useObservationView,
} from '../components/ObservationPanels';

const initialRun = buildTreeDistanceRun({
  graph: graphSamples.textbookTree,
  root: 'A',
  from: 'D',
  to: 'E',
  method: 'depth',
});

export function TreeDistanceWorkspace({ activityControl }: { activityControl: ReactNode }) {
  const view = useObservationView();
  const [graph, setGraph] = useState<Graph>(graphSamples.textbookTree);
  const [root, setRoot] = useState('A');
  const [from, setFrom] = useState('D');
  const [to, setTo] = useState('E');
  const [method, setMethod] = useState<DistanceMethod>('depth');
  const [maxSteps, setMaxSteps] = useState(100);
  const [selected, setSelected] = useState('D');
  const [rawPending, setRawPending] = useState(false);
  const [error, setError] = useState('');
  const { player, run, step, index, playing, delay } = usePlayer(initialRun);
  function invalidate() {
    player.load(null);
    setError('');
  }
  function changeGraph(next: Graph) {
    invalidate();
    setGraph(createGraph(next.vertices, next.edges, next.directed));
    setRawPending(false);
    if (!next.vertices.includes(root)) setRoot(next.vertices[0]!);
    if (!next.vertices.includes(from)) setFrom(next.vertices[0]!);
    if (!next.vertices.includes(to)) setTo(next.vertices[0]!);
    if (!next.vertices.includes(selected)) setSelected(next.vertices[0]!);
  }
  function apply() {
    try {
      player.load(buildTreeDistanceRun({ graph, root, from, to, method, maxSteps }));
      setError('');
    } catch (err) {
      player.load(null);
      setError((err as Error).message);
    }
  }
  return (
    <>
      <main id="workspace" className={view.focused ? 'is-focused' : ''}>
        <ObservationControls
          view={view}
          title={`트리 거리 · ${from}–${to} · ${method === 'depth' ? '깊이 비교' : '배열 인덱스'}`}
        />
        {activityControl}
        <div className="graph-options">
          <p className="graph-lesson-origin">{treeDistanceLesson.origin}</p>
          <div className="sample-buttons" role="group" aria-label="거리 트리 예제">
            <span>예제 선택</span>
            <button
              onClick={() => {
                changeGraph(graphSamples.textbookTree);
                setRoot('A');
                setFrom('D');
                setTo('E');
                setSelected('D');
              }}
            >
              교과서 계통도
            </button>
            <button
              onClick={() => {
                changeGraph(graphSamples.generalTree);
                setRoot('A');
                setFrom('B');
                setTo('E');
                setSelected('B');
              }}
            >
              일반 트리
            </button>
          </div>
          <div className="search-options">
            <label>
              거리 계산 방법
              <select
                value={method}
                onChange={(e) => {
                  invalidate();
                  setMethod(e.target.value as DistanceMethod);
                }}
              >
                <option value="depth">깊이 비교 · 일반 트리</option>
                <option value="array">배열 인덱스 · 이진 트리</option>
              </select>
            </label>
            {[
              { title: '트리 루트', current: root, change: setRoot },
              { title: '첫 노드', current: from, change: setFrom },
              { title: '둘째 노드', current: to, change: setTo },
            ].map(({ title, current, change }) => (
              <label key={title}>
                {title}
                <select
                  value={current}
                  onChange={(e) => {
                    invalidate();
                    change(e.target.value);
                  }}
                >
                  {graph.vertices.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            ))}
            <label>
              실행 한도
              <select
                value={maxSteps}
                onChange={(e) => {
                  invalidate();
                  setMaxSteps(Number(e.target.value));
                }}
              >
                <option value={100}>100단계 · 기본</option>
                <option value={10}>10단계 · 중단 관찰</option>
              </select>
            </label>
            <button className="primary-button" disabled={rawPending} onClick={apply}>
              거리 계산 준비
            </button>
          </div>
          <p className="panel-footnote">
            정점 1–8개 · 루트 깊이 0 · 거리 = 두 노드 사이 간선 수 · 같은 노드도 선택 가능 · 입력과
            기록은 브라우저 내부에서만 처리
          </p>
          <p className="panel-footnote">
            {method === 'depth'
              ? '더 깊은 쪽을 올리고, 깊이가 같으면 a부터 올립니다. 두 노드가 같아질 때 멈춥니다.'
              : '큰 배열 인덱스 쪽을 올립니다. 부모 인덱스는 ⌊i/2⌋이며 두 노드가 같아질 때 멈춥니다. 이진 트리만 지원합니다.'}
          </p>
        </div>
        <GraphEditor
          graph={graph}
          isTree
          root={root}
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
            문자 입력을 편집 중입니다. 표현 적용 또는 문자 입력 취소 후 거리 계산을 준비해 주세요.
          </p>
        )}
        <details className="learning-prompt">
          <summary>예상해 보기</summary>
          <p>
            {from === to
              ? '같은 노드를 두 번 선택했습니다. 이동 횟수와 공통 조상은 무엇일까요?'
              : `${from}와 ${to}는 어디에서 만날까요? 깊이가 같다는 이유만으로 멈춰도 될까요?`}
          </p>
        </details>
        <ObservationPanels
          view={view}
          summary={
            <RunSummary
              step={step}
              playing={playing}
              message={
                !run
                  ? '입력이 바뀌어 이전 기록을 지웠습니다. 거리 계산 준비를 눌러 시작하세요.'
                  : undefined
              }
            />
          }
        >
          <CodePanel run={run} step={step} profile="tree-distance" />
          <GraphVisualPanel step={step} selected={selected} onSelect={setSelected} />
          <TreeDistancePanel step={step} selected={selected} />
          <GraphStructuresPanel step={step} />
          <HistoryPanel run={run} step={step} onSeek={(n) => player.seek(n)} />
          <AnalysisPanel run={run} step={step} profile="tree-distance" />
        </ObservationPanels>
        <LessonGuide lesson={treeDistanceLesson} />
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
