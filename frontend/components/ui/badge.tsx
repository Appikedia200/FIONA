interface BadgeProps {
  variant: 'live' | 'active' | 'pending' | '2fa' | 'captured' | 'failed' | 'dead' | 'email' | 'password' | 'inactive';
  children: React.ReactNode;
}

const badgeStyles = {
  live: {
    bg: '#0A2E1E',
    border: '#22D3A5',
    color: '#22D3A5',
  },
  active: {
    bg: '#0A2E1E',
    border: '#22D3A5',
    color: '#22D3A5',
  },
  pending: {
    bg: '#1C1A00',
    border: '#F59E0B',
    color: '#F59E0B',
  },
  '2fa': {
    bg: '#1C1A00',
    border: '#F59E0B',
    color: '#F59E0B',
  },
  captured: {
    bg: '#0A1F0E',
    border: '#22C55E',
    color: '#22C55E',
  },
  failed: {
    bg: '#2D0A0A',
    border: '#EF4444',
    color: '#EF4444',
  },
  dead: {
    bg: '#2D0A0A',
    border: '#EF4444',
    color: '#EF4444',
  },
  email: {
    bg: '#1A1200',
    border: '#D97706',
    color: '#D97706',
  },
  password: {
    bg: '#0A1628',
    border: '#4F7FFF',
    color: '#4F7FFF',
  },
  inactive: {
    bg: '#111419',
    border: '#252A3A',
    color: '#4A5568',
  },
};

export function Badge({ variant, children }: BadgeProps) {
  const style = badgeStyles[variant];
  
  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: '"Geist Mono", monospace',
        fontSize: '10px',
        paddingLeft: '8px',
        paddingRight: '8px',
        paddingTop: '2px',
        paddingBottom: '2px',
        borderRadius: '3px',
        border: `1px solid ${style.border}`,
        backgroundColor: style.bg,
        color: style.color,
      }}
    >
      {children}
    </span>
  );
}
