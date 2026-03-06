// 钉钉 Webhook + AI 集成
const express = require('express');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// AI 处理函数
async function processWithAI(content) {
  // 这里接入 Kimi API
  // 暂时返回测试回复
  return `🤖 收到："${content}"\n\n我是之之秋秋，正在开发中...`;
}

// 验证签名
function verifySign(timestamp, sign) {
  const secret = process.env.DINGTALK_APP_SECRET;
  const stringToSign = `${timestamp}\n${secret}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(stringToSign);
  return hmac.digest('base64') === sign;
}

// Webhook 接收消息
app.post('/webhook', async (req, res) => {
  console.log('收到消息:', req.body);
  
  const { text, senderStaffId, conversationId } = req.body;
  
  if (text && text.content) {
    // 调用 AI 处理
    const reply = await processWithAI(text.content);
    
    // 返回回复
    res.json({
      msgtype: 'text',
      text: {
        content: reply
      }
    });
  } else {
    res.json({ msgtype: 'text', text: { content: '收到' } });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🤖 之之秋秋机器人启动: http://localhost:${PORT}`);
  console.log(`Webhook: http://localhost:${PORT}/webhook`);
});