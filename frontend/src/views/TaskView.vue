<template>
  <div class="hc-page">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">定时任务</div>
        <div class="hc-toolbar__desc">
          {{ isPhpSite ? '每条任务可独立设置内容、标题与接收人；按北京时间执行，秒位固定为 0。' : 'cron 格式为 秒 分 时 日 月 周，任务变更后自动重新加载调度。' }}
        </div>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增任务
      </el-button>
    </div>

    <SchedulerPanel v-if="isPhpSite" />
    <el-card class="hc-card" shadow="never">
      <el-table v-loading="loading" :data="list" empty-text="暂无定时任务">
        <el-table-column prop="task_name" label="任务名称" min-width="140" />
        <el-table-column prop="push_time_period" label="提醒场景" width="110" />
        <el-table-column v-if="isPhpSite" label="推送内容" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ modeLabel(row.push_mode) }}{{ row.push_mode === 'template' ? ` · ${row.push_template}` : '' }}</template>
        </el-table-column>
        <el-table-column label="cron 表达式" min-width="220">
          <template #default="{ row }">
            <div class="hc-mono">{{ row.cron_expr }}</div>
            <div class="hc-muted">{{ describeCron(row.cron_expr) }}</div>
            <div v-if="row.schedule_error" class="hc-muted" style="color:#d94d79">{{ row.schedule_error }}</div>
          </template>
        </el-table-column>
        <el-table-column label="下次执行" width="170">
          <template #default="{ row }">{{ formatDateTime(row.next_run) }}</template>
        </el-table-column>
        <el-table-column label="启用" width="80">
          <template #default="{ row }">
            <el-switch :model-value="row.enable === 1" @change="(value) => toggleEnable(row, value)" />
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" :width="isPhpSite ? 200 : 130" fixed="right">
          <template #default="{ row }">
            <el-button v-if="isPhpSite" link type="primary" :loading="pushingId === row.id" @click="testTask(row)">测试推送</el-button>
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑任务' : '新增任务'" width="min(800px, 96vw)" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="任务名称" prop="task_name">
          <el-input v-model="form.task_name" placeholder="例如：早安提醒" />
        </el-form-item>
        <el-form-item label="提醒场景" prop="push_time_period">
          <el-select v-model="form.push_time_period" :allow-create="isPhpSite" filterable default-first-option class="hc-select" placeholder="选择或输入，例如：喝水、吃药、工资提醒">
            <el-option v-for="item in periods" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <template v-if="isPhpSite">
          <el-form-item label="推送内容模式">
            <el-radio-group v-model="form.push_mode">
              <el-radio-button value="template">自定义内容</el-radio-button>
              <el-radio-button value="ai">AI 生成</el-radio-button>
              <el-radio-button value="inherit">跟随全局</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="消息标题">
            <el-input v-model="form.push_title" maxlength="255" placeholder="例如：记得喝水（留空使用全局标题）" />
          </el-form-item>
          <template v-if="form.push_mode === 'template'">
            <el-form-item label="推送内容" prop="push_template">
              <el-input v-model="form.push_template" type="textarea" :rows="7" maxlength="16000" placeholder="写下这条任务要发送的话，例如：工作再忙也要喝水，起来活动一下吧。也支持下方变量。" />
            </el-form-item>
            <el-form-item label="套用示例">
              <div class="task-samples">
                <el-button v-for="sample in samples" :key="sample.name" size="small" @click="form.push_template = sample.content">{{ sample.name }}</el-button>
                <el-button size="small" @click="form.push_template = '工作再忙也要喝水，起来活动一下，照顾好自己。'">喝水提醒</el-button>
              </div>
            </el-form-item>
          </template>
          <template v-if="form.push_mode === 'ai'">
            <el-form-item label="AI 提示词" prop="ai_prompt_template">
              <el-input v-model="form.ai_prompt_template" type="textarea" :rows="6" maxlength="16000" placeholder="例如：写一句鼓励我坚持学习的话，语气轻松，50 字以内。可以使用下方变量。" />
            </el-form-item>
            <el-form-item label="文案风格">
              <el-select v-model="form.style_type" clearable placeholder="跟随全局风格">
                <el-option v-for="style in styles" :key="style" :value="style" :label="style" />
              </el-select>
            </el-form-item>
            <el-form-item><span class="hc-muted">AI 接口在全局配置中填写；调用失败会使用备用文案，并在日志中标明原因。</span></el-form-item>
          </template>
          <el-form-item v-if="form.push_mode !== 'inherit'" label="可用变量">
            <div class="task-variables"><button v-for="name in variableNames" :key="name" type="button" @click="insertVariable(name)">{{ variableToken(name) }}</button><span class="hc-muted">点击插入；可直接写普通文字，无需使用变量。</span></div>
          </el-form-item>
          <el-form-item v-if="form.push_mode === 'inherit'"><span class="hc-muted">本任务使用「全局配置」中的内容模式与模板。切换为「自定义内容」即可单独设置。</span></el-form-item>
          <el-form-item label="接收 UID">
            <el-input v-model="form.wx_pusher_uid" maxlength="500" placeholder="留空使用全局接收人，多个 UID 用逗号分隔" />
          </el-form-item>
        </template>
        <el-form-item label="cron 表达式" prop="cron_expr">
          <CronPicker v-model="form.cron_expr" />
        </el-form-item>
        <el-form-item label="是否启用">
          <el-switch v-model="form.enable" :active-value="1" :inactive-value="0" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="可选，例如：工作日早上叫醒" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="isPhpSite" :loading="previewing" @click="previewTask">预览内容</el-button>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
    <el-dialog v-model="previewVisible" title="本任务推送预览" width="min(640px, 96vw)">
      <el-alert v-if="previewResult?.errorMsg" :title="previewResult.errorMsg" type="warning" :closable="false" />
      <h3>{{ previewResult?.title }}</h3>
      <pre class="task-preview">{{ previewResult?.content }}</pre>
      <p class="hc-muted">本次仅预览，不向微信发送；AI 模式会调用已配置的模型。</p>
    </el-dialog>
    <PushResultDialog v-model="pushDialogVisible" :result="pushResult" />
  </div>
</template>

<script setup>
/**
 * 定时任务管理：表格 CRUD + cron 可视化选择
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { apiCreateTask, apiDeleteTask, apiGetMeta, apiListTasks, apiUpdateTask, apiTaskPreview, apiTestPush } from '@/api';
import { describeCron, validateCron } from '@/utils/cron';
import { formatDateTime } from '@/utils/format';
import CronPicker from '@/components/CronPicker.vue';
import SchedulerPanel from '@/components/SchedulerPanel.vue';
import PushResultDialog from '@/components/PushResultDialog.vue';

const loading = ref(false);
const isPhpSite = Boolean(window.HEARTCRON_PHP);
const saving = ref(false);
const dialogVisible = ref(false);
const list = ref([]);
const periods = ref(['早安', '午间关心', '晚安提醒']);
const formRef = ref(null);
const samples = ref([]);
const styles = ref([]);
const previewing = ref(false);
const previewVisible = ref(false);
const previewResult = ref(null);
const pushingId = ref(null);
const pushDialogVisible = ref(false);
const pushResult = ref(null);
const variableNames = ['dateTime', 'message', 'weather', 'temp', 'humidity', 'wind', 'love', 'birthday', 'pay', 'anniversary', 'individual', 'todo_list', 'push_time_period'];
const contentDefaults = () => ({ push_mode: isPhpSite ? 'template' : 'inherit', push_title: '', push_template: '', ai_prompt_template: '', style_type: '', wx_pusher_uid: '' });
function modeLabel(mode) { return ({ template: '自定义内容', ai: 'AI 生成', inherit: '跟随全局' })[mode] || '跟随全局'; }
function insertVariable(name) {
  const field = form.push_mode === 'ai' ? 'ai_prompt_template' : 'push_template';
  form[field] += '{{' + name + '.DATA}}';
}
function variableToken(name) { return '{{' + name + '.DATA}}'; }

const form = reactive({
  id: null,
  task_name: '',
  cron_expr: '0 30 9 * * *',
  push_time_period: '早安',
  enable: 1,
  remark: '',
  ...contentDefaults(),
});

const rules = {
  task_name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  push_time_period: [{ required: true, message: '请选择或输入提醒场景', trigger: 'change' }],
  push_template: [{ validator: (_, value, callback) => callback(form.push_mode === 'template' && !String(value || '').trim() ? new Error('请输入推送内容') : undefined), trigger: 'blur' }],
  ai_prompt_template: [{ validator: (_, value, callback) => callback(form.push_mode === 'ai' && !String(value || '').trim() ? new Error('请输入 AI 提示词') : undefined), trigger: 'blur' }],
  cron_expr: [
    { required: true, message: '请设置 cron 表达式', trigger: 'change' },
    {
      validator: (rule, value, callback) => {
        if (!value || !validateCron(value)) callback(new Error('cron 表达式不合法，请使用标准 6 位格式'));
        else if (isPhpSite && String(value).trim().split(/\s+/)[0] !== '0') callback(new Error('PHP 版按分钟执行，秒位必须为 0'));
        else callback();
      },
      trigger: 'change',
    },
  ],
};

/**
 * 拉取任务列表
 */
async function loadList() {
  loading.value = true;
  try {
    const data = await apiListTasks();
    list.value = data.list;
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    loading.value = false;
  }
}

/**
 * 打开新增 / 编辑弹窗
 * @param {Object} [row]
 */
function openDialog(row) {
  if (row) {
    Object.assign(form, contentDefaults(), { ...row, push_mode: row.push_mode || 'inherit' });
  } else {
    Object.assign(form, {
      id: null,
      task_name: '',
      cron_expr: '0 30 9 * * *',
      push_time_period: '早安',
      enable: 1,
      remark: '',
      ...contentDefaults(),
    });
  }
  dialogVisible.value = true;
  formRef.value?.clearValidate();
}

/**
 * 保存任务
 */
async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  const payload = {
    task_name: form.task_name,
    cron_expr: form.cron_expr,
    push_time_period: form.push_time_period,
    enable: form.enable,
    remark: form.remark,
    ...(isPhpSite ? Object.fromEntries(Object.keys(contentDefaults()).map(key => [key, form[key]])) : {}),
  };
  try {
    if (form.id) {
      await apiUpdateTask(form.id, payload);
      ElMessage.success('任务已更新');
    } else {
      await apiCreateTask(payload);
      ElMessage.success('任务已创建');
    }
    dialogVisible.value = false;
    loadList();
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    saving.value = false;
  }
}

/**
 * 切换启用状态
 * @param {Object} row
 * @param {boolean} value
 */
async function toggleEnable(row, value) {
  try {
    await apiUpdateTask(row.id, {
      task_name: row.task_name,
      cron_expr: row.cron_expr,
      push_time_period: row.push_time_period,
      enable: value ? 1 : 0,
      remark: row.remark,
      ...(isPhpSite ? Object.fromEntries(Object.keys(contentDefaults()).map(key => [key, row[key]])) : {}),
    });
    ElMessage.success(value ? '任务已启用' : '任务已停用');
    loadList();
  } catch (err) {
    loadList();
  }
}

/**
 * 删除任务
 * @param {Object} row
 */
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${row.task_name}」吗？`, '删除确认', { type: 'warning' });
  } catch (err) {
    return;
  }
  try {
    await apiDeleteTask(row.id);
    ElMessage.success('任务已删除');
    loadList();
  } catch (err) {
    // 错误提示已统一处理
  }
}

async function previewTask() {
  if (!await formRef.value?.validate().catch(() => false)) return;
  previewing.value = true;
  try { previewResult.value = await apiTaskPreview({ ...form }); previewVisible.value = true; } catch {} finally { previewing.value = false; }
}
async function testTask(row) {
  try { await ElMessageBox.confirm(`立即向「${row.task_name}」的接收人发送一次消息？使用这条任务已保存的内容。`, '测试推送', { type: 'info' }); } catch { return; }
  pushingId.value = row.id;
  try { pushResult.value = await apiTestPush({ task_id: row.id }); pushDialogVisible.value = true; } catch {} finally { pushingId.value = null; }
}
onMounted(async () => {
  loadList();
  try {
    const meta = await apiGetMeta();
    periods.value = meta.pushTimePeriods;
    samples.value = meta.templateSamples || [];
    styles.value = meta.styleTypes || [];
  } catch (err) {
    // 使用默认时段
  }
});
</script>

<style scoped>
.hc-select {
  width: 100%;
}
.task-samples, .task-variables { display: flex; gap: 8px; flex-wrap: wrap; }
.task-variables button { cursor: pointer; padding: 2px 6px; background: #fff1f4; border: 0; border-radius: 4px; color: #ad3860; }
.task-preview { white-space: pre-wrap; line-height: 1.8; overflow-wrap: anywhere; font-family: inherit; }
</style>
