// Simple console logger with timestamps and colors

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const getTimestamp = (): string => {
  return new Date().toISOString();
};

export const logger = {
  info: (message: string, ...args: any[]): void => {
    console.log(
      `${colors.cyan}[INFO]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  },

  success: (message: string, ...args: any[]): void => {
    console.log(
      `${colors.green}[SUCCESS]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  },

  warn: (message: string, ...args: any[]): void => {
    console.warn(
      `${colors.yellow}[WARN]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  },

  error: (message: string, error?: any): void => {
    console.error(
      `${colors.red}[ERROR]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${message}`,
      error || ''
    );
  },

  debug: (message: string, ...args: any[]): void => {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `${colors.magenta}[DEBUG]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${message}`,
        ...args
      );
    }
  },

  http: (method: string, url: string, status: number): void => {
    const statusColor = status >= 400 ? colors.red : status >= 300 ? colors.yellow : colors.green;
    console.log(
      `${colors.blue}[HTTP]${colors.reset} ${colors.bright}${getTimestamp()}${colors.reset} - ${method} ${url} ${statusColor}${status}${colors.reset}`
    );
  },
};
