export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, count, countLabel = 'items', actions }: PageHeaderProps) {
  return (
    <header className="flex justify-between items-start mb-md pb-sm pr-md pl-[20px] border-b border-surface">
      <div className="flex flex-col gap-xs">
        <h1 className="text-[1.75rem] font-bold text-text-primary m-0 leading-tight">{title}</h1>
        {subtitle && <p className="text-[0.95rem] text-text-secondary m-0">{subtitle}</p>}
        {count !== undefined && (
          <span className="text-[0.85rem] text-text-muted">
            {count} {count === 1 ? countLabel.replace(/s$/, '') : countLabel}
          </span>
        )}
      </div>
      {actions && <div className="flex items-center gap-sm">{actions}</div>}
    </header>
  );
}
