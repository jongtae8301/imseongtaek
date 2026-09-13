import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { Snapshot } from '../engine/types';
import { cellId, type Maze, type MazeTool } from '../structures/maze';

type Gesture = { pointer: number; tool: MazeTool; last: string; painted: Set<string> };

export function MazeBoard({
  maze,
  step,
  label,
  onEdit,
  onEditStart,
  onEditEnd,
  interactionKey,
}: {
  maze: Maze;
  step?: Snapshot | null;
  label: string;
  onEdit: (vertices: string[], tool: MazeTool) => void;
  onEditStart: () => void;
  onEditEnd: () => void;
  interactionKey: number;
}) {
  const board = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [preview, setPreview] = useState<{ vertex: string; tool: MazeTool } | null>(null);
  const [focus, setFocus] = useState(maze.start);
  const search = step?.search;
  const route = search?.discovered.includes(maze.target) ? search.targetPath : [];
  const columns = maze.rows[0]!.length;

  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    setPreview(null);
    if (active) onEditEnd();
    if (active && board.current?.hasPointerCapture(active.pointer))
      board.current.releasePointerCapture(active.pointer);
  }
  useEffect(() => {
    cancel();
    setFocus(maze.start);
  }, [interactionKey]);
  useEffect(() => {
    const stop = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('blur', cancel);
    window.addEventListener('keydown', stop);
    return () => {
      window.removeEventListener('blur', cancel);
      window.removeEventListener('keydown', stop);
    };
  }, []);

  function hit(event: PointerEvent): string | null {
    const cell = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>('[data-maze-cell]');
    return cell && board.current?.contains(cell) ? cell.dataset.mazeCell! : null;
  }
  function paint(vertex: string) {
    const active = gesture.current;
    if (!active) return;
    const [r0, c0] = active.last.split(',').map(Number) as [number, number];
    const [r1, c1] = vertex.split(',').map(Number) as [number, number];
    const distance = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0), 1);
    const cells: string[] = [];
    // 첫 칸의 도구를 유지하고, 빠른 드래그에서도 중간 칸을 빠뜨리지 않는다.
    for (let i = 0; i <= distance; i++) {
      const cell = cellId(
        Math.round(r0 + ((r1 - r0) * i) / distance) - 1,
        Math.round(c0 + ((c1 - c0) * i) / distance) - 1,
      );
      if (active.painted.has(cell) || cell === maze.start || cell === maze.target) continue;
      active.painted.add(cell);
      cells.push(cell);
    }
    active.last = vertex;
    if (cells.length) onEdit(cells, active.tool);
  }
  function begin(event: PointerEvent<HTMLButtonElement>, vertex: string, wall: boolean) {
    if (event.button !== 0 || gesture.current || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const tool: MazeTool =
      vertex === maze.target && (vertex !== maze.start || event.shiftKey)
        ? 'target'
        : vertex === maze.start
          ? 'start'
          : wall
            ? 'erase'
            : 'wall';
    gesture.current = { pointer: event.pointerId, tool, last: vertex, painted: new Set() };
    board.current!.setPointerCapture(event.pointerId);
    onEditStart();
    if (tool === 'wall' || tool === 'erase') paint(vertex);
    else setPreview({ vertex, tool });
  }
  return (
    <div
      ref={board}
      className={`maze-board ${preview ? 'is-moving-endpoint' : ''}`}
      role="group"
      aria-label={label}
      aria-describedby="maze-edit-help"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      onPointerMove={(event) => {
        const active = gesture.current;
        if (!active || active.pointer !== event.pointerId) return;
        const vertex = hit(event);
        if (active.tool === 'wall' || active.tool === 'erase') {
          if (vertex) paint(vertex);
        } else setPreview(vertex ? { vertex, tool: active.tool } : null);
      }}
      onPointerUp={(event) => {
        const active = gesture.current;
        if (!active || active.pointer !== event.pointerId) return;
        const vertex = hit(event);
        if (vertex && (active.tool === 'start' || active.tool === 'target'))
          onEdit([vertex], active.tool);
        cancel();
      }}
      onPointerCancel={cancel}
      onLostPointerCapture={cancel}
      onDragStart={(event) => event.preventDefault()}
    >
      {maze.rows.flatMap((row, r) =>
        [...row].map((cell, c) => {
          const vertex = cellId(r, c);
          const current = search?.discovered.at(-1) === vertex;
          const discovered = search?.discovered.includes(vertex);
          const pathIndex = route.indexOf(vertex);
          const start = vertex === maze.start,
            target = vertex === maze.target;
          const endpoint = start && target ? 'S/G' : start ? 'S' : target ? 'G' : '';
          const status =
            cell === '#' ? '벽' : current ? '새로 발견' : discovered ? '발견' : '미발견';
          const name = `${r + 1}행 ${c + 1}열 · ${start ? '출발 · ' : ''}${target ? '출구 · ' : ''}${status}${pathIndex >= 0 ? ` · 경로 ${pathIndex}` : ''}`;
          const drop = preview?.vertex === vertex;
          return (
            <button
              key={vertex}
              type="button"
              data-maze-cell={vertex}
              className={`maze-cell ${cell === '#' ? 'is-wall' : ''} ${discovered ? 'is-discovered' : ''} ${current ? 'is-current' : ''} ${pathIndex >= 0 ? 'is-route' : ''} ${start ? 'is-start' : ''} ${target ? 'is-target' : ''} ${drop ? 'is-drop-target' : ''}`}
              aria-label={name}
              aria-keyshortcuts="Enter Space Delete S G"
              tabIndex={focus === vertex ? 0 : -1}
              onFocus={() => setFocus(vertex)}
              onPointerDown={(event) => begin(event, vertex, cell === '#')}
              onClick={(event) => {
                // 포인터는 pointerdown에서 처리한다. 키보드/보조기술의 click만 여기서 처리한다.
                if (event.detail === 0 && !endpoint)
                  onEdit([vertex], cell === '#' ? 'erase' : 'wall');
              }}
              onKeyDown={(event) => {
                if (event.ctrlKey || event.metaKey || event.altKey) return;
                const key = event.key.toLowerCase();
                if (['s', 'g', 'delete', 'backspace'].includes(key)) {
                  event.preventDefault();
                  event.stopPropagation();
                  cancel();
                  onEdit([vertex], key === 's' ? 'start' : key === 'g' ? 'target' : 'erase');
                  return;
                }
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
              <span className={endpoint ? 'maze-marker' : undefined}>
                {drop
                  ? preview.tool === 'start'
                    ? 'S'
                    : 'G'
                  : endpoint ||
                    (cell === '#'
                      ? ''
                      : current
                        ? '●'
                        : pathIndex >= 0
                          ? pathIndex
                          : discovered
                            ? '+'
                            : '')}
              </span>
            </button>
          );
        }),
      )}
    </div>
  );
}
