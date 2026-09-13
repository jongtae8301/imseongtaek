import type { DeepReadonly, JsonValue, SequenceStructure, Snapshot } from '../engine/types';
import { Panel } from './Panel';
import { Values } from './StatePanel';
import { formatValue } from './format';

export function sequenceFrom(step: Snapshot | null) {
  return (
    step?.structures.find(
      (structure): structure is DeepReadonly<SequenceStructure> => structure.kind === 'sequence',
    ) ?? null
  );
}

function Items({
  items,
  mode,
  mark,
  label,
}: {
  items: readonly JsonValue[];
  mode: string;
  mark?: number | null;
  label: string;
}) {
  return (
    <ol className={`linear-items ${mode}`} aria-label={label}>
      {items.length ? (
        items.map((item, index) => (
          <li key={index} className={mark === index ? 'marked-item' : ''}>
            <small>위치 {index}</small>
            <strong>{JSON.stringify(item)}</strong>
            <span>
              {mode === 'queue'
                ? [index === 0 ? 'Front' : '', index === items.length - 1 ? 'Rear' : '']
                    .filter(Boolean)
                    .join(' / ')
                : index === items.length - 1
                  ? 'Top'
                  : index === 0
                    ? 'Bottom'
                    : '저장'}
            </span>
            {mark === index && <em>변경 대상</em>}
          </li>
        ))
      ) : (
        <li className="linear-empty">
          [ ] <span>빈 구조</span>
        </li>
      )}
    </ol>
  );
}

export function LinearVisualPanel({ step }: { step: Snapshot | null }) {
  const sequence = sequenceFrom(step);
  const transition = sequence?.transition;
  return (
    <Panel
      id="visualization"
      number="02"
      title="시각화"
      icon="stack"
      meta={sequence?.mode === 'queue' ? '큐 · FIFO' : '스택 · LIFO'}
      stepIndex={step?.index ?? null}
    >
      {sequence && (
        <>
          <div className="pointer-strip">
            {Object.entries(sequence.pointers).map(([name, index]) => (
              <span key={name} data-pointer={name}>
                <strong>{name}</strong>{' '}
                {index === null
                  ? '없음'
                  : `위치 ${index} · 값 ${JSON.stringify(sequence.items[index])}`}
              </span>
            ))}
          </div>
          <div
            className="linear-canvas"
            tabIndex={0}
            data-scroll-region
            aria-label="자료구조 변화, 가로로 스크롤하여 확인"
          >
            {transition && (
              <div className="operation-before">
                <h3>연산 전</h3>
                <Items
                  items={transition.before}
                  mode={sequence.mode}
                  mark={transition.fromIndex}
                  label="연산 전 원소"
                />
                <p className={`operation-arrow ${transition.action}`}>
                  {transition.action === 'insert'
                    ? `↓ ${transition.value} 삽입`
                    : transition.action === 'remove'
                      ? `↓ ${transition.value} 삭제 · 반환`
                      : '↓ 요청 거절 · 변화 없음'}
                </p>
              </div>
            )}
            <div>
              <h3>{transition ? '연산 후 · 현재 상태' : '현재 상태'}</h3>
              <Items
                items={sequence.items}
                mode={sequence.mode}
                mark={transition?.toIndex}
                label="현재 원소"
              />
            </div>
            {transition?.reason && <p className="rejection-note">{transition.reason}</p>}
          </div>
          <p className="panel-footnote">
            {sequence.mode === 'queue'
              ? '왼쪽이 Front, 오른쪽이 Rear입니다. 위치는 0부터 센 논리적 순서이며 실제 메모리 주소나 복사 횟수가 아닙니다.'
              : '위쪽이 Top입니다. Python 리스트의 마지막 원소를 위에 표시하며 위치 번호는 Bottom의 0부터 시작합니다.'}
          </p>
        </>
      )}
    </Panel>
  );
}

export function LinearStatePanel({ step }: { step: Snapshot | null }) {
  const sequence = sequenceFrom(step);
  return (
    <Panel
      id="state"
      number="03"
      title="현재 상태"
      icon="state"
      meta="값과 반환 순서"
      stepIndex={step?.index ?? null}
    >
      {step && sequence && (
        <div className="state-content">
          <div className="sequence-facts">
            <span>
              저장된 원소 <strong>{sequence.items.length}개</strong>
            </span>
            <span>
              남은 용량 <strong>{sequence.capacity - sequence.items.length}개</strong>
            </span>
          </div>
          <Values
            label="마지막 삭제 결과를 저장한 전역 변수"
            items={step.globals}
            prefix="globals"
            step={step}
          />
          <div className={`return-notice ${step.event === 'remove' ? 'has-return' : ''}`}>
            <span>이번 사건의 반환값</span>
            <strong>
              {step.event === 'remove' ? formatValue(step.returnValue) : '반환 사건 아님'}
            </strong>
          </div>
          <div className="removal-history">
            <h3>현재 단계까지 삭제 반환 순서</h3>
            <p data-removal-order>
              {sequence.removedValues.length
                ? sequence.removedValues.join(' → ')
                : '아직 삭제된 값 없음'}
            </p>
          </div>
          <p className="panel-footnote">
            삭제에 성공하면 removed가 바뀝니다. 삽입하거나 요청이 거절되면 이전 removed 값이
            유지됩니다.
          </p>
        </div>
      )}
    </Panel>
  );
}

export function LinearStructurePanel({ step }: { step: Snapshot | null }) {
  const sequence = sequenceFrom(step);
  return (
    <Panel
      id="structures"
      number="04"
      title="자료구조"
      icon="stack"
      meta={`용량 ${sequence?.capacity ?? 6}개`}
      stepIndex={step?.index ?? null}
    >
      {sequence && (
        <div className="sequence-table-wrap">
          <table className="sequence-table">
            <caption>논리적 위치와 포인터</caption>
            <thead>
              <tr>
                <th scope="col">위치</th>
                <th scope="col">값</th>
                <th scope="col">역할</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: sequence.capacity }, (_, index) => (
                <tr key={index}>
                  <th scope="row">{index}</th>
                  <td>
                    {index < sequence.items.length ? JSON.stringify(sequence.items[index]) : '빈칸'}
                  </td>
                  <td>
                    {Object.entries(sequence.pointers)
                      .filter(([, position]) => position === index)
                      .map(([name]) => name)
                      .join(' / ') || (index < sequence.items.length ? '저장' : '사용 가능')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="panel-footnote">
            {sequence.items.length === 0
              ? '빈 구조에서는 모든 포인터가 없음입니다.'
              : 'Front/Rear 또는 Top은 현재 저장된 원소를 가리킵니다.'}{' '}
            표의 빈칸은 실제 배열 할당이나 순환 큐 구현을 뜻하지 않습니다.
          </p>
        </div>
      )}
    </Panel>
  );
}
