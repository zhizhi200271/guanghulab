const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const moment = require("moment");
const app = express();
app.use(express.json());
// 读取配置文件
const config = require("./config.json");
const PORT = config.serverPort || 3014;
const WEBHOOK_URL = config.webhookUrl;
const LOG_PATH = path.join(__dirname, config.logPath);
const RETRY_COUNT = config.retryCount || 3;
// 确保日志目录存在
if (!fs.existsSync(LOG_PATH)) {
  fs.mkdirSync(LOG_PATH, { recursive: true });
}
// 日志写入函数
const writeLog = (content) => {
  const logFile = path.join(LOG_PATH, `warmup-${moment().format("YYYY-MM-DD")}.log`);
  const logContent = `[${moment().toISOString()}] ${content}\\n`;
  fs.appendFileSync(logFile, logContent, "utf8");
};
// 飞书Webhook通知函数
const sendFeishuWebhook = async (warmupData) => {
  if (!WEBHOOK_URL) {
    writeLog("Webhook通知失败：未配置webhookUrl");
    return { success: false, reason: "未配置webhookUrl" };
  }
  try {
    const notifyData = {
      msg_type: "text",
      content: {
        text: `冷启动热身通知：\n状态：${warmupData.status}\n耗时：${warmupData.elapsed}ms\n时间：${moment(warmupData.timestamp).toISOString()}`
      }
    };
    await axios.post(WEBHOOK_URL, notifyData, { timeout: 5000 });
    writeLog(`Webhook通知成功：${JSON.stringify(warmupData)}`);
    return { success: true };
  } catch (error) {
    const errMsg = `Webhook通知失败：${error.message}`;
    writeLog(errMsg);
    return { success: false, reason: errMsg };
  }
};
// 热身核心函数
const warmup = async () => {
  const startTime = Date.now();
  let status = "success";
  let details = "热身执行成功";
  try {
    // 模拟热身业务逻辑
    await new Promise(resolve => setTimeout(resolve, 10));
  } catch (error) {
    status = "fail";
    details = `热身执行失败：${error.message}`;
    writeLog(details);
  }
  const elapsed = Date.now() - startTime;
  const warmupData = {
    timestamp: new Date().toISOString(),
    status,
    elapsed,
    details
  };
  // 发送Webhook通知（不阻塞热身流程）
  sendFeishuWebhook(warmupData);
  writeLog(`热身完成：${JSON.stringify(warmupData)}`);
  return warmupData;
};
// 自动热身（带失败重试）
const autoWarmup = async (retry = 0) => {
  writeLog(`开始自动热身（第${retry + 1}次）`);
  const result = await warmup();
  if (result.status === "fail" && retry < RETRY_COUNT - 1) {
    writeLog(`自动热身失败，将进行第${retry + 2}次重试`);
    setTimeout(() => autoWarmup(retry + 1), 1000);
  } else if (result.status === "fail") {
    writeLog("自动热身重试次数用尽，执行失败");
  }
};
// 接口：手动触发热身
app.get("/warmup", async (req, res) => {
  try {
    const result = await warmup();
    res.json({ code: 200, msg: "success", data: result });
  } catch (error) {
    res.json({ code: 500, msg: "fail", error: error.message });
  }
});
// 接口：自动热身状态
app.get("/warmup/auto", (req, res) => {
  res.json({
    code: 200,
    msg: "success",
    data: {
      autoWarmupEnabled: true,
      retryCount: RETRY_COUNT,
      lastRun: moment().subtract(5, "minutes").toISOString()
    }
  });
});
// 接口：查询日志
app.get("/warmup/logs", (req, res) => {
  try {
    const logFile = path.join(LOG_PATH, `warmup-${moment().format("YYYY-MM-DD")}.log`);
    if (fs.existsSync(logFile)) {
      const logs = fs.readFileSync(logFile, "utf8").split("\\n").filter(line => line);
      res.json({ code: 200, msg: "success", data: logs });
    } else {
      res.json({ code: 200, msg: "success", data: ["暂无日志"] });
    }
  } catch (error) {
    res.json({ code: 500, msg: "fail", error: error.message });
  }
});
// 环节3新增：触发Webhook通知接口
app.post("/warmup/notify", async (req, res) => {
  try {
    const warmupData = req.body;
    if (!warmupData.status || !warmupData.elapsed) {
      return res.json({ code: 400, msg: "fail", error: "缺少必传参数：status/elapsed" });
    }
    const notifyResult = await sendFeishuWebhook(warmupData);
    if (notifyResult.success) {
      res.json({ code: 200, msg: "Webhook通知发送成功" });
    } else {
      res.json({ code: 500, msg: "Webhook通知发送失败", reason: notifyResult.reason });
    }
  } catch (error) {
    res.json({ code: 500, msg: "fail", error: error.message });
  }
});
// 启动服务+自动热身
app.listen(PORT, () => {
  console.log(`冷启动热身服务启动成功，端口：${PORT}`);
  writeLog(`服务启动成功，端口：${PORT}`);
  autoWarmup(); // 启动时执行自动热身
});
module.exports = app;
