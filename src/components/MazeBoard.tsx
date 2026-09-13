import { useRef } from 'react';
import type { Snapshot } from '../engine/types';
import { cellId, type Maze } from '../structures/maze';

export function MazeBoard({
  maze,
  step,
  label,
  onCell,
  selected,
  comparison = false,
}: {
  maze: Maze;
  step?: Snapshot | null;
  label: string;
  onCell?: (vertex: string) => void;
  selected?: string;
  comparison?: boolean;
}) {
  const board = useRef<HTMLDivElement>(null);
  const search = step?.search;
  const route = search?.discovered.includes(maze.target) ? search.targetPath : [];
  const columns = maze.rows[0]!.length;
  return (
    <div
      ref={board}
      className="maze-board"
      role="group"
      aria-label={label}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {maze.rows.flatMap((row, r) =>
        [...row].map((cell, c) => {
          const vertex = cellId(r, c);
          const current = (comparison ? search?.discovered.at(-1) : search?.current) === vertex;
          const discovered = search?.discovered.includes(vertex);
          const processed = !comparison && search?.processed.includes(vertex);
          const waiting = !comparison && search?.frontier.includes(vertex);
          const pathIndex = route.indexOf(vertex);
          const endpoint =
            vertex === maze.start && vertex === maze.target
              ? 'S/G'
              : vertex === maze.start
                ? 'S'
                : vertex === maze.target
                  ? 'G'
                  : '';
          const status =
            cell === '#'
              ? '벽'
              : current
                ? comparison
                  ? '새로 발견'
                  : '현재'
                : processed
                  ? '처리 완료'
                  : waiting
                    ? '대기'
                    : discovered
                      ? '발견'
                      : '미발견';
          const name = `${r + 1}행 ${c + 1}열 · ${vertex === maze.start ? '출발 · ' : ''}${vertex === maze.target ? '출구 · ' : ''}${status}${pathIndex >= 0 ? ` · 경로 ${pathIndex}` : ''}`;
          const content = (
            <>
              <span>
                {endpoint ||
                  (cell === '#'
                    ? '×'
                    : current
                      ? '●'
                      : pathIndex >= 0
                        ? pathIndex
                        : processed
                          ? '✓'
                          : waiting
                            ? '…'
                            : discovered
                              ? '+'
                              : '')}
              </span>
              {endpoint && current && <small>●</small>}
            </>
          );
          const className = `maze-cell ${cell === '#' ? 'is-wall' : ''} ${comparison && discovered ? 'is-discovered' : ''} ${current ? 'is-current' : ''} ${processed ? 'is-processed' : ''} ${waiting ? 'is-waiting' : ''} ${pathIndex >= 0 ? 'is-route' : ''}`;
          return onCell ? (
            <button
              key={vertex}
              className={className}
              aria-label={name}
              aria-pressed={selected === vertex}
              onClick={() => onCell(vertex)}
              onKeyDown={(event) => {
                const delta = {
                  ArrowUp: [-1, 0],
                  ArrowRight: [0, 1],
                  ArrowDown: [1, 0],
                  ArrowLeft: [0, -1],
                }[event.key];
                if (!delta) return;
                event.preventDefault();
                event.stopPropagation();
                const nr = r + delta[0]!,
                  nc = c + delta[1]!;
                if (nr >= 0 && nr < maze.rows.length && nc >= 0 && nc < columns)
                  board.current
                    ?.querySelectorAll<HTMLButtonElement>('button')
                    [nr * columns + nc]?.focus();
              }}
            >
              {content}
            </button>
          ) : (
            <div key={vertex} className={className} role="img" aria-label={name}>
              {content}
            </div>
          );
        }),
      )}
    </div>
  );
}
