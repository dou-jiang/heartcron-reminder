<template>
  <div class="hc-page" v-loading="loading">
    <el-card class="hc-card hc-hero" shadow="never">
      <div class="hc-hero__text">
        <h2>Cron调度时间，心意准时抵达。</h2>
        <p>
          HeartCron 会在设定时间收集天气、纪念日与待办，按你选的内容模式（大模型生成 / 固定模板）生成专属关心文案，
          再通过 WxPusher 推送到微信。
        </p>
      </div>
      <el-button type="primary" :loading="pushing" @click="handleTestPush">
        <el-icon><Promotion /></el-icon>
        一键测试推送
      </el-button>
    </el-card>

    <el-row :gutter="16" class="hc-stats">
      <el-col v-for="item in statCards" :key="item.label" :xs="12" :sm="12" :md="6">
        <el-card class="hc-card hc-stat" shadow="never">
          <div class="hc-stat__label">{{ item.label }}</div>
          <div class="hc-stat__value">{{ item.value }}</div>
          <div class="hc-stat__extra">{{ item.extra }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :xs="24" :md="12">
        <el-card class="hc-card" shadow="never">
          <template #header>
            <div class="hc-card__header">
              <span>今日预览</span>
              <el-button link type="primary" @click="loadPreview">刷新</el-button>
            </div>
          </template>

          <el-descriptions :column="1" border>
            <el-descriptions-item label="今日日期">{{ preview.today_date || '-' }}</el-descriptions-item>
            <el-descriptions-item label="天气信息">{{ preview.weather_info || '-' }}</el-descriptions-item>
            <el-descriptions-item label="纪念日倒计时">{{ preview.anniversary_list || '-' }}</el-descriptions-item>
            <el-descriptions-item label="今日待办">{{ preview.todo_list || '-' }}</el-descriptions-item>
            <el-descriptions-item label="推送时段">{{ preview.push_time_period || '-' }}</el-descriptions-item>
            <el-descriptions-item label="文案风格">{{ preview.style_type || '-' }}</el-descriptions-item>
            <el-descriptions-item label="内容模式">
              {{ preview.push_mode === 'template' ? '固定模板' : 'AI 生成' }}
            </el-descriptions-item>
            <el-descriptions-item v-if="preview.push_mode === 'template'" label="模板预览">
              <pre class="hc-preview-text">{{ preview.preview_content || '-' }}</pre>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>

      <el-col :xs="24" :md="12">
        <el-card class="hc-card" shadow="never">
          <template #header>
            <div class="hc-card__header">
              <span>最近 5 条推送日志</span>
              <el-button link type="primary" @click="router.push('/log')">查看全部</el-button>
            </div>
          </template>

          <el-table :data="preview.recentLogs || []" size="small" empty-text="暂无推送记录">
            <el-table-column prop="create_time" label="时间" width="150" />
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small" effect="plain">
                  {{ row.status === 1 ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="文案">
              <template #default="{ row }">
                <span class="hc-ellipsis" :title="row.ai_content">{{ truncate(row.ai_content, 28) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <PushResultDialog v-model="dialogVisible" :result="pushResult" />
  </div>
</template>

<script setup>
/**
 * 仪表盘：项目标语、今日预览、最近推送日志与一键测试推送
 */
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

import { apiGetPreview, apiTestPush } from '@/api';
import { truncate } from '@/utils/format';
import PushResultDialog from '@/components/PushResultDialog.vue';

const router = useRouter();
const loading = ref(false);
const pushing = ref(false);
const preview = ref({});
const dialogVisible = ref(false);
const pushResult = ref(null);

const statCards = computed(() => {
  const stats = preview.value.stats || {};
  return [
    { label: '启用定时任务', value: `${stats.taskEnabled ?? 0} / ${stats.taskTotal ?? 0}`, extra: '已启用 / 全部' },
    { label: '已注册调度', value: stats.runningJobs ?? 0, extra: '运行中的 cron 任务' },
    { label: '启用纪念日', value: stats.anniversaryEnabled ?? 0, extra: '参与文案生成' },
    { label: '启用待办', value: stats.todoEnabled ?? 0, extra: '参与文案生成' },
  ];
});

/**
 * 加载今日预览数据
 */
async function loadPreview() {
  loading.value = true;
  try {
    preview.value = await apiGetPreview();
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    loading.value = false;
  }
}

/**
 * 一键测试推送：完整执行 天气 → AI → WxPusher
 */
async function handleTestPush() {
  pushing.value = true;
  try {
    pushResult.value = await apiTestPush({});
    dialogVisible.value = true;
    if (pushResult.value.success) ElMessage.success('测试推送成功');
    loadPreview();
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    pushing.value = false;
  }
}

onMounted(loadPreview);
</script>

<style scoped>
.hc-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: linear-gradient(120deg, #fff1f4 0%, #ffffff 60%);
}

.hc-hero :deep(.el-card__body) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
}

.hc-hero__text h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.hc-hero__text p {
  margin: 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.7;
  max-width: 640px;
}

.hc-stats {
  margin: 16px 0;
}

.hc-stat__label {
  font-size: 13px;
  color: #909399;
}

.hc-stat__value {
  font-size: 26px;
  font-weight: 600;
  margin: 6px 0 2px;
}

.hc-stat__extra {
  font-size: 12px;
  color: #a8abb2;
}

.hc-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.hc-preview-text {
  margin: 0;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
