import type { Snapshot } from '../engine/types';
import { distanceFrom, treeFrom } from './GraphPanels';
import { Panel } from './Panel';
import { Values } from './StatePanel';

export function TreeDistancePanel({ step, selected }: { step: Snapshot | null; selected: string }) {
  const distance = distanceFrom(step);
  const tree = treeFrom(step);
  const relation = tree?.nodes.find((n) => n.vertex === selected);
  const position = (v: string | null) => {
    const node = tree?.nodes.find((n) => n.vertex === v);
    return node
      ? `깊이 ${node.depth}${node.arrayIndex !== null ? ` · 인덱스 ${node.arrayIndex}` : ''}`
      : '아직 없음';
  };
  return (
    <Panel
      id="state"
      number="03"
      title="현재 상태"
      icon="state"
      stepIndex={step?.index ?? null}
      meta="두 포인터 · 거리"
    >
      {step && distance ? (
        <div className="state-content graph-state">
          <dl className="search-facts">
            <div>
              <dt>첫 노드 → 현재 a</dt>
              <dd data-distance-a>
                {distance.from} → {distance.a ?? '아직 없음'}
                <small>{position(distance.a)}</small>
              </dd>
            </div>
            <div>
              <dt>둘째 노드 → 현재 b</dt>
              <dd data-distance-b>
                {distance.to} → {distance.b ?? '아직 없음'}
                <small>{position(distance.b)}</small>
              </dd>
            </div>
            <div>
              <dt>누적 거리 · distance</dt>
              <dd data-distance-count>
                {distance.distance ?? '아직 없음'}
                {distance.distance !== null ? '개 간선' : ''}
              </dd>
            </div>
            <div>
              <dt>최소 공통 조상 · lca</dt>
              <dd data-distance-lca>{distance.lca ?? '아직 확정하지 않음'}</dd>
            </div>
            <div>
              <dt>두 노드 사이 경로</dt>
              <dd data-distance-path>{distance.path.join(' → ') || '아직 확정하지 않음'}</dd>
            </div>
          </dl>
          {step.status === 'limit-reached' && (
            <p className="input-notice">
              한도 도달 · 실행 미완료입니다. 현재 누적값을 최종 거리로 해석하지 마세요.
            </p>
          )}
          <div className="distance-trails" aria-label="포인터 이동 기록">
            <p>● a 이동: {distance.trailA.join(' → ') || '아직 없음'}</p>
            <p>◆ b 이동: {distance.trailB.join(' → ') || '아직 없음'}</p>
          </div>
          <p className="panel-footnote">
            깊이가 같아도 다른 노드일 수 있습니다. 두 포인터가 같은 노드에서 만난 뒤 lca를
            대입합니다. 거리는 두 노드 사이 이동 간선 수입니다.
          </p>
          {relation && (
            <div className="vertex-inspector" data-vertex-info>
              <h3>선택 정점 {selected}</h3>
              <p>
                트리 부모: {relation.parent ?? '없음 · 루트'} / 자식:{' '}
                {relation.children.join(', ') || '없음'} / 형제:{' '}
                {relation.siblings.join(', ') || '없음'} / 깊이: {relation.depth} /{' '}
                {relation.leaf ? '단말 노드' : '내부 노드'}
              </p>
            </div>
          )}
          <details>
            <summary>실행 변수와 준비된 입력</summary>
            <Values label="전역 변수" items={step.globals} prefix="globals" step={step} />
          </details>
          {!!step.changes.length && (
            <p className="change-summary">
              △ 이번 단계: {step.changes.map((c) => c.description).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p className="empty-small">거리 계산 준비를 누르면 상태가 표시됩니다.</p>
      )}
    </Panel>
  );
}
