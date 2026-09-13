import { useState } from 'react';
import { GraphWorkspace } from './GraphWorkspace';
import { MazeWorkspace } from './MazeWorkspace';

export function GraphActivities() {
  const [activity, setActivity] = useState<'graph' | 'maze'>('graph');
  const control = (
    <div className="tree-activity" role="group" aria-label="그래프 활동 선택">
      <button aria-pressed={activity === 'graph'} onClick={() => setActivity('graph')}>
        그래프 편집·탐색
      </button>
      <button aria-pressed={activity === 'maze'} onClick={() => setActivity('maze')}>
        미로 BFS·DFS
      </button>
      <span>활동을 바꾸면 기본 예제로 새 실습을 시작합니다.</span>
    </div>
  );
  return activity === 'maze' ? (
    <MazeWorkspace activityControl={control} />
  ) : (
    <GraphWorkspace activityControl={control} />
  );
}
