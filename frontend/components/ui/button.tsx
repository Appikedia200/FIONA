import * as React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => {
    const baseStyles = {
      height: '32px',
      borderRadius: '6px',
      fontSize: '13px',
      fontWeight: 500,
      padding: '0 16px',
      transition: 'all 0.15s',
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      opacity: props.disabled ? 0.5 : 1,
    };

    const variants = {
      primary: {
        backgroundColor: 'var(--accent)',
        color: 'white',
        border: 'none',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
      },
      danger: {
        backgroundColor: 'transparent',
        color: 'var(--danger)',
        border: '1px solid var(--danger)',
      },
    };

    return (
      <button
        ref={ref}
        style={{ ...baseStyles, ...variants[variant] }}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
