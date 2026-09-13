import type { FunctionComparison as Comparison, FunctionMethod } from '../examples/functions';
import { formatValue } from './format';

export function FunctionComparison({
  comparison,
  method,
  index,
  positions,
  onInspect,
}: {
  comparison: Comparison;
  method: FunctionMethod;
  index: number;
  positions: Record<FunctionMethod, number>;
  onInspect: (method: FunctionMethod) => void;
}) {
  return (
    <section className="search-comparison function-comparison" aria-label="재귀·반복 비교">
      <h2>같은 문제, 같은 입력 · n = {String(comparison.recursive.metadata.input.n)}</h2>
      <p>
        {comparison.sameResult === null
          ? '한도에 도달한 실행이 있어 최종 결과를 비교할 수 없습니다.'
          : comparison.sameResult
            ? '정상 종료한 두 방식의 결과가 일치합니다.'
            : '두 방식의 결과가 일치하지 않습니다.'}{' '}
        아래 수치는 각 실행의 마지막 기록입니다. 단계 보기로 전환하면 위 여섯 영역에서 해당 방식의
        과정을 관찰할 수 있습니다.
      </p>
      <div className="comparison-grid">
        {(['recursive', 'iterative'] as const).map((key) => {
          const run = comparison[key],
            last = run.steps.at(-1)!;
          const title = key === 'recursive' ? '재귀' : '반복';
          return (
            <article key={key} data-function-comparison={key}>
              <h3>
                {title}{' '}
                <small>{last.status === 'completed' ? '정상 종료' : '한도 도달 · 미완료'}</small>
              </h3>
              <dl className="search-facts">
                <div>
                  <dt>최종 결과</dt>
                  <dd>
                    {last.status === 'completed'
                      ? formatValue(last.globals.result)
                      : '아직 확정하지 않음'}
                  </dd>
                </div>
                <div>
                  <dt>함수 호출 / 최대 깊이</dt>
                  <dd>
                    {last.metrics.calls}회 / {last.metrics.maxDepth}개 프레임
                  </dd>
                </div>
                <div>
                  <dt>비교 / 대입 / 산술</dt>
                  <dd>
                    {last.metrics.comparisons}회 / {last.metrics.assignments}회 /{' '}
                    {last.metrics.arithmetic}회
                  </dd>
                </div>
                <div>
                  <dt>반복 몸체 실행</dt>
                  <dd>{last.metrics.iterations ?? 0}회</dd>
                </div>
              </dl>
              <button aria-pressed={method === key} onClick={() => onInspect(key)}>
                {title} 단계 보기
              </button>
              <p className="panel-footnote">
                관찰 위치 {method === key ? index : positions[key]} / {run.steps.length - 1} ·
                위치를 따로 기억합니다.
              </p>
            </article>
          );
        })}
      </div>
      <p className="comparison-note">
        같은 단계 번호는 같은 계산량이 아닙니다. 지표는 합산하지 않으며, 실제 실행 시간이나 교육
        효과를 측정한 값도 아닙니다. 반복 구현도 함수 안에서 실행하므로 최초 호출 1회와 깊이 1을
        포함합니다.
      </p>
    </section>
  );
}
