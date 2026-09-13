import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ExecutionRun } from '../engine/types';
import { createPlayer } from './controller';
import { usePlaybackKeys } from './use-playback-keys';

export function usePlayer(initialRun: ExecutionRun | null) {
  const [player] = useState(() => createPlayer(initialRun));
  const state = useSyncExternalStore(player.subscribe, player.getSnapshot);
  useEffect(() => () => player.dispose(), [player]);
  usePlaybackKeys(player);
  return { player, ...state, step: state.run?.steps[state.index] ?? null };
}
