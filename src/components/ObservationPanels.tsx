import {
  Children,
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
const areas = [
  ['code', '코드'],
  ['visualization', '시각화'],
  ['state', '현재 상태'],
  ['structures', '자료구조'],
  ['history', '실행 기록'],
  ['analysis', '분석'],
] as const;
type Area = (typeof areas)[number][0];
type Preferences = {
  focused: boolean;
  setFocused: Dispatch<SetStateAction<boolean>>;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
};
const ObservationPreferences = createContext<Preferences | null>(null);
/** 표시 선호만 앱 메모리에 유지한다. 학생 입력·실행 기록은 저장하지 않는다. */
export function ObservationPreferencesProvider({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(true);
  const [expanded, setExpanded] = useState(false);
  return (
    <ObservationPreferences.Provider value={{ focused, setFocused, expanded, setExpanded }}>
      {children}
    </ObservationPreferences.Provider>
  );
}
export function useObservationView() {
  const preferences = useContext(ObservationPreferences);
  if (!preferences) throw new Error('관찰 화면 설정이 필요합니다.');
  const [area, setArea] = useState<Area>(() =>
    window.matchMedia('(max-width: 900px)').matches ? 'visualization' : 'code',
  );
  const [focusRequest, setFocusRequest] = useState(0);
  const panels = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!focusRequest) return;
    panels.current
      ?.querySelector<HTMLElement>('[data-panel="code"]')
      ?.focus({ preventScroll: true });
    panels.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [focusRequest]);
  return {
    ...preferences,
    area,
    setArea,
    panels,
    revealCode() {
      preferences.setFocused(true);
      setArea('code');
      setFocusRequest((n) => n + 1);
    },
  };
}
type View = ReturnType<typeof useObservationView>;
export function ObservationControls({ view, title }: { view: View; title: string }) {
  return (
    <div className="observation-controls">
      <div className="session-title">
        <h1>{title.split(' · ')[0]}</h1>
        <p className="session-meta">{title.split(' · ').slice(1).join(' · ')}</p>
      </div>
      <button aria-expanded={!view.focused} onClick={() => view.setFocused((n) => !n)}>
        {view.focused ? '예제·설정' : '설정 닫기'}
        <span aria-hidden="true">{view.focused ? '＋' : '−'}</span>
      </button>
    </div>
  );
}
export function ObservationPanels({
  view,
  children,
  actions,
  summary,
}: {
  view: View;
  children: ReactNode;
  actions?: ReactNode;
  summary: ReactNode;
}) {
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const update = () => setNarrow(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const tabs = narrow ? areas : areas.filter(([id]) => id !== 'visualization');
  const selected = !narrow && view.area === 'visualization' ? 'code' : view.area;
  return (
    <div className="observation-panels" ref={view.panels}>
      {summary}
      {actions && (
        <div className="observation-comparison" role="group" aria-label="비교 과정 전환">
          {actions}
        </div>
      )}
      <div className="workbench-label">
        <span>실행 관찰</span>
        <button aria-expanded={view.expanded} onClick={() => view.setExpanded((n) => !n)}>
          {view.expanded ? '간단히 보기' : '모두 펼치기'}
        </button>
      </div>
      <div className={'workspace-grid ' + (view.expanded ? 'expanded-grid' : 'compact-grid')}>
        {!view.expanded && (
          <div className="panel-tabs" role="tablist" aria-label="관찰 영역">
            {tabs.map(([id, title], i) => (
              <button
                key={id}
                id={'tab-' + id}
                role="tab"
                aria-controls={'area-' + id}
                aria-selected={selected === id}
                tabIndex={selected === id ? 0 : -1}
                onClick={() => view.setArea(id)}
                onKeyDown={(event) => {
                  const next =
                    event.key === 'ArrowRight'
                      ? (i + 1) % tabs.length
                      : event.key === 'ArrowLeft'
                        ? (i + tabs.length - 1) % tabs.length
                        : event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? tabs.length - 1
                            : null;
                  if (next === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  const area = tabs[next]![0];
                  view.setArea(area);
                  document.getElementById('tab-' + area)?.focus();
                }}
              >
                {title}
              </button>
            ))}
          </div>
        )}
        {Children.toArray(children).map((child, i) => {
          const id = areas[i]![0];
          const tabbed = !view.expanded && (narrow || id !== 'visualization');
          return (
            <div
              key={id}
              className={'panel-slot slot-' + id}
              id={'area-' + id}
              role={tabbed ? 'tabpanel' : undefined}
              aria-labelledby={tabbed ? 'tab-' + id : undefined}
              hidden={tabbed && selected !== id}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}
