module.exports = {
  apps: [
    {
      name: 'tavo-app',
      script: 'server/index.js',
      cwd: __dirname,
      instances: process.env.PM2_INSTANCES || 1,
      exec_mode: process.env.PM2_INSTANCES ? 'cluster' : 'fork',
      max_memory_restart: '512M',
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        LOG_FORMAT: 'json',
      },
      out_file: '/var/log/tavo/out.log',
      error_file: '/var/log/tavo/error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
