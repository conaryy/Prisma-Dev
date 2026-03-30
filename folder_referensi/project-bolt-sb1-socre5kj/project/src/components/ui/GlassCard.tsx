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
        bg-white/5 backdrop-blur-md rounded-xl border border-white/8
        shadow-lg transition-all duration-300
        ${hover ? 'hover:bg-white/10 hover:border-purple-400/30 hover:shadow-purple-500/10' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
