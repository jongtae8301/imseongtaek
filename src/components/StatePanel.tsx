import type { DeepReadonly, RuntimeValue, Snapshot } from '../engine/types';
import { formatValue } from './format';
import { Panel } from './Panel';

export function Values({
  label,
  items,
  prefix,
  step,
}: {
  label: string;
  items: DeepReadonly<Record<string, RuntimeValue>>;
  prefix: string;
  step: Snapshot;
}) {
  return (
    <div className="variable-group">
      <h3>{label}</h3>
      <dl>
        {Object.entries(items).map(([name, item]) => {
          const changed = step.changes.some((change) => change.path === `${prefix}.${name}`);
          return (
            <div
              key={name}
              data-variable={`${prefix}.${name}`}
              className={changed ? 'changed-variable' : ''}
            >
              <dt>
                <code>{name}</code>
                {changed && <small>변경</small>}
              </dt>
              <dd className={item.kind === 'unset' ? 'unset-value' : ''}>{formatValue(item)}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}
export function StatePanel({ step }: { step: Snapshot | null }) {
  const frame = step?.frames.find((item) => item.id === step.activeFrameId);
  return (
    <Panel
      id="state"
      number="03"
      title="현재 상태"
      icon="state"
      stepIndex={step?.index ?? null}
      meta={frame?.id ?? '전역 실행'}
    >
      {step ? (
        <div className="state-content">
          <Values label="전역 변수" items={step.globals} prefix="globals" step={step} />
          {frame ? (
            <div className="frame-variables">
              <Values
                label={`매개 변수 · ${frame.id}`}
                items={frame.parameters}
                prefix={`frames.${frame.id}.parameters`}
                step={step}
              />
              <Values
                label="지역 변수"
                items={frame.locals}
                prefix={`frames.${frame.id}.locals`}
                step={step}
              />
            </div>
          ) : (
            <p className="empty-small">현재 활성 함수 프레임이 없습니다.</p>
          )}
          <div className={`return-notice ${step.returnInfo ? 'has-return' : ''}`}>
            <span>이번 사건의 반환값</span>
            <strong>{step.returnInfo ? formatValue(step.returnValue) : '반환 사건 아님'}</strong>
            {step.returnInfo && (
              <small>
                {step.returnInfo.frameId} → {step.returnInfo.targetFrameId ?? '전역'} ·{' '}
                {step.returnInfo.target.line}번 줄
              </small>
            )}
          </div>
        </div>
      ) : (
        <p className="empty-small">입력을 적용하면 상태가 표시됩니다.</p>
      )}
    </Panel>
  );
}
