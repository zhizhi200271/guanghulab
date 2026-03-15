module.exports = {
  apps : [{
    name: 'dingtalk-stream',
    script: 'index-stream.js',
    cwd: '/opt/guanghulab-dingtalk/dingtalk-bot',
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
