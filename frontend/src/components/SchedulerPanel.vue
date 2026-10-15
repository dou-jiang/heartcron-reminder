<template>
  <el-card class="hc-card scheduler" shadow="never">
    <template #header>
      <div class="scheduler-header">
        <strong>自动推送</strong>
        <el-tag :type="state.healthy ? 'success' : 'warning'">{{ state.healthy ? '计划任务已连接' : '等待宝塔计划任务' }}</el-tag>
        <el-button link type="primary" :loading="loading" @click="refresh">刷新状态</el-button>
      </div>
    </template>
    <el-alert v-if="!state.healthy" title="调度尚未连接：只保存定时任务不会自动执行，也不会产生推送日志。请完成下面的一次性设置。" type="warning" :closable="false" show-icon />
    <el-radio-group v-model="method" style="margin-top:14px">
      <el-radio-button value="url">访问 URL（简单）</el-radio-button>
      <el-radio-button value="shell">Shell 脚本</el-radio-button>
    </el-radio-group>
    <template v-if="method === 'url'">
      <p>宝塔 → 计划任务 → 添加任务，类型选「访问 URL」，周期选「每分钟」，粘贴下面的地址并保存。</p>
      <el-input :model-value="cronUrl" readonly aria-label="宝塔计划任务地址" @focus="event => event.target.select()" />
      <p class="hc-muted">地址含专用密钥，请仅粘贴到自己的计划任务中。此方式使用网站当前 PHP，无需填写 PHP 路径。</p>
    </template>
    <template v-else>
      <p>宝塔 → 计划任务 → 添加任务，类型选「Shell 脚本」，周期选「每分钟」，粘贴下面的命令并保存。</p>
      <el-input :model-value="state.command || ''" readonly aria-label="宝塔计划任务命令" @focus="event => event.target.select()" />
      <p class="hc-muted">PHP 路径需与宝塔已安装版本一致，命令行 PHP 也需开启 pdo_mysql、curl、mbstring 等扩展。</p>
    </template>
    <p class="hc-muted">两种方式选一种即可。保存后可在宝塔点一次「执行」，本页每 15 秒检测连接。上次调度：{{ state.lastRun ? formatDateTime(state.lastRun) : '从未运行' }}。</p>
    <p class="hc-muted">服务器时间：{{ formatDateTime(state.now) }} · {{ state.timezone || 'Asia/Shanghai' }}（北京时间）</p>
    <el-alert v-if="state.summary?.time" :type="state.summary.failed ? 'error' : 'info'" :closable="false"
      :title="`最近执行：启用 ${state.summary.enabled} 个，到期 ${state.summary.due} 个，成功 ${state.summary.success} 个，失败 ${state.summary.failed} 个${state.summary.source === 'manual' ? '（后台检查）' : ''}`"
      :description="(state.summary.errors || []).join('；')" />
    <div class="scheduler-check">
      <el-button :loading="checking" @click="check">检查并执行到期任务</el-button>
      <span class="hc-muted">会真实发送当前到期的任务；此操作不能代替宝塔的每分钟调度。</span>
    </div>
  </el-card>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { apiCheckScheduler, apiGetScheduler } from '@/api';
import { formatDateTime } from '@/utils/format';
const state = ref({});
const loading = ref(false);
const checking = ref(false);
const method = ref('url');
const cronUrl = computed(() => state.value.url ? new URL(state.value.url, window.location.href).href : '');
let timer;
async function refresh() {
  if (loading.value) return;
  loading.value = true;
  try { state.value = await apiGetScheduler(); } catch {} finally { loading.value = false; }
}
async function check() {
  checking.value = true;
  try {
    const result = await apiCheckScheduler();
    if (result.skipped) ElMessage.info('调度正在执行，请稍后刷新');
    else if (result.failed) ElMessage.warning('检查完成，有任务执行失败，请查看下方结果与推送日志');
    else ElMessage.success(`检查完成，到期 ${result.due} 个，推送成功 ${result.success} 个`);
    await refresh();
  } catch {} finally { checking.value = false; }
}
onMounted(() => { refresh(); timer = window.setInterval(refresh, 15000); });
onUnmounted(() => window.clearInterval(timer));
</script>

<style scoped>
.scheduler { margin-bottom: 16px; }
.scheduler-header, .scheduler-check { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.scheduler-check { margin-top: 14px; }
.scheduler p { line-height: 1.7; }
</style>
