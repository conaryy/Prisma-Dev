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
        bg-white/5 backdrop-blur-md rounded-xl border border-violet-500/35
        shadow-lg shadow-violet-950/20 transition-all duration-300
        ${hover ? 'hover:bg-white/10 hover:border-violet-400/55 hover:shadow-violet-500/20' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
