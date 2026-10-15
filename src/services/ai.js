/**
 * 大模型接入（OpenAI 兼容格式，Bearer 鉴权）
 * POST {ai_api_url}/chat/completions
 */
const { http } = require('../utils/http');

/**
 * 兼容用户填写的多种接口地址写法，统一补全为 chat/completions 地址
 * 例：https://api.openai.com/v1  →  https://api.openai.com/v1/chat/completions
 * @param {string} apiUrl 配置的接口地址
 * @returns {string}
 */
function buildChatCompletionsUrl(apiUrl) {
  const url = String(apiUrl || '').trim().replace(/\/+$/, '');
  if (!url) throw new Error('未配置大模型接口地址');
  if (/\/chat\/completions$/.test(url)) return url;
  return url + '/chat/completions';
}

/**
 * 调用大模型生成暖心文案
 * @param {Object} aiConfig system_config 配置行
 * @param {string} fullPrompt 变量替换后的完整提示词
 * @returns {Promise<string>} AI 生成的消息正文
 */
async function getAIMessage(aiConfig, fullPrompt) {
  const { ai_api_url: apiUrl, ai_api_key: apiKey, ai_model: model } = aiConfig || {};
  if (!apiKey) throw new Error('未配置大模型 API Key');
  if (!model) throw new Error('未配置大模型名称');

  const url = buildChatCompletionsUrl(apiUrl);
  const body = {
    model,
    messages: [{ role: 'user', content: fullPrompt }],
    temperature: Number(aiConfig.ai_temperature) >= 0 ? Number(aiConfig.ai_temperature) : 0.8,
    max_tokens: Number(aiConfig.ai_max_tokens) > 0 ? Number(aiConfig.ai_max_tokens) : 600,
    stream: false,
  };

  const res = await http.post(url, body, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });

  const data = res.data || {};
  const choice = (data.choices && data.choices[0]) || {};
  const content = (choice.message && choice.message.content) || choice.text || '';
  if (!content || !String(content).trim()) {
    throw new Error('大模型返回内容为空');
  }

  // 清理可能出现的 markdown 包裹与多余空白，保证微信消息为纯文本
  return String(content)
    .trim()
    .replace(/^\s*```[\w]*\s*/, '')
    .replace(/\s*```\s*$/, '')
    .replace(/^["'「]+|["'」]+$/g, '')
    .trim();
}

module.exports = { getAIMessage, buildChatCompletionsUrl };
