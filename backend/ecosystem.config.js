module.exports = {
  apps: [
    {
      name: 'fiona-backend',
      script: './node_modules/.bin/tsx',
      args: 'src/index.ts',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8000,
      },
      error_file: '/var/log/fiona/backend-error.log',
      out_file: '/var/log/fiona/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
      // Restart delay
      restart_delay: 4000,
      // Kill timeout
      kill_timeout: 5000,
      // Listen timeout
      listen_timeout: 10000,
      // Number of restarts before considering the app as errored
      max_restarts: 10,
      // Min uptime before considering the app as started
      min_uptime: 10000,
    },
  ],
};
