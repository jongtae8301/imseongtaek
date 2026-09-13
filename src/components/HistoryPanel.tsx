import { useId, useState } from 'react';
import type { ExecutionRun, Snapshot } from '../engine/types';
import { eventLabels } from './format';
import { Panel } from './Panel';

const RECENT_COUNT = 8;

export function HistoryPanel({
  run,
  step,
  onSeek,
}: {
  run: ExecutionRun | null;
  step: Snapshot | null;
  onSeek: (index: number) => void;
}) {
  const listId = useId();
  const [expandedRun, setExpandedRun] = useState<ExecutionRun | null>(null);
  const expanded = run !== null && expandedRun === run;
  const count = run && step ? step.index + 1 : 0;
  const hiddenCount = Math.max(0, count - RECENT_COUNT);
  const start = expanded ? 0 : hiddenCount;
  return (
    <Panel
      id="history"
      number="05"
      title="실행 기록"
      icon="history"
      stepIndex={step?.index ?? null}
      meta="기록을 눌러 이동"
    >
      {hiddenCount > 0 && (
        <div className="history-disclosure">
          <span>
            {expanded
              ? `현재 단계까지 ${count}개 기록`
              : `최근 ${RECENT_COUNT}개 · 이전 ${hiddenCount}개 접힘`}
          </span>
          <button
            aria-expanded={expanded}
            aria-controls={listId}
            onClick={() => setExpandedRun(expanded ? null : run)}
          >
            {expanded ? `최근 ${RECENT_COUNT}개만 보기` : `이전 기록 ${hiddenCount}개 펼치기`}
          </button>
        </div>
      )}
      <ol
        className="history-list"
        id={listId}
        start={start + 1}
        aria-label="현재 단계까지의 실행 기록"
      >
        {run && step ? (
          run.steps.slice(start, step.index + 1).map((item) => (
            <li key={item.index}>
              <button
                className={step.index === item.index ? 'selected' : ''}
                onClick={() => onSeek(item.index)}
                aria-current={step.index === item.index ? 'step' : undefined}
              >
                <span className="history-index">{String(item.index).padStart(2, '0')}</span>
                <span className={`event-tag event-${item.event}`}>{eventLabels[item.event]}</span>
                <span className="history-description">{item.explanation}</span>
              </button>
            </li>
          ))
        ) : (
          <li className="empty-small">실행 기록이 없습니다.</li>
        )}
      </ol>
    </Panel>
  );
}
