import { useEffect } from 'react';
import type { Player } from './controller';

export function usePlaybackKeys(player: Player) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.repeat ||
        target.closest(
          'input, select, textarea, button, summary, [contenteditable="true"], [data-scroll-region]',
        )
      )
        return;
      if (event.code === 'ArrowRight') {
        event.preventDefault();
        player.next();
      }
      if (event.code === 'ArrowLeft') {
        event.preventDefault();
        player.previous();
      }
      if (event.code === 'Space') {
        event.preventDefault();
        if (player.getSnapshot().playing) player.pause();
        else player.play();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [player]);
}
