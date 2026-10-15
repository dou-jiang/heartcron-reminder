<template>
  <div class="hc-page" v-loading="loading">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">全局配置</div>
        <div class="hc-toolbar__desc">密钥仅保存在后端数据库，接口返回时做掩码处理，不会明文返回前端</div>
      </div>
      <div>
        <el-button :loading="pushing" @click="handleTestPush">
          <el-icon><Promotion /></el-icon>
          一键测试推送
        </el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存配置</el-button>
      </div>
    </div>

    <el-form ref="formRef" :model="form" :rules="rules" label-width="150px">
      <el-card class="hc-card" shadow="never">
        <template #header><span class="hc-section-title">WxPusher 推送配置</span></template>
        <el-form-item label="AppToken" prop="wx_pusher_apptoken">
          <SecretInput
            v-model="form.wx_pusher_apptoken"
            :configured="configured.wx_pusher_apptoken"
            placeholder="WxPusher 应用 AppToken"
          />
        </el-form-item>
        <el-form-item label="接收 UID" prop="wx_pusher_uid">
          <el-input v-model="form.wx_pusher_uid" placeholder="多个 UID 用英文逗号分隔，例如 UID_xxx,UID_yyy" />
          <div class="hc-muted">在 WxPusher 后台「我的」页面获取 UID</div>
        </el-form-item>
        <el-form-item label="消息标题模板" prop="wx_pusher_title">
          <el-input v-model="form.wx_pusher_title" placeholder="HeartCron 心时 · 今日份关心" />
          <div class="hc-muted">支持变量，例如 <code v-pre>{{girl_name}}</code> 的今日份关心</div>
        </el-form-item>
      </el-card>

      <el-card class="hc-card" shadow="never">
        <template #header><span class="hc-section-title">和风天气配置</span></template>
        <el-form-item label="和风天气 Key" prop="qweather_key">
          <SecretInput v-model="form.qweather_key" :configured="configured.qweather_key" placeholder="和风天气 API Key" />
        </el-form-item>
        <el-form-item label="城市 ID" prop="qweather_city_id">
          <el-input v-model="form.qweather_city_id" placeholder="例如 101230101" />
          <div class="hc-muted">可在和风天气控制台「城市查询」中获取 Location ID</div>
        </el-form-item>
        <el-form-item label="API Host" prop="qweather_host">
          <el-input v-model="form.qweather_host" placeholder="例如 abc123.qweatherapi.com" />
          <div class="hc-muted">填写和风天气控制台提供的 API Host，不包含路径</div>
        </el-form-item>
      </el-card>

      <el-card class="hc-card" shadow="never">
        <template #header>
          <div class="hc-card__header">
            <span class="hc-section-title">AI 大模型配置</span>
            <el-button v-if="isPhpSite" type="primary" :loading="testingAi" @click="handleTestAi">测试 AI</el-button>
          </div>
        </template>
        <el-form-item label="接口地址" prop="ai_api_url">
          <el-input v-model="form.ai_api_url" placeholder="https://api.openai.com/v1（兼容 OpenAI 格式）" />
          <div class="hc-muted">支持基础地址或完整的 /chat/completions 地址</div>
        </el-form-item>
        <el-form-item label="API Key" prop="ai_api_key">
          <SecretInput v-model="form.ai_api_key" :configured="configured.ai_api_key" placeholder="sk-..." />
        </el-form-item>
        <el-form-item label="模型名称" prop="ai_model">
          <el-input v-model="form.ai_model" placeholder="gpt-4o-mini" />
        </el-form-item>
        <el-form-item label="随机性 temperature">
          <el-slider v-model="form.ai_temperature" :min="0" :max="1" :step="0.1" show-input />
        </el-form-item>
        <el-form-item label="最大输出 token">
          <el-input-number v-model="form.ai_max_tokens" :min="1" :max="100000" :step="50" />
        </el-form-item>
        <div v-if="isPhpSite" class="hc-ai-test">
          <div class="hc-muted">测试使用当前填写的 AI 配置，无需先保存。会调用一次模型，不发送微信消息；成功后请保存配置。</div>
          <el-alert v-if="aiResult" :type="aiResult.success ? 'success' : 'error'" :closable="false" show-icon :title="aiResult.success ? 'AI 测试成功' : 'AI 测试失败'">
            <div>模型：{{ aiResult.model || '未填写' }} · 耗时：{{ aiResult.elapsedMs }} ms<span v-if="aiResult.httpStatus"> · HTTP {{ aiResult.httpStatus }}</span></div>
            <div class="hc-ai-output">{{ aiResult.success ? aiResult.content : aiResult.errorMsg }}</div>
          </el-alert>
        </div>
      </el-card>

      <el-card class="hc-card" shadow="never">
        <template #header>
          <div class="hc-card__header">
            <span class="hc-section-title">AI 提示词模板</span>
            <el-button link type="primary" @click="form.ai_prompt_template = defaultPrompt">恢复默认模板</el-button>
          </div>
        </template>
        <el-form-item label="Prompt 模板" prop="ai_prompt_template">
          <el-input v-model="form.ai_prompt_template" type="textarea" :rows="14" class="hc-prompt" />
        </el-form-item>
        <div class="hc-vars">
          <span class="hc-muted">可用变量：</span>
          <el-tag v-for="item in variableList" :key="item" size="small" effect="plain" class="hc-var-tag">{{ item }}</el-tag>
        </div>
      </el-card>

      <el-card class="hc-card" shadow="never">
        <template #header>
          <div class="hc-card__header">
            <span class="hc-section-title">全局默认推送内容</span>
            <span class="hc-muted">用于跟随全局的任务；任务也可以设置独立内容</span>
          </div>
        </template>
        <el-form-item label="内容来源" prop="push_mode">
          <el-radio-group v-model="form.push_mode">
            <el-radio-button v-for="item in options.pushModes" :key="item.value" :label="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="form.push_mode === 'template'">
          <el-form-item label="模板内容" prop="push_template">
            <el-input
              v-model="form.push_template"
              type="textarea"
              :rows="12"
              class="hc-prompt"
              placeholder="支持 {{变量}} 与 {{变量.DATA}} 两种写法"
            />
          </el-form-item>
          <el-form-item label="插入示例模板">
            <div class="hc-samples">
              <el-button v-for="item in options.templateSamples" :key="item.key" @click="form.push_template = item.content">
                {{ item.name }}
              </el-button>
              <div class="hc-muted">点击即覆盖当前模板内容，可再自行修改</div>
            </div>
          </el-form-item>
          <div class="hc-vars">
            <span class="hc-muted">可用变量：</span>
            <el-tag v-for="item in templateVarList" :key="item" size="small" effect="plain" class="hc-var-tag">{{ item }}</el-tag>
          </div>
        </template>
      </el-card>

      <el-card class="hc-card" shadow="never">
        <template #header><span class="hc-section-title">基础信息</span></template>
        <el-form-item label="男方昵称" prop="boy_name">
          <el-input v-model="form.boy_name" placeholder="男方昵称" />
          <div class="hc-muted">对应变量 <code v-pre>{{boy_name}}</code></div>
        </el-form-item>
        <el-form-item label="女方昵称" prop="girl_name">
          <el-input v-model="form.girl_name" placeholder="女方昵称" />
          <div class="hc-muted">对应变量 <code v-pre>{{girl_name}}</code></div>
        </el-form-item>
        <el-form-item label="默认文案风格" prop="default_style">
          <el-select v-model="form.default_style" class="hc-select">
            <el-option v-for="item in options.styleTypes" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="相恋开始日期">
          <el-date-picker
            v-model="form.love_start_date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="例如 2023-05-20"
          />
          <div class="hc-muted">
            对应 <code v-pre>{{love}}</code>（相恋第几天）与 <code v-pre>{{anniversary}}</code>（周年数）
          </div>
        </el-form-item>
        <el-form-item label="生日">
          <el-date-picker v-model="form.birthday" type="date" value-format="YYYY-MM-DD" placeholder="例如 1998-08-08" />
          <div class="hc-muted">
            对应 <code v-pre>{{birthday}}</code>（倒计时天数）与 <code v-pre>{{individual}}</code>（人生中的第几个生日）
          </div>
        </el-form-item>
        <el-form-item label="每月发薪日">
          <el-input-number v-model="form.pay_day" :min="0" :max="31" />
          <div class="hc-muted">对应 <code v-pre>{{pay}}</code>（距离发薪日还有几天），填 0 表示不启用</div>
        </el-form-item>
        <el-form-item label="每日一句">
          <el-input
            v-model="form.love_message"
            type="textarea"
            :rows="5"
            placeholder="每行一条，推送时随机取一条"
          />
          <div class="hc-muted">对应 <code v-pre>{{message}}</code></div>
        </el-form-item>
      </el-card>
    </el-form>

    <PushResultDialog v-model="dialogVisible" :result="pushResult" />
  </div>
</template>

<script setup>
/**
 * 全局配置页：WxPusher / 和风天气 / AI 大模型 / Prompt 模板 / 基础信息
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';

import { apiGetConfig, apiTestAi, apiTestPush, apiUpdateConfig } from '@/api';
import SecretInput from '@/components/SecretInput.vue';
import PushResultDialog from '@/components/PushResultDialog.vue';

/** 与后端默认 Prompt 保持一致，用于「恢复默认模板」 */
const defaultPrompt = `# 人设
你是【{{boy_name}}】，一名程序员，对女朋友【{{girl_name}}】细心温柔，表达内敛真诚，带有一点程序员式的浪漫，不要油腻土味情话，不要长篇大论，文字适合微信消息阅读，控制在80~160字，每次生成内容不重复。

本消息由 HeartCron「心时」暖心调度系统生成。
HeartCron 是一个后台运行的定时守护服务，按照设定时间收集天气、纪念日和待办事项，并生成专属关心消息。
文案中可以偶尔轻量地融入 HeartCron 小彩蛋，但不要频繁出现，不要生硬广告，保持自然、温柔、像男朋友在说话。

# 当前信息
今日日期：{{today_date}}
目标城市天气：{{weather_info}}
纪念日倒计时列表：{{anniversary_list}}
今日需要提醒事项：{{todo_list}}
推送时段：{{push_time_period}}
文案风格：{{style_type}}

# 规则强制遵守
1. 优先结合天气情况给出关心：下雨提醒带伞；降温提醒多穿衣服；高温提醒防晒补水；有天气预警一定要重点提醒。
2. 如果有纪念日倒计时，自然融入文字，不要生硬单独罗列。
3. 把待办事项温柔提醒，不是命令，是关心叮嘱。
4. 程序员小浪漫彩蛋：可以偶尔轻描淡写加入一点点程序员小梗，例如"今日bug清零，温柔优先级最高""后台一直在线，关心永不超时""把你存进最高优先级任务队列"等，但不要太多，随机出现。
5. 禁止生硬列表输出，整合为一段自然连贯的话。
6. 不要出现过多表情，少量即可；不要重复模板句式，每次表达角度不一样。
7. 兜底：如果没有待办、没有纪念日，就单纯根据天气表达关心。
8. 输出只返回最终消息正文，不要额外解释，不要前言后语，不要markdown。`;

const variableList = [
  '{{boy_name}}',
  '{{girl_name}}',
  '{{today_date}}',
  '{{weather_info}}',
  '{{anniversary_list}}',
  '{{todo_list}}',
  '{{push_time_period}}',
  '{{style_type}}',
];

/** 固定模板模式可用变量（{{变量}} 与 {{变量.DATA}} 两种写法等价） */
const templateVarList = [
  '{{dateTime}}',
  '{{love}}',
  '{{anniversary}}',
  '{{birthday}}',
  '{{individual}}',
  '{{pay}}',
  '{{weather}}',
  '{{temp}}',
  '{{humidity}}',
  '{{wind}}',
  '{{city}}',
  '{{message}}',
  '{{todo_list}}',
  '{{anniversary_list}}',
  '{{boy_name}}',
  '{{girl_name}}',
];

const formRef = ref(null);
const loading = ref(false);
const saving = ref(false);
const pushing = ref(false);
const isPhpSite = Boolean(window.HEARTCRON_PHP);
const testingAi = ref(false);
const aiResult = ref(null);
const dialogVisible = ref(false);
const pushResult = ref(null);
const options = reactive({ styleTypes: [], pushModes: [], templateSamples: [] });
const configured = reactive({ wx_pusher_apptoken: false, qweather_key: false, ai_api_key: false });

const form = reactive({
  wx_pusher_apptoken: '',
  wx_pusher_uid: '',
  wx_pusher_title: '',
  qweather_key: '',
  qweather_city_id: '',
  qweather_host: '',
  ai_api_url: '',
  ai_api_key: '',
  ai_model: '',
  ai_temperature: 0.8,
  ai_max_tokens: 600,
  ai_prompt_template: defaultPrompt,
  boy_name: '',
  girl_name: '',
  default_style: '温柔治愈',
  push_mode: 'ai',
  push_template: '',
  love_start_date: '',
  birthday: '',
  pay_day: 0,
  love_message: '',
});

/** AI 相关字段在「固定模板」模式下不再必填 */
function requiredInAiMode(message) {
  return {
    validator: (rule, value, callback) => {
      if (form.push_mode === 'ai' && !String(value || '').trim()) {
        callback(new Error(message));
        return;
      }
      callback();
    },
    trigger: 'blur',
  };
}

const rules = {
  wx_pusher_uid: [{ required: true, message: '请填写 WxPusher 接收 UID', trigger: 'blur' }],
  wx_pusher_title: [{ required: true, message: '请填写推送消息标题模板', trigger: 'blur' }],
  ai_api_url: [requiredInAiMode('请填写大模型接口地址')],
  ai_model: [requiredInAiMode('请填写模型名称')],
  ai_prompt_template: [requiredInAiMode('请填写 Prompt 模板')],
  boy_name: [{ required: true, message: '请填写男方昵称', trigger: 'blur' }],
  girl_name: [{ required: true, message: '请填写女方昵称', trigger: 'blur' }],
  push_mode: [{ required: true, message: '请选择推送内容模式', trigger: 'change' }],
  push_template: [
    {
      validator: (rule, value, callback) => {
        if (form.push_mode === 'template' && !String(value || '').trim()) {
          callback(new Error('固定模板模式下请填写模板内容'));
          return;
        }
        callback();
      },
      trigger: 'blur',
    },
  ],
};

/**
 * 拉取配置并回填表单
 */
async function loadConfig() {
  loading.value = true;
  try {
    const data = await apiGetConfig();
    Object.assign(form, data.config);
    Object.assign(options, data.options);
    // 数据库里可能为 NULL / 空，统一成表单友好的默认值
    form.push_mode = data.config.push_mode === 'template' ? 'template' : 'ai';
    form.push_template = data.config.push_template || '';
    form.love_start_date = data.config.love_start_date || '';
    form.birthday = data.config.birthday || '';
    form.pay_day = Number(data.config.pay_day || 0);
    form.love_message = data.config.love_message || '';
    form.qweather_host = data.config.qweather_host || '';
    configured.wx_pusher_apptoken = Boolean(data.config.wx_pusher_apptoken_configured);
    configured.qweather_key = Boolean(data.config.qweather_key_configured);
    configured.ai_api_key = Boolean(data.config.ai_api_key_configured);
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    loading.value = false;
  }
}

/**
 * 保存配置（未修改的密钥以掩码值提交，后端保持原值）
 */
async function handleSave() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  try {
    const data = await apiUpdateConfig({ ...form });
    Object.assign(form, data.config);
    for (const key of Object.keys(configured)) configured[key] = Boolean(data.config[`${key}_configured`]);
    ElMessage.success('配置已保存');
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    saving.value = false;
  }
}

/**
 * 一键测试推送
 */
async function handleTestPush() {
  pushing.value = true;
  try {
    pushResult.value = await apiTestPush({});
    dialogVisible.value = true;
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    pushing.value = false;
  }
}

async function handleTestAi() {
  testingAi.value = true;
  aiResult.value = null;
  const started = Date.now();
  try {
    aiResult.value = await apiTestAi(Object.fromEntries(
      ['ai_api_url', 'ai_api_key', 'ai_model', 'ai_temperature', 'ai_max_tokens'].map(key => [key, form[key]])
    ));
  } catch (err) {
    aiResult.value = { success: false, errorMsg: err.message || '测试请求失败，请检查网站与 PHP 错误日志', elapsedMs: Date.now() - started, model: form.ai_model };
  } finally {
    testingAi.value = false;
  }
}

onMounted(loadConfig);
</script>

<style scoped>
.hc-section-title {
  font-weight: 600;
}
.hc-ai-test { display: grid; gap: 12px; }
.hc-ai-output { white-space: pre-wrap; overflow-wrap: anywhere; margin-top: 8px; }

.hc-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hc-select {
  width: 220px;
}

.hc-prompt :deep(textarea) {
  min-height: 300px;
  line-height: 1.7;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
}

.hc-vars {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding-left: 150px;
}

.hc-var-tag {
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
}

.hc-samples {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hc-samples .hc-muted {
  flex-basis: 100%;
}
</style>
