import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({ children, className = '', hover = false }: GlassCardProps) {
  return (
    <div
      className={`
        theme-card rounded-xl transition-all duration-300
        ${hover ? 'theme-card-hover' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
