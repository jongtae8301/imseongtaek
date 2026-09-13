import { useRef, useState } from 'react';
import {
  buildFunctionComparison,
  buildFunctionRun,
  functionExamples,
  getFunctionLesson,
  parseFunctionInput,
  type FunctionComparison as Comparison,
  type FunctionMethod,
  type FunctionProblem,
} from '../examples/functions';
import { usePlayer } from '../player/use-player';
import { Icon } from '../components/icons';
import { CodePanel } from '../components/CodePanel';
import { CallTreePanel } from '../components/CallTreePanel';
import { StatePanel } from '../components/StatePanel';
import { StackPanel } from '../components/StackPanel';
import { HistoryPanel } from '../components/HistoryPanel';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { PlaybackControls } from '../components/PlaybackControls';
import { RunSummary } from '../components/RunSummary';
import { LessonGuide } from '../components/LessonGuide';
import { FunctionComparison } from '../components/FunctionComparison';
import {
  ObservationControls,
  ObservationPanels,
  useObservationView,
} from '../components/ObservationPanels';

const initialRun = buildFunctionRun('sum', 'recursive', 4);
export function RecursionWorkspace() {
  const view = useObservationView();
  const { player, run, step, index, playing, delay } = usePlayer(initialRun);
  const [problem, setProblem] = useState<FunctionProblem>('sum');
  const [method, setMethod] = useState<FunctionMethod>('recursive');
  const [input, setInput] = useState('4');
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const positions = useRef<Record<FunctionMethod, number>>({ recursive: 0, iterative: 0 });
  const example = functionExamples[problem];
  const lesson = getFunctionLesson(problem, method);
  function invalidate() {
    player.load(null);
    setComparison(null);
    setError('');
    setDirty(true);
    positions.current = { recursive: 0, iterative: 0 };
  }
  function applyInput() {
    const parsed = parseFunctionInput(problem, input);
    if (!parsed.ok) {
      setError(parsed.error);
      player.load(null);
      return;
    }
    player.load(buildFunctionRun(problem, method, parsed.n));
    setInput(String(parsed.n));
    setError('');
    setDirty(false);
    setComparison(null);
    positions.current = { recursive: 0, iterative: 0 };
  }
  function compare() {
    if (!run || problem === 'scope') return;
    const next = buildFunctionComparison(problem, run.metadata.input.n as number, {
      maxSteps: run.metadata.limits.maxSteps,
      maxDepth: run.metadata.limits.maxDepth,
    });
    positions.current = {
      recursive: method === 'recursive' ? index : 0,
      iterative: method === 'iterative' ? index : 0,
    };
    player.load(next[method]);
    player.seek(index);
    setComparison(next);
  }
  function inspect(next: FunctionMethod) {
    if (!comparison) return;
    positions.current[method] = index;
    setMethod(next);
    player.load(comparison[next]);
    player.seek(positions.current[next]);
    view.revealCode();
  }
  return (
    <>
      <main id="workspace" className={view.focused ? 'is-focused' : ''}>
        <ObservationControls
          view={view}
          title={`${example.title} · ${problem === 'scope' ? '일반 함수' : method === 'recursive' ? '재귀' : '반복'} · n=${input}`}
        />
        <form
          className="example-toolbar function-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            applyInput();
          }}
        >
          <div className="example-label">
            <span className="example-icon">
              <Icon name="code" size={22} />
            </span>
            <div>
              <label htmlFor="function-example">예제 선택</label>
              <select
                id="function-example"
                value={problem}
                onChange={(e) => {
                  const next = e.target.value as FunctionProblem;
                  invalidate();
                  setProblem(next);
                  setMethod('recursive');
                  setInput(String(functionExamples[next].defaultInput));
                }}
              >
                {Object.entries(functionExamples).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.title}
                  </option>
                ))}
              </select>
              <span>{example.lesson.origin}</span>
            </div>
          </div>
          {problem !== 'scope' && (
            <div className="function-settings">
              <label>
                실행 방식
                <select
                  value={method}
                  onChange={(e) => {
                    invalidate();
                    setMethod(e.target.value as FunctionMethod);
                  }}
                >
                  <option value="recursive">재귀</option>
                  <option value="iterative">반복</option>
                </select>
              </label>
            </div>
          )}
          <div className="input-controls">
            <label htmlFor="input-n">
              입력값 <code>n</code>
            </label>
            <input
              id="input-n"
              type="text"
              inputMode="numeric"
              value={input}
              aria-invalid={!!error}
              aria-describedby="input-help input-error function-definition"
              autoComplete="off"
              onChange={(e) => {
                setInput(e.target.value);
                invalidate();
              }}
            />
            <button type="submit">
              입력 적용
              <Icon name="next" size={15} />
            </button>
            <small id="input-help">0 ≤ n ≤ {example.maxInput} · 정수</small>
          </div>
          <p id="function-definition" className="function-definition">
            {example.definition}
            {problem === 'fibonacci'
              ? ' · 재귀는 n−2부터 호출 · 최대 67개 호출을 읽을 수 있도록 n≤8'
              : ''}
          </p>
        </form>
        <p id="input-error" className={error ? 'input-error' : 'sr-only'} role="alert">
          {error}
        </p>
        <details className="learning-prompt">
          <summary>예상해 보기</summary>
          <p>{lesson.predict}</p>
        </details>
        <ObservationPanels
          view={view}
          summary={
            <RunSummary
              step={step}
              playing={playing}
              message={
                dirty && !error
                  ? '입력이 바뀌어 이전 기록을 지웠습니다. 입력 적용을 눌러 시작하세요.'
                  : undefined
              }
            />
          }
          actions={
            comparison && (
              <>
                <span>같은 입력 · 관찰 위치 별도 유지</span>
                {(['recursive', 'iterative'] as const).map((key) => (
                  <button key={key} aria-pressed={method === key} onClick={() => inspect(key)}>
                    {key === 'recursive' ? '재귀 과정' : '반복 과정'}
                  </button>
                ))}
              </>
            )
          }
        >
          <CodePanel run={run} step={step} />
          <CallTreePanel
            key={run ? `${run.metadata.exampleId}-${run.metadata.input.n}` : 'empty'}
            step={step}
          />
          <StatePanel step={step} />
          <StackPanel step={step} />
          <HistoryPanel run={run} step={step} onSeek={(n) => player.seek(n)} />
          <AnalysisPanel run={run} step={step} />
        </ObservationPanels>
        {problem !== 'scope' && (
          <div className="comparison-actions">
            <button disabled={!run} onClick={compare}>
              같은 입력으로 재귀·반복 비교
            </button>
            {comparison && <button onClick={() => setComparison(null)}>비교 닫기</button>}
          </div>
        )}
        {comparison && (
          <FunctionComparison
            comparison={comparison}
            method={method}
            index={index}
            positions={positions.current}
            onInspect={inspect}
          />
        )}
        <LessonGuide lesson={lesson} />
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
