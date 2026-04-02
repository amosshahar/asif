module.exports = {
  apps: [{
    name: 'asif-server',
    script: 'dist/index.js',
    cwd: '/home/ec2-user/asif-server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002,
    },
  }],
}
