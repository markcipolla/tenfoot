import { ReactNode } from 'react';

export interface LoadingScreenProps {
  icon: ReactNode;
  iconBgClass?: string;
  iconTextClass?: string;
  spinnerClass?: string;
  title: string;
  subtitle?: string;
}

export function LoadingScreen({
  icon,
  iconBgClass = 'bg-surface',
  iconTextClass = 'text-text-primary',
  spinnerClass = 'border-t-accent',
  title,
  subtitle = 'Looking for installed games...',
}: LoadingScreenProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full p-xl text-center overflow-y-auto">
      <div className="flex flex-col items-center gap-lg max-w-[400px]">
        <div
          className={`w-20 h-20 flex items-center justify-center ${iconBgClass} rounded-xl ${iconTextClass} animate-pulse [&_svg]:w-12 [&_svg]:h-12 [&_img]:w-12 [&_img]:h-12`}
        >
          {icon}
        </div>
        <h1 className="text-[1.75rem] font-bold text-text-primary m-0">{title}</h1>
        <p className="text-base text-text-secondary m-0 leading-relaxed">{subtitle}</p>
        <div className={`w-8 h-8 border-3 border-surface ${spinnerClass} rounded-full animate-spin`} />
      </div>
    </div>
  );
}
