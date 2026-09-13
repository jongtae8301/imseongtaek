import { useRef, useState } from 'react';
import {
  ObservationControls,
  ObservationPanels,
  useObservationView,
} from '../components/ObservationPanels';
import { usePlayer } from '../player/use-player';
import { buildLinearRun, linearDemoCommands, linearLessons } from '../examples/linear';
import {
  LINEAR_CAPACITY,
  MAX_LINEAR_CAPACITY,
  MAX_OPERATIONS,
  parseLinearValue,
} from '../structures/linear';
import type { LinearCommand, LinearMode } from '../structures/linear';
import { AnalysisPanel } from '../components/AnalysisPanel';
import { CodePanel } from '../components/CodePanel';
import { HistoryPanel } from '../components/HistoryPanel';
import {
  LinearStatePanel,
  LinearStructurePanel,
  LinearVisualPanel,
} from '../components/LinearPanels';
import { LessonGuide } from '../components/LessonGuide';
import { PlaybackControls } from '../components/PlaybackControls';
import { RunSummary } from '../components/RunSummary';
import { Icon } from '../components/icons';

const initialRun = buildLinearRun('queue', [], { direct: true });
type Interaction = 'direct' | 'example';

export function LinearWorkspace() {
  const view = useObservationView();
  const { player, step, run, playing, index, delay } = usePlayer(initialRun);
  const [mode, setMode] = useState<LinearMode>('queue');
  const [interaction, setInteraction] = useState<Interaction>('direct');
  const [capacity, setCapacity] = useState(LINEAR_CAPACITY);
  const [commands, setCommands] = useState<readonly LinearCommand[]>([]);
  const [input, setInput] = useState('1');
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const lesson = linearLessons[mode];
  const atEnd = index === (run?.steps.length ?? 1) - 1;
  const canOperate = atEnd && !playing && commands.length < MAX_OPERATIONS;

  function load(nextMode: LinearMode, nextInteraction: Interaction, nextCapacity = capacity) {
    setMode(nextMode);
    setInteraction(nextInteraction);
    setCapacity(nextCapacity);
    setCommands([]);
    setInput('1');
    setError('');
    player.load(
      buildLinearRun(nextMode, nextInteraction === 'direct' ? [] : linearDemoCommands, {
        direct: nextInteraction === 'direct',
        capacity: nextCapacity,
      }),
    );
  }
  function operate(command: LinearCommand) {
    if (!canOperate) return false;
    const nextCommands = [...commands, command];
    const nextRun = buildLinearRun(mode, nextCommands, { direct: true, capacity });
    setCommands(nextCommands);
    setError('');
    player.load(nextRun);
    player.seek(nextRun.steps.length - 1);
    return nextRun.steps.at(-1)?.event === command.type;
  }
  function insert() {
    if (!canOperate) return;
    const parsed = parseLinearValue(input);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (operate({ type: 'insert', value: parsed.value })) {
      setInput('');
      inputRef.current?.focus({ preventScroll: true });
    }
  }
  return (
    <>
      <main id="workspace" className={view.focused ? 'is-focused' : ''}>
        <ObservationControls
          view={view}
          title={`${mode === 'queue' ? '큐 · FIFO' : '스택 · LIFO'} · ${interaction === 'direct' ? '직접 조작' : '예제 실행'}`}
        />
        <section className="linear-toolbar" aria-label="자료구조 실습 설정">
          <div className="linear-mode-row">
            <label>
              자료구조 선택
              <select
                value={mode}
                onChange={(event) => load(event.target.value as LinearMode, interaction)}
              >
                <option value="queue">큐 · Queue</option>
                <option value="stack">스택 · Stack</option>
              </select>
            </label>
            <div className="mode-buttons" role="group" aria-label="실습 방식">
              <button aria-pressed={interaction === 'direct'} onClick={() => load(mode, 'direct')}>
                직접 조작
              </button>
              <button
                aria-pressed={interaction === 'example'}
                onClick={() => load(mode, 'example')}
              >
                예제 실행
              </button>
            </div>
            <label>
              최대 용량
              <select
                value={capacity}
                aria-describedby="linear-reset-note"
                onChange={(event) => load(mode, interaction, Number(event.target.value))}
              >
                {Array.from({ length: MAX_LINEAR_CAPACITY }, (_, index) => index + 1).map(
                  (size) => (
                    <option key={size} value={size}>
                      {size}개
                    </option>
                  ),
                )}
              </select>
            </label>
            <span className="capacity-label">값 −99~99</span>
          </div>
          {interaction === 'direct' ? (
            <>
              <form
                className="direct-controls"
                onSubmit={(event) => {
                  event.preventDefault();
                  insert();
                }}
              >
                <label htmlFor="linear-value">삽입할 값</label>
                <input
                  ref={inputRef}
                  id="linear-value"
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  value={input}
                  aria-invalid={!!error}
                  aria-describedby="linear-input-error direct-help"
                  onChange={(event) => {
                    setInput(event.target.value);
                    setError('');
                    player.pause();
                  }}
                />
                <button type="submit" className="primary-button" disabled={!canOperate}>
                  {mode === 'queue' ? '삽입 · Enqueue' : '삽입 · Push'}
                </button>
                <button
                  type="button"
                  disabled={!canOperate}
                  onClick={() => operate({ type: 'remove' })}
                >
                  {mode === 'queue' ? '삭제 · Dequeue' : '삭제 · Pop'}
                </button>
                <button
                  type="button"
                  className="new-experiment"
                  onClick={() => load(mode, 'direct')}
                >
                  <Icon name="reset" size={15} />새 실습
                </button>
              </form>
              <p id="linear-input-error" className={error ? 'input-error' : 'sr-only'} role="alert">
                {error}
              </p>
              <div className="direct-help" id="direct-help">
                <p>
                  조작 결과까지 바로 이동합니다. 이전으로 돌아가 조건 검사와 변화 과정을 다시 볼 수
                  있습니다.
                </p>
                <span>
                  조작 {commands.length} / {MAX_OPERATIONS}회
                </span>
              </div>
              {(!atEnd || playing) && (
                <div className="history-lock">
                  <p>지난 기록을 보고 있습니다. 마지막 단계에서 새 연산을 추가하세요.</p>
                  <button onClick={() => player.seek((run?.steps.length ?? 1) - 1)}>
                    마지막 단계로
                  </button>
                </div>
              )}
              {commands.length >= MAX_OPERATIONS && (
                <p className="input-error" role="status">
                  40회 조작 한도에 도달했습니다. 새 실습으로 초기화하면 다시 조작할 수 있습니다.
                </p>
              )}
            </>
          ) : (
            <div className="linear-example-info">
              <div>
                <small>{lesson.origin}</small>
                <h2>{lesson.title}</h2>
              </div>
              <p>
                선택한 용량에서 1 → 2 → 3 → 4 삽입, 네 번 삭제를 시도합니다.
                <br />
                다음 또는 자동 실행으로 진행하세요.
              </p>
              <button onClick={() => load(mode, 'example')}>예제 다시 시작</button>
            </div>
          )}
          <p className="mode-reset-note" id="linear-reset-note">
            용량·자료구조·실습 방식 변경이나 새 실습은 실행과 기록을 초기화합니다. 직접 조작의 값
            입력은 다음 삽입에만 적용됩니다.
          </p>
        </section>
        <details className="learning-prompt">
          <summary>예상해 보기</summary>
          <p>{lesson.predict}</p>
        </details>
        <ObservationPanels
          view={view}
          summary={<RunSummary step={step} playing={playing} direct={interaction === 'direct'} />}
        >
          <CodePanel run={run} step={step} profile="linear" />
          <LinearVisualPanel step={step} />
          <LinearStatePanel step={step} />
          <LinearStructurePanel step={step} />
          <HistoryPanel run={run} step={step} onSeek={(value) => player.seek(value)} />
          <AnalysisPanel run={run} step={step} profile="linear" />
        </ObservationPanels>
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
