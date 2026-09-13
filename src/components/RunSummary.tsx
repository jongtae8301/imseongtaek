import type { Snapshot } from '../engine/types';
import { eventLabels } from './format';

export function RunSummary({
  step,
  playing,
  message,
  direct = false,
}: {
  step: Snapshot | null;
  playing: boolean;
  message?: string;
  direct?: boolean;
}) {
  const status = !step
    ? '입력 대기'
    : step.status === 'completed'
      ? '정상 종료'
      : step.status === 'limit-reached'
        ? '한도 도달'
        : step.status === 'error'
          ? '실행 오류'
          : step.status === 'cancelled'
            ? '실행 중단'
            : playing
              ? '자동 실행 중'
              : direct
                ? '직접 조작'
                : step.index === 0
                  ? '실행 준비'
                  : '일시 정지';
  return (
    <div className="run-summary">
      <span className={`status-dot ${playing ? 'is-playing' : ''}`} />
      <strong>{status}</strong>
      <span className="summary-divider">|</span>
      <p role="status" aria-live="polite">
        {message ??
          (step?.event === 'initial'
            ? direct
              ? '값을 넣고 삽입·삭제하며 구조 변화를 관찰하세요.'
              : '다음을 눌러 첫 상태 변화를 관찰하세요.'
            : step?.explanation) ??
          '올바른 입력값을 적용해 주세요.'}
      </p>
      {step && <span className="summary-event">{eventLabels[step.event]}</span>}
    </div>
  );
}
