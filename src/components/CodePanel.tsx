import type { ExecutionRun, Snapshot } from '../engine/types';
import { Panel } from './Panel';
import { formatValue } from './format';

function CodeLine({ text }: { text: string }) {
  return (
    <>
      {text
        .split(
          /(\b(?:def|if|else|return|from|import|while|for|in|not|None|global)\b|\b\d+\b|\b(?:sum_to|factorial|fib|local_add|add_to_total|process|dfs|set|add|append|popleft|pop|deque|print|len)\b)/g,
        )
        .map((part, i) => (
          <span
            key={i}
            className={
              /^(def|if|else|return|from|import|while|for|in|not|None|global)$/.test(part)
                ? 'syntax-keyword'
                : /^\d+$/.test(part)
                  ? 'syntax-number'
                  : /^(sum_to|factorial|fib|local_add|add_to_total|process|dfs|set|add|append|popleft|pop|deque|print|len)$/.test(
                        part,
                      )
                    ? 'syntax-function'
                    : ''
            }
          >
            {part}
          </span>
        ))}
    </>
  );
}
export function CodePanel({
  run,
  step,
  profile = 'recursion',
}: {
  run: ExecutionRun | null;
  step: Snapshot | null;
  profile?: 'recursion' | 'linear' | 'graph' | 'tree-distance';
}) {
  return (
    <Panel
      id="code"
      number="01"
      title="코드 / 문제"
      icon="code"
      stepIndex={step?.index ?? null}
      meta="Python · 읽기 전용"
    >
      {run ? (
        <>
          <div className="code-caption">
            <code>
              {run.metadata.exampleId === 'sum-recursive'
                ? 'sum_to.py'
                : `${run.metadata.exampleId}.py`}
            </code>
            <span>
              {step?.source ? `방금 실행한 줄 ${step.source.line}` : '코드 줄에 대응하지 않는 상태'}
            </span>
          </div>
          {profile === 'linear' && (
            <p className="panel-footnote">
              <code>item = {formatValue(step?.globals.item)}</code> · 마지막 삽입 입력값
            </p>
          )}
          <ol className="source-code" aria-label="예제 Python 코드" tabIndex={0} data-scroll-region>
            {run.metadata.code.lines.map((line, i) => (
              <li
                key={i}
                className={step?.source?.line === i + 1 ? 'current-line' : ''}
                aria-current={step?.source?.line === i + 1 ? 'step' : undefined}
              >
                <span className="line-number" aria-hidden="true">
                  {i + 1}
                </span>
                <code>
                  <CodeLine text={line || ' '} />
                </code>
                {step?.source?.line === i + 1 && <span className="sr-only">방금 실행한 줄</span>}
              </li>
            ))}
          </ol>
          <details className="panel-guide">
            <summary>코드 읽는 법</summary>
            <p className="panel-footnote">
              {profile === 'tree-distance'
                ? '부모·깊이 또는 배열·인덱스는 입력 트리에서 준비합니다. a·b 대입부터 추적하며, 이동 후 다음 줄에서 거리를 더합니다.'
                : profile === 'graph'
                  ? 'adj·빈 기록·함수 정의는 초기 상태로 준비합니다. 이후 탐색 행을 실행한 상태를 표시합니다.'
                  : profile === 'linear'
                    ? '삽입·삭제 요청에 맞는 코드 조각만 실행합니다. item은 조건 검사 전에 준비한 입력값이며, 같은 코드를 반복 사용합니다. 내장 메서드의 내부 실행은 펼치지 않습니다.'
                    : '호출 줄은 함수에 진입할 때, 대입은 반환 후 완료될 때 다시 강조합니다.'}
            </p>
          </details>
        </>
      ) : (
        <p className="empty-small">올바른 입력을 적용하면 코드가 표시됩니다.</p>
      )}
    </Panel>
  );
}
