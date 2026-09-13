import type { ExecutionRun, Metrics, Snapshot } from '../engine/types';
import { Panel } from './Panel';

const labels: [keyof Metrics, string, string][] = [
  ['calls', '함수 호출', '회'],
  ['comparisons', '비교', '회'],
  ['assignments', '대입', '회'],
  ['arithmetic', '산술 연산', '회'],
];
const linearLabels: [keyof Metrics, string, string][] = [
  ['inserts', '성공한 삽입', '회'],
  ['removes', '성공한 삭제', '회'],
  ['rejected', '거절한 요청', '회'],
  ['comparisons', '조건 검사', '회'],
];
const graphLabels: [keyof Metrics, string, string][] = [
  ['discoveries', '발견 정점', '개'],
  ['visits', '방문 기록', '회'],
  ['edgeScans', '이웃 확인', '회'],
  ['skipped', '중복 건너뜀', '회'],
];
export function AnalysisPanel({
  run,
  step,
  profile = 'recursion',
}: {
  run: ExecutionRun | null;
  step: Snapshot | null;
  profile?: 'recursion' | 'linear' | 'graph' | 'tree-distance';
}) {
  const isLinear = profile === 'linear';
  const isGraph = profile === 'graph';
  const maximum = isLinear || isGraph ? 'maxSize' : 'maxDepth';
  return (
    <Panel
      id="analysis"
      number="06"
      title="분석"
      icon="chart"
      stepIndex={step?.index ?? null}
      meta="현재 단계까지 누적"
    >
      <div className="analysis-content">
        <div className="metric-grid">
          {(isGraph ? graphLabels : isLinear ? linearLabels : labels).map(([key, label, unit]) => (
            <div className="metric" key={key}>
              <span>{label}</span>
              <strong data-metric={key}>
                {step?.metrics[key] ?? 0}
                <small>{unit}</small>
              </strong>
            </div>
          ))}
        </div>
        <div className="depth-metric">
          <span>
            {isGraph
              ? step?.search?.algorithm === 'dfs'
                ? '최대 콜 스택 크기'
                : '최대 대기 큐 크기'
              : isLinear
                ? '최대 저장 원소 수'
                : '최대 호출 깊이'}
          </span>
          <strong data-metric={maximum}>
            {step?.metrics[maximum] ?? 0}
            <small>{isLinear || isGraph ? '개' : '개 프레임'}</small>
          </strong>
        </div>
        {step?.metrics.iterations !== undefined && !isGraph && !isLinear && (
          <p className="function-iterations">
            반복 몸체 실행 <strong data-metric="iterations">{step.metrics.iterations}회</strong> ·
            {profile === 'tree-distance'
              ? '포인터를 부모로 이동한 횟수입니다. 거리 대입보다 한 줄 먼저 증가합니다.'
              : '최초 호출을 포함한 프레임 수를 집계합니다.'}
          </p>
        )}
        {isGraph && (
          <p className="panel-footnote">
            인접리스트의 도달 가능한 V개 정점·E개 간선에 대해 전체 탐색 O(V+E). 전처리·화면 렌더링은
            제외한 이론이며, 현재 측정값이나 실행 시간이 아닙니다.
          </p>
        )}
        {profile === 'tree-distance' && (
          <p className="panel-footnote">
            트리 높이 h에 대해 부모 이동은 최대 2h회, 반복의 이론적 시간은 O(h)입니다. 준비된
            부모·깊이/인덱스 조회를 상수 시간으로 가정하며 전처리·스냅샷·화면 비용은 제외합니다.
          </p>
        )}
        <details className="metric-rules">
          <summary>무엇을 한 번으로 세나요?</summary>
          {run ? (
            <ul>
              {Object.entries(run.metadata.metricRules)
                .filter(([key]) => !isLinear || !['calls', 'arithmetic', 'maxDepth'].includes(key))
                .map(([key, rule]) => (
                  <li key={key}>{rule}</li>
                ))}
            </ul>
          ) : (
            <p>입력을 먼저 적용해 주세요.</p>
          )}
          <p>
            단계 수와 연산 횟수는 다릅니다. 위 지표는 서로 합산하지 않으며, 실행 속도는 집계에
            영향을 주지 않습니다.
          </p>
          {isLinear && (
            <p>
              현재 removed 대입: {step?.metrics.assignments ?? 0}회. 메서드 내부의 실행 시간·이동
              비용·함수 프레임은 집계하지 않습니다.
            </p>
          )}
        </details>
      </div>
    </Panel>
  );
}
