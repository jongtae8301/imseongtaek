import type { ComponentProps, ReactNode } from 'react';
import { Icon } from './icons';

export function Panel({
  id,
  number,
  title,
  icon,
  meta,
  stepIndex,
  children,
  className = '',
}: {
  id: string;
  number: string;
  title: string;
  icon: ComponentProps<typeof Icon>['name'];
  meta?: ReactNode;
  stepIndex: number | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`panel ${className}`}
      aria-labelledby={`${id}-title`}
      data-panel={id}
      tabIndex={-1}
      data-step={stepIndex ?? 'empty'}
    >
      <header className="panel-heading">
        <div>
          <span className="panel-number">{number}</span>
          <Icon name={icon} />
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        {meta && <span className="panel-meta">{meta}</span>}
      </header>
      {children}
    </section>
  );
}
