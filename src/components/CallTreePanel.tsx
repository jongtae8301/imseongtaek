import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { CallNode, DeepReadonly, Snapshot } from '../engine/types';
import { Panel } from './Panel';
import { Icon } from './icons';
import { formatValue } from './format';

export function CallTreePanel({ step }: { step: Snapshot | null }) {
  const tree = step?.structures.find((structure) => structure.kind === 'call-tree');
  const nodes = tree?.nodes ?? [];
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [scale, setScale] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);
  const children = new Map<string | null, DeepReadonly<CallNode>[]>();
  nodes.forEach((node) =>
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node]),
  );
  const descendants = (id: string): number =>
    (children.get(id) ?? []).reduce((sum, node) => sum + 1 + descendants(node.id), 0);
  useEffect(() => {
    if (step?.index === 0) {
      setCollapsed(new Set());
      if (canvas.current) {
        canvas.current.scrollLeft = 0;
      }
    }
  }, [step?.index]);
  useEffect(() => {
    const region = canvas.current;
    if (!region) return;
    const scrollToActive = () => {
      const active = region.querySelector<HTMLElement>('.tree-node.active');
      if (!region.clientHeight || !active) return;
      const box = active.getBoundingClientRect(),
        view = region.getBoundingClientRect();
      if (box.left < view.left || box.right > view.right)
        region.scrollLeft += box.left - view.left - 15;
    };
    scrollToActive();
    const observer = new ResizeObserver(scrollToActive);
    observer.observe(region);
    return () => observer.disconnect();
  }, [step?.activeFrameId]);
  const render = (node: DeepReadonly<CallNode>): ReactNode => {
    const list = children.get(node.id) ?? [],
      folded = node.state === 'returned' && collapsed.has(node.id);
    return (
      <li key={node.id}>
        <div className={`tree-node ${node.state}`} data-call-id={node.id}>
          <span className="node-id">{node.id.replace('frame-', '#')}</span>
          <div>
            <code>{node.label}</code>
            <small>
              깊이 {node.depth} · {node.parentId ? `부모 ${node.parentId}` : '최초 호출'}
            </small>
          </div>
          <span className="node-state">
            {node.state === 'active'
              ? '● 현재'
              : node.state === 'waiting'
                ? '◷ 대기'
                : `✓ 반환 ${formatValue(node.returnValue)}`}
          </span>
          {!!list.length && (
            <button
              className="branch-toggle"
              disabled={node.state !== 'returned'}
              aria-label={`호출 ${node.id} 가지 ${folded ? '펼치기' : '접기'}`}
              aria-expanded={!folded}
              title={
                node.state !== 'returned'
                  ? '현재 실행 경로는 항상 펼쳐 둡니다.'
                  : '완료한 호출의 표시만 접거나 펼칩니다.'
              }
              onClick={() =>
                setCollapsed((previous) => {
                  const next = new Set(previous);
                  if (next.has(node.id)) next.delete(node.id);
                  else next.add(node.id);
                  return next;
                })
              }
            >
              {folded ? '＋' : '−'}
            </button>
          )}
        </div>
        {folded ? (
          <p className="folded-branch">
            아래 {descendants(node.id)}개 호출의 표시를 접었습니다. 실제 실행 기록은 유지됩니다.
          </p>
        ) : (
          !!list.length && <ol className="call-children">{list.map(render)}</ol>
        )}
      </li>
    );
  };
  return (
    <Panel
      id="visualization"
      number="02"
      title="시각화"
      icon="tree"
      stepIndex={step?.index ?? null}
      meta={`호출 트리 · ${nodes.length}개 호출`}
      className="tree-panel"
    >
      <div className="tree-legend">
        <span>
          <i className="dot active" />
          현재 호출
        </span>
        <span>
          <i className="dot waiting" />
          반환 대기
        </span>
        <span>
          <i className="dot returned" />
          복귀 완료
        </span>
      </div>
      {nodes.length > 0 && (
        <div className="call-tree-controls">
          <button
            onClick={() =>
              setCollapsed(
                new Set(
                  nodes
                    .filter((node) => node.state === 'returned' && children.has(node.id))
                    .map((node) => node.id),
                ),
              )
            }
            disabled={!nodes.some((node) => node.state === 'returned' && children.has(node.id))}
          >
            완료 가지 접기
          </button>
          <button onClick={() => setCollapsed(new Set())} disabled={!collapsed.size}>
            전체 펼치기
          </button>
          <span className="tree-text-size">
            <button
              aria-label="호출 트리 글자 축소"
              disabled={scale <= 1}
              onClick={() => setScale((s) => s - 0.25)}
            >
              −
            </button>
            <output>{scale * 100}%</output>
            <button
              aria-label="호출 트리 글자 확대"
              disabled={scale >= 1.5}
              onClick={() => setScale((s) => s + 0.25)}
            >
              ＋
            </button>
          </span>
        </div>
      )}
      <div
        className="tree-canvas"
        ref={canvas}
        tabIndex={0}
        data-scroll-region
        aria-label="호출 트리, 가로로 스크롤하여 전체 호출 확인"
      >
        {nodes.length ? (
          <ol className="call-tree hierarchical-calls" style={{ fontSize: `${12 * scale}px` }}>
            {(children.get(null) ?? []).map(render)}
          </ol>
        ) : (
          <div className="empty-visual">
            <div className="empty-icon">
              <Icon name="tree" size={32} />
            </div>
            <strong>첫 호출을 기다리고 있어요</strong>
            <p>
              단계를 진행하면 함수 사이의
              <br />
              호출 관계가 이곳에 쌓입니다.
            </p>
          </div>
        )}
      </div>
      <details className="panel-guide">
        <summary>호출 트리 읽는 법</summary>
        <p className="panel-footnote">
          괄호 안은 호출 당시 인수입니다. 복귀한 호출도 트리에 남습니다. 가지 접기는 화면 표시만
          바꾸며 알고리즘의 가지 배제가 아닙니다. 현재 프레임은 콜 스택에서 확인하세요.
        </p>
      </details>
    </Panel>
  );
}
