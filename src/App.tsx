import { useState } from 'react';
import { RecursionWorkspace } from './workspaces/RecursionWorkspace';
import { LinearWorkspace } from './workspaces/LinearWorkspace';
import { GraphActivities } from './workspaces/GraphActivities';
import { TreeWorkspace } from './workspaces/TreeWorkspace';
import { ObservationPreferencesProvider } from './components/ObservationPanels';
const modules = {
  recursion: '함수와 재귀',
  linear: '큐와 스택',
  graph: '그래프와 탐색',
  tree: '트리와 탐색',
};
type Module = keyof typeof modules;
export default function App() {
  const [module, setModule] = useState<Module>('recursion');
  return (
    <ObservationPreferencesProvider>
      <a className="skip-link" href="#workspace">
        실습 영역으로 이동
      </a>
      <header className="app-header">
        <a className="brand" href="./" aria-label="InfoScope 처음 화면">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <strong>InfoScope</strong>
        </a>
        <nav aria-label="실습 메뉴">
          {Object.entries(modules).map(([key, title]) => (
            <button
              key={key}
              aria-label={title}
              className={module === key ? 'nav-active' : 'nav-item'}
              aria-current={module === key ? 'page' : undefined}
              onClick={() => setModule(key as Module)}
            >
              <span className="desktop-nav-label">{title}</span>
              <span className="mobile-nav-label">
                {
                  { recursion: '함수·재귀', linear: '큐·스택', graph: '그래프', tree: '트리' }[
                    key as Module
                  ]
                }
              </span>
            </button>
          ))}
        </nav>
        <span className="header-note">정보과학 실습실</span>
      </header>
      <div className="app-shell">
        {module === 'recursion' ? (
          <RecursionWorkspace />
        ) : module === 'linear' ? (
          <LinearWorkspace />
        ) : module === 'tree' ? (
          <TreeWorkspace />
        ) : (
          <GraphActivities />
        )}
      </div>
    </ObservationPreferencesProvider>
  );
}
