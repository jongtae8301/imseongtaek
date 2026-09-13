import { useState, type ReactNode } from 'react';
import { GraphWorkspace } from './GraphWorkspace';
import { TreeDistanceWorkspace } from './TreeDistanceWorkspace';

export function TreeWorkspace() {
  const [activity, setActivity] = useState<'search' | 'distance'>('search');
  const control: ReactNode = (
    <div className="tree-activity" role="group" aria-label="트리 활동 선택">
      <button aria-pressed={activity === 'search'} onClick={() => setActivity('search')}>
        관계·BFS/DFS
      </button>
      <button aria-pressed={activity === 'distance'} onClick={() => setActivity('distance')}>
        거리·공통 조상
      </button>
      <span>활동을 바꾸면 기본 예제로 새 실습을 시작합니다.</span>
    </div>
  );
  return activity === 'distance' ? (
    <TreeDistanceWorkspace activityControl={control} />
  ) : (
    <GraphWorkspace isTree activityControl={control} />
  );
}
