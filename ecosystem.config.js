module.exports = {
  apps: [
    {
      name: 'triruto-chat-app',
      script: 'dist/server.js',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development',
        PORT: 9002,
        DISABLE_ERROR_OVERLAY: 'true',
        DISABLE_REACT_DEV_OVERLAY: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 9002,
        DISABLE_ERROR_OVERLAY: 'true',
        DISABLE_REACT_DEV_OVERLAY: 'true'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
}; 