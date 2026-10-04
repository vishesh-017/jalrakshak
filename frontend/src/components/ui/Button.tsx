import { cn } from '../../lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({ children, className, variant = 'primary', size = 'md', loading, disabled, ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-gradient-to-r from-teal-600 via-cyan-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 text-white shadow-sm shadow-teal-500/20 active:scale-[0.98] disabled:from-slate-400 disabled:to-slate-400',
    secondary: 'bg-[#0a233c] text-cyan-300 hover:bg-[#0f3152] border border-cyan-500/30 shadow-xs active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400',
    danger: 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-xs active:scale-[0.98] disabled:bg-red-300',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/70 hover:text-white active:scale-[0.98]',
    outline: 'bg-slate-900/80 border border-slate-700/80 text-slate-200 hover:bg-cyan-950/40 hover:text-cyan-300 hover:border-cyan-500/50 shadow-xs active:scale-[0.98]',
  };
  const sizes = {
    sm: 'px-2.5 py-1 text-xs font-semibold rounded-lg',
    md: 'px-3.5 py-1.5 text-xs font-semibold rounded-xl',
    lg: 'px-5 py-2.5 text-sm font-bold rounded-xl',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 transition-all duration-150 disabled:cursor-not-allowed select-none',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5 text-current" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
