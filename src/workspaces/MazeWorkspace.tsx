import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { mazeLesson } from '../examples/maze-search';
import { editMaze, mazeSamples, type Maze, type MazeTool } from '../structures/maze';
import { createPlayer } from '../player/controller';
import { buildMazeComparison, type MazeComparison, type MazeRuns } from '../player/maze-comparison';
import { MazeBoard } from '../components/MazeBoard';

const initialMaze = mazeSamples.detour!.maze;
type Intent = 'ready' | 'play' | 'next' | 'result';

export function MazeWorkspace({ activityControl }: { activityControl: ReactNode }) {
  const [maze, setMaze] = useState<Maze>(initialMaze);
  const [sample, setSample] = useState('detour');
  const [tool, setTool] = useState<MazeTool>('wall');
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
      job.onmessage = (event: MessageEvent<{ runs?: MazeRuns; error?: string }>) => {
        if (worker.current !== job) return;
        if (!event.data.runs) {
          fail(event.data.error ?? '탐색을 준비하지 못했습니다.');
          return;
        }
        try {
          const comparison = buildMazeComparison(event.data.runs);
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
  function changeCell(vertex: string) {
    try {
      const next = editMaze(maze, vertex, tool);
      if (JSON.stringify(next) === JSON.stringify(maze)) return;
      invalidate();
      setMaze(next);
      setSample('custom');
      setNotice('미로를 바꿨습니다. 같은 미로로 다시 비교해 보세요.');
    } catch (err) {
      setError((err as Error).message);
    }
  }
  return (
    <main id="workspace" className="maze-lab">
      <div className="maze-heading">
        <h1>같은 미로, 다른 탐색</h1>
        <p>벽을 바꿔 보세요. BFS와 DFS는 어떤 길을 찾을까요?</p>
      </div>
      {activityControl}
      <section className="maze-edit-bar" aria-label="미로 편집 도구">
        <label className="maze-sample">
          미로 예제
          <select
            value={sample}
            onChange={(event) => {
              const key = event.target.value,
                next = mazeSamples[key]!.maze;
              invalidate();
              setMaze(next);
              setSample(key);
              setNotice('새 미로입니다. 경로를 예상한 뒤 비교해 보세요.');
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
        <div className="graph-tools" role="group" aria-label="그리기 도구">
          {(
            [
              ['wall', '벽 놓기'],
              ['erase', '길 열기'],
              ['start', '출발 옮기기'],
              ['target', '출구 옮기기'],
            ] as const
          ).map(([key, title]) => (
            <button key={key} aria-pressed={tool === key} onClick={() => setTool(key)}>
              {title}
            </button>
          ))}
        </div>
        <p>어느 쪽 미로를 고쳐도 두 그림에 함께 반영됩니다.</p>
      </section>
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
                onCell={changeCell}
                comparison
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
          S 출발 · G 출구 · × 벽 · + 발견한 칸 · ● 새로 발견 · 녹색 숫자: 출구 경로의 이동 순서
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
          방향키로 칸을 이동하고 Enter·Space로 수정할 수 있습니다. 편집하면 두 탐색을 멈추고 기록을
          초기화합니다.
        </p>
        <p>
          가로·세로 최대 7칸, 상하좌우 이동만 가능합니다. 두 탐색은 같은 출발·출구·이웃 순서를
          사용합니다.
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
