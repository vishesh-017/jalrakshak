import { cn } from '../../lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[#060d19]/90 backdrop-blur-md border border-cyan-950/70 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.7)] transition-all duration-200 text-slate-100',
        onClick && 'cursor-pointer hover:border-cyan-500/50 hover:shadow-cyan-950/30 hover:-translate-y-0.5',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-3.5 border-b border-cyan-950/60', className)}>{children}</div>;
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('text-sm font-bold text-slate-100 tracking-tight font-heading', className)}>{children}</h3>;
}
