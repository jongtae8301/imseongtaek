import type { ExecutionRun } from '../engine/types';

export interface PlaybackTimeline {
  readonly steps: readonly unknown[];
}
export interface PlayerState<T extends PlaybackTimeline = ExecutionRun> {
  run: T | null;
  index: number;
  playing: boolean;
  delay: number;
}
type Listener = () => void;

/** 타이머 한 개와 스냅샷 인덱스만 관리한다. 알고리즘은 실행하지 않는다. */
export function createPlayer<T extends PlaybackTimeline = ExecutionRun>(
  initialRun: T | null = null,
) {
  let state: PlayerState<T> = { run: initialRun, index: 0, playing: false, delay: 1000 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<Listener>();
  const lastIndex = () => Math.max(0, (state.run?.steps.length ?? 0) - 1);
  const notify = () => listeners.forEach((listener) => listener());
  const clear = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  const update = (patch: Partial<PlayerState<T>>) => {
    state = { ...state, ...patch };
    notify();
  };
  const schedule = () => {
    clear();
    if (!state.playing) return;
    timer = setTimeout(() => {
      const index = Math.min(state.index + 1, lastIndex());
      update({ index, playing: index < lastIndex() });
      schedule();
    }, state.delay);
  };
  const pause = () => {
    clear();
    update({ playing: false });
  };
  return {
    getSnapshot: () => state,
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load(run: T | null) {
      clear();
      update({ run, index: 0, playing: false });
    },
    play() {
      if (state.playing || !state.run?.steps.length || state.index >= lastIndex()) return;
      update({ playing: true });
      schedule();
    },
    pause,
    seek(index: number) {
      if (!Number.isFinite(index)) return;
      clear();
      update({ index: Math.max(0, Math.min(Math.trunc(index), lastIndex())), playing: false });
    },
    next() {
      this.seek(state.index + 1);
    },
    previous() {
      this.seek(state.index - 1);
    },
    reset() {
      this.seek(0);
    },
    setDelay(delay: number) {
      if (![500, 1000, 2000].includes(delay)) return;
      update({ delay });
      schedule();
    },
    dispose() {
      clear();
      state = { ...state, playing: false };
      listeners.clear();
    },
  };
}
export type Player = ReturnType<typeof createPlayer<ExecutionRun>>;
