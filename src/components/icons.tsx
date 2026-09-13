type IconName =
  | 'code'
  | 'tree'
  | 'state'
  | 'stack'
  | 'history'
  | 'chart'
  | 'play'
  | 'pause'
  | 'next'
  | 'previous'
  | 'reset'
  | 'book'
  | 'shield';
const paths: Record<IconName, string> = {
  code: 'm8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18',
  tree: 'M12 3v6M5 15v-6h14v6M3 15h4v5H3zM17 15h4v5h-4zM10 1h4v4h-4z',
  state: 'M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4M10 17v4',
  stack: 'm3 7 9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4',
  history: 'M3 11a9 9 0 1 1 2 7M3 4v7h7m2-5v6l4 2',
  chart: 'M4 3v18h17M9 16v-5m5 5V7m5 9v-3',
  play: 'm8 4 12 8-12 8V4Z',
  pause: 'M8 4v16M16 4v16',
  next: 'm9 5 7 7-7 7',
  previous: 'm15 5-7 7 7 7',
  reset: 'M4 4v16M19 5l-9 7 9 7V5Z',
  book: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1m0-15c3-2 6-2 9-1v15c-3-1-6-1-9 1V5Z',
  shield: 'm12 2 8 3v7c0 5-8 9-8 9s-8-4-8-9V5l8-3Zm-4 9 3 3 5-6',
};
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
