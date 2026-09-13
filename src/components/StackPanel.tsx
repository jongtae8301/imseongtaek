import type { Snapshot } from '../engine/types';
import { Panel } from './Panel';
import { formatValue } from './format';

export function StackPanel({ step }: { step: Snapshot | null }) {
  const frames = step?.frames ?? [];
  const calls = step?.structures.find((structure) => structure.kind === 'call-tree')?.nodes ?? [];
  return (
    <Panel
      id="structures"
      number="04"
      title="자료구조"
      icon="stack"
      stepIndex={step?.index ?? null}
      meta="콜 스택 · LIFO"
    >
      <div className="stack-caption">
        <span>나중에 호출한 함수가 먼저 복귀합니다.</span>
        <strong>{frames.length}개 프레임</strong>
      </div>
      <div className="stack-scroll" tabIndex={0} aria-label="콜 스택, 위쪽이 Top">
        {frames.length ? (
          <ol className="stack-list">
            {[...frames].reverse().map((frame, i) => (
              <li key={frame.id} className={frame.id === step?.activeFrameId ? 'active-frame' : ''}>
                <span className="stack-position">{i === 0 ? 'Top →' : '대기'}</span>
                <div>
                  <strong>
                    <code>
                      {calls.find((call) => call.id === frame.id)?.label ?? frame.functionName}
                    </code>
                  </strong>
                  <small>호출 당시 인수</small>
                  <p className="stack-parameters">
                    현재 매개 변수:{' '}
                    {Object.entries(frame.parameters)
                      .map(([name, value]) => `${name}=${formatValue(value)}`)
                      .join(', ') || '없음'}
                  </p>
                  <small>
                    {frame.id} · 복귀 위치 {frame.returnTo.line}번 줄
                  </small>
                </div>
                <span className="stack-state">{i === 0 ? '현재 호출' : '반환 대기'}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty-stack">
            <span>[ ]</span>
            <p>빈 콜 스택</p>
            <small>
              {step?.status === 'completed'
                ? '모든 함수가 복귀했습니다.'
                : '호출 시 프레임이 추가됩니다.'}
            </small>
          </div>
        )}
      </div>
      <p className="panel-footnote">
        Top은 현재 실행할 함수입니다. 복귀 사건에서는 반환한 프레임이 이미 제거된 상태입니다.
      </p>
    </Panel>
  );
}
