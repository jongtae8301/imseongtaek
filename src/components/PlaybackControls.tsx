import type { Player } from '../player/controller';
import type { Snapshot } from '../engine/types';
import { Icon } from './icons';
import { useLayoutEffect, useRef } from 'react';

export function PlaybackControls({
  player,
  step,
  playing,
  index,
  count,
  delay,
}: {
  player: Player;
  step: Snapshot | null;
  playing: boolean;
  index: number;
  count: number;
  delay: number;
}) {
  const controls = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = controls.current;
    if (!element) return;
    const root = document.documentElement;
    const update = () =>
      root.style.setProperty(
        '--playback-height',
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--playback-height');
    };
  }, []);
  const atStart = !count || index === 0;
  const atEnd = !count || index >= count - 1;
  return (
    <section className="playback" aria-label="실행 재생 제어" ref={controls}>
      <div className="playback-main">
        <div className="step-position">
          <span>현재 단계</span>
          <strong>
            {String(index).padStart(2, '0')}
            <small>/ {count ? count - 1 : 0}</small>
          </strong>
        </div>
        <div className="playback-buttons">
          <button
            className="icon-button"
            aria-label="처음으로"
            onClick={() => player.reset()}
            disabled={atStart && !playing}
          >
            <Icon name="reset" />
          </button>
          <button onClick={() => player.previous()} disabled={atStart}>
            <Icon name="previous" />
            <span>이전</span>
          </button>
          <button
            className="play-button"
            onClick={() => (playing ? player.pause() : player.play())}
            disabled={atEnd && !playing}
          >
            <Icon name={playing ? 'pause' : 'play'} />
            <span>{playing ? '일시 정지' : '자동 실행'}</span>
          </button>
          <button
            className="primary-button next-button"
            onClick={() => player.next()}
            disabled={atEnd}
          >
            <span>다음</span>
            <Icon name="next" />
          </button>
        </div>
        <label className="speed-control">
          재생 속도
          <select value={delay} onChange={(event) => player.setDelay(Number(event.target.value))}>
            <option value={2000}>0.5× · 2초</option>
            <option value={1000}>1× · 1초</option>
            <option value={500}>2× · 0.5초</option>
          </select>
        </label>
      </div>
      <div className="timeline-row">
        <input
          // max 변경 시 브라우저의 값 보정과 React의 값 추적이 어긋나지 않게 한다.
          key={count}
          type="range"
          aria-label="실행 단계 이동"
          min="0"
          max={Math.max(0, count - 1)}
          value={index}
          onChange={(event) => player.seek(Number(event.target.value))}
          disabled={!step}
        />
        <span>방향키 ← → · Space 자동 실행 / 정지</span>
      </div>
    </section>
  );
}
