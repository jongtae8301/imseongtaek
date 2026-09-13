import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { mazeLesson } from '../examples/maze-search';
import { editMaze, mazeSamples, type Maze, type MazeTool } from '../structures/maze';
import { createPlayer } from '../player/controller';
import type { MazeComparison } from '../player/maze-comparison';
import { MazeBoard } from '../components/MazeBoard';

const initialMaze = mazeSamples.studio!.maze;
type Intent = 'ready' | 'play' | 'next' | 'result';

export function MazeWorkspace({ activityControl }: { activityControl: ReactNode }) {
  const [maze, setMaze] = useState<Maze>(initialMaze);
  const [sample, setSample] = useState('studio');
  const mazeRef = useRef(maze);
  const history = useRef<{ past: Maze[]; future: Maze[] }>({ past: [], future: [] });
  const gesture = useRef<{ before: Maze; saved: boolean } | null>(null);
  const [interactionKey, setInteractionKey] = useState(0);
  const [reverse, setReverse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('미로를 고치거나 두 탐색을 시작해 보세요.');
  const [error, setError] = useState('');
  const worker = useRef<Worker | null>(null);
  const [player] = useState(() => createPlayer<MazeComparison>());
  const { run, index, playing, delay } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const frame = run?.steps[index];
  const atEnd = !!run && index === run.steps.length - 1;

  function invalidate() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    player.load(null);
    setError('');
  }
  function prepare(intent: Intent = 'ready') {
    invalidate();
    setBusy(true);
    setNotice('두 탐색을 준비하고 있습니다.');
    try {
      const job = new Worker(new URL('../examples/maze.worker.ts', import.meta.url), {
        type: 'module',
      });
      worker.current = job;
      const fail = (message: string) => {
        if (worker.current !== job) return;
        job.terminate();
        worker.current = null;
        setBusy(false);
        setError(message);
        setNotice('다시 탐색을 시작해 주세요.');
      };
      job.onmessage = (event: MessageEvent<{ comparison?: MazeComparison; error?: string }>) => {
        if (worker.current !== job) return;
        if (!event.data.comparison) {
          fail(event.data.error ?? '탐색을 준비하지 못했습니다.');
          return;
        }
        try {
          const comparison = event.data.comparison;
          job.terminate();
          worker.current = null;
          setBusy(false);
          player.load(comparison);
          setNotice('미로를 고치거나 두 탐색을 시작해 보세요.');
          if (intent === 'result') player.seek(comparison.steps.length - 1);
          else if (intent === 'next') player.next();
          else if (intent === 'play') player.play();
        } catch {
          fail('탐색 기록을 읽지 못했습니다. 다시 시도해 주세요.');
        }
      };
      job.onerror = () => fail('탐색을 준비하지 못했습니다. 다시 시도해 주세요.');
      job.postMessage({ maze, reverse, maxSteps: 2000 });
    } catch {
      worker.current?.terminate();
      worker.current = null;
      setBusy(false);
      setError('탐색을 준비하지 못했습니다. 다시 시도해 주세요.');
      setNotice('다시 탐색을 시작해 주세요.');
    }
  }
  useEffect(() => {
    prepare();
    return () => {
      worker.current?.terminate();
      worker.current = null;
      player.dispose();
    };
  }, [player]);

  function act(intent: 'play' | 'next' | 'result') {
    if (!run) {
      prepare(intent);
      return;
    }
    if (intent === 'result') player.seek(run.steps.length - 1);
    else if (intent === 'next') player.next();
    else {
      if (atEnd) player.reset();
      player.play();
    }
  }
  function remember(before: Maze) {
    history.current.past = [...history.current.past.slice(-49), before];
    history.current.future = [];
  }
  function setInput(next: Maze, message: string) {
    invalidate();
    mazeRef.current = next;
    setMaze(next);
    setSample('custom');
    setNotice(message);
  }
  function undo(redo = false) {
    const from = redo ? history.current.future : history.current.past;
    const next = from.pop();
    if (!next) return;
    (redo ? history.current.past : history.current.future).push(mazeRef.current);
    gesture.current = null;
    setInteractionKey((key) => key + 1);
    setInput(next, redo ? '편집을 다시 적용했습니다.' : '마지막 편집을 되돌렸습니다.');
  }
  function replaceMaze(next: Maze, message: string) {
    remember(mazeRef.current);
    gesture.current = null;
    setInteractionKey((key) => key + 1);
    setInput(next, message);
  }
  function changeCells(vertices: string[], tool: MazeTool) {
    try {
      const before = mazeRef.current;
      const next = vertices.reduce((current, vertex) => editMaze(current, vertex, tool), before);
      if (JSON.stringify(next) === JSON.stringify(before)) return;
      if (!gesture.current) remember(before);
      else if (!gesture.current.saved) {
        remember(gesture.current.before);
        gesture.current.saved = true;
      }
      setInput(next, '미로를 바꿨습니다. 같은 미로로 다시 비교해 보세요.');
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main
      id="workspace"
      className="maze-lab"
      onKeyDown={(event) => {
        if (
          !(event.ctrlKey || event.metaKey) ||
          event.altKey ||
          (event.target as HTMLElement).closest('input, textarea, select')
        )
          return;
        if (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y') {
          event.preventDefault();
          undo(event.shiftKey || event.key.toLowerCase() === 'y');
        }
      }}
    >
      <div className="maze-topline">
        <div className="maze-heading">
          <h1>같은 미로, 다른 탐색</h1>
          <p>직접 길을 만들고, 두 탐색이 찾는 경로를 비교해 보세요.</p>
        </div>
        {activityControl}
      </div>
      <section className="maze-edit-bar" aria-label="미로 편집 도구">
        <label className="maze-sample">
          미로 예제
          <select
            value={sample}
            onChange={(event) => {
              const key = event.target.value,
                next = mazeSamples[key]!.maze;
              replaceMaze(next, '새 미로입니다. 경로를 예상한 뒤 비교해 보세요.');
              setSample(key);
            }}
          >
            {Object.entries(mazeSamples).map(([key, item]) => (
              <option key={key} value={key}>
                {item.title}
              </option>
            ))}
            <option value="custom" disabled>
              직접 수정한 미로
            </option>
          </select>
        </label>
        <div className="maze-edit-actions">
          <button disabled={!history.current.past.length} onClick={() => undo()} title="Ctrl+Z">
            편집 되돌리기
          </button>
          <button
            disabled={!history.current.future.length}
            onClick={() => undo(true)}
            title="Ctrl+Shift+Z"
          >
            편집 다시하기
          </button>
          <button
            disabled={!maze.rows.some((row) => row.includes('#'))}
            onClick={() =>
              replaceMaze(
                { ...maze, rows: maze.rows.map((row) => '.'.repeat(row.length)) },
                '벽을 모두 지웠습니다. 직접 길을 만들어 보세요.',
              )
            }
          >
            벽 모두 지우기
          </button>
        </div>
        <span className="maze-size">
          {maze.rows.length} × {maze.rows[0]!.length}
        </span>
      </section>
      <div className="maze-edit-hints" id="maze-edit-help">
        <span>
          <strong>클릭</strong> 벽 켜기·끄기
        </span>
        <span>
          <strong>드래그</strong> 첫 칸이 길이면 생성, 벽이면 삭제
        </span>
        <span>
          <strong className="maze-key">S</strong> 출발 · <strong className="maze-key">G</strong>{' '}
          도착은 끌어서 이동
        </span>
        <span>양쪽 미로가 함께 바뀝니다.</span>
      </div>
      <div className="maze-compare-controls" role="group" aria-label="미로 비교 재생">
        <div className="maze-transport">
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => (playing ? player.pause() : act('play'))}
          >
            {playing ? '일시 정지' : atEnd ? '다시 비교' : '같이 탐색'}
          </button>
          <button disabled={busy || index === 0} onClick={() => player.previous()}>
            이전
          </button>
          <button disabled={busy || atEnd} onClick={() => act('next')}>
            한 칸씩
          </button>
          <button disabled={busy} onClick={() => act('result')}>
            결과 비교
          </button>
          <button disabled={busy || (index === 0 && !playing)} onClick={() => player.reset()}>
            처음으로
          </button>
          {busy && (
            <button
              onClick={() => {
                invalidate();
                setNotice('준비를 중단했습니다. 같이 탐색으로 다시 시작하세요.');
              }}
            >
              준비 중단
            </button>
          )}
        </div>
        <label>
          재생 속도
          <select value={delay} onChange={(event) => player.setDelay(Number(event.target.value))}>
            <option value={2000}>천천히</option>
            <option value={1000}>보통</option>
            <option value={500}>빠르게</option>
          </select>
        </label>
      </div>
      <p className="maze-lab-status" role="status">
        {busy
          ? '두 탐색을 준비하고 있습니다.'
          : atEnd
            ? '비교를 마쳤습니다. 벽을 바꾸면 어떤 차이가 생길까요?'
            : index > 0
              ? playing
                ? '새 칸을 하나씩 발견하며 함께 탐색합니다.'
                : '일시 정지 · 한 칸씩 보거나 탐색을 계속할 수 있습니다.'
              : notice}
      </p>
      {error && (
        <p role="alert" className="input-error">
          {error}
        </p>
      )}
      <section className="maze-duet" aria-label="미로 BFS·DFS 비교">
        {(['bfs', 'dfs'] as const).map((key) => {
          const step = frame?.[key];
          const done = frame?.[key === 'bfs' ? 'bfsDone' : 'dfsDone'] ?? false;
          const search = step?.search;
          const found = !!(search?.discovered.includes(maze.target) && search.targetPath.length);
          const status = found
            ? '출구 발견'
            : done
              ? step?.status === 'completed'
                ? '도달 불가'
                : '한도 도달 · 미확정'
              : !search?.discovered.length
                ? '탐색 전'
                : '탐색 중';
          return (
            <article
              className="maze-algorithm"
              key={key}
              data-maze-comparison={key}
              data-step={step?.index ?? 'empty'}
              data-done={done}
            >
              <header>
                <div>
                  <h2>{key.toUpperCase()}</h2>
                  <p>{key === 'bfs' ? '가까운 칸부터 넓게' : '한 갈래를 끝까지 깊게'}</p>
                </div>
                <span className="maze-outcome" data-found={found}>
                  {status}
                </span>
              </header>
              <MazeBoard
                maze={maze}
                step={step}
                label={key.toUpperCase() + ' 비교 미로'}
                onEdit={changeCells}
                onEditStart={() => {
                  gesture.current = { before: mazeRef.current, saved: false };
                  player.pause();
                }}
                onEditEnd={() => {
                  gesture.current = null;
                }}
                interactionKey={interactionKey}
              />
              <dl className="maze-score">
                <div>
                  <dt>발견한 칸</dt>
                  <dd data-maze-discoveries>
                    {search?.discovered.length ?? 0}
                    <small>칸</small>
                  </dd>
                </div>
                <div>
                  <dt>출구까지 경로</dt>
                  <dd data-maze-route>
                    {found ? (
                      <>
                        {search!.targetPath.length - 1}
                        <small>회 이동</small>
                      </>
                    ) : done ? (
                      status
                    ) : (
                      '아직 없음'
                    )}
                  </dd>
                </div>
              </dl>
              <p className="maze-algorithm-note">
                {key === 'bfs'
                  ? '한 칸씩 같은 비용으로 움직일 때 최단 경로를 찾아요.'
                  : '발견한 경로가 가장 짧은 길은 아닐 수 있어요.'}
              </p>
            </article>
          );
        })}
      </section>
      <div className="maze-lab-foot">
        <p className="maze-legend">
          S 출발 · G 도착 · 진한 칸: 벽 · + 발견한 칸 · ● 새로 발견 · 녹색 숫자: 경로의 이동 순서
        </p>
        <p>
          새 칸을 하나씩 발견하는 장면을 나란히 보여 줍니다. 출구를 찾은 쪽은 멈추며, 재생 속도는
          실제 계산 속도를 뜻하지 않습니다.
        </p>
      </div>
      <details className="maze-extra">
        <summary>이웃 순서·활동 안내</summary>
        <label>
          이웃 방문 순서
          <select
            value={String(reverse)}
            onChange={(event) => {
              invalidate();
              setReverse(event.target.value === 'true');
              setNotice('이웃 순서를 바꿨습니다. 경로를 다시 비교해 보세요.');
            }}
          >
            <option value="false">위 → 오른쪽 → 아래 → 왼쪽</option>
            <option value="true">왼쪽 → 아래 → 오른쪽 → 위</option>
          </select>
        </label>
        <p>
          방향키로 칸을 선택하고 Enter·Space로 벽을 켜고 끕니다. Delete는 지우기, S는 출발, G는 도착
          옮기기입니다. 끝점 드래그는 놓을 때 적용되며 Esc 또는 미로 밖에 놓으면 취소됩니다. 끝점이
          겹쳤을 때 Shift를 누르고 끌면 도착점을 옮깁니다.
        </p>
        <p>
          가로 최대 21칸·세로 최대 15칸, 상하좌우 이동만 가능합니다. 두 탐색은 같은 출발·도착·이웃
          순서를 사용합니다. 작은 화면에서는 작은 미로 예제로 더 큰 칸을 사용할 수 있습니다.
        </p>
        <p>
          편집은 최근 50개 작업까지 되돌립니다. 드래그 한 번은 한 작업입니다. Ctrl+Z로 되돌리고
          Ctrl+Shift+Z로 다시 적용합니다. 편집·되돌리기는 탐색 기록을 초기화합니다.
        </p>
        <p>
          벽 하나를 열거나 출구를 옮긴 뒤, 발견한 칸 수와 경로 길이가 어떻게 달라질지 예상하고
          비교해 보세요.
        </p>
        <small>{mazeLesson.origin}</small>
      </details>
    </main>
  );
}
