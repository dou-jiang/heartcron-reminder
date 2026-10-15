<template>
  <div class="hc-page">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">推送日志</div>
        <div class="hc-toolbar__desc">执行开始即记录日志，显示推送内容与结果；没有记录时请先检查计划任务连接状态</div>
      </div>
      <el-button @click="loadList">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
    </div>

    <el-card class="hc-card" shadow="never">
      <el-table v-loading="loading" :data="list" empty-text="暂无推送记录">
        <el-table-column prop="create_time" label="推送时间" width="170" />
        <el-table-column label="关联任务" width="130">
          <template #default="{ row }">{{ row.task_name || '一键测试' }}</template>
        </el-table-column>
        <el-table-column label="触发方式" width="100">
          <template #default="{ row }">{{ row.source === 'schedule' ? '定时执行' : row.source === 'manual' ? '手动测试' : '-' }}</template>
        </el-table-column>
        <el-table-column label="天气信息" min-width="180">
          <template #default="{ row }">
            <span class="hc-ellipsis" :title="row.weather_info">{{ truncate(row.weather_info, 24) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="推送内容" min-width="240">
          <template #default="{ row }">
            <span class="hc-ellipsis" :title="row.ai_content">{{ truncate(row.ai_content, 34) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : row.status === 2 ? 'warning' : 'danger'" size="small" effect="plain">
              {{ row.status === 1 ? '成功' : row.status === 2 ? '执行中' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="错误信息" min-width="160">
          <template #default="{ row }">
            <span class="hc-ellipsis" :title="row.error_msg">{{ truncate(row.error_msg, 22) || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="hc-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :page-sizes="[10, 20, 50]"
          :total="total"
          layout="total, sizes, prev, pager, next"
          @current-change="loadList"
          @size-change="handleSizeChange"
        />
      </div>
    </el-card>

    <el-dialog v-model="detailVisible" title="推送详情" width="640px">
      <el-descriptions v-if="detail" :column="1" border>
        <el-descriptions-item label="推送时间">{{ detail.create_time }}</el-descriptions-item>
        <el-descriptions-item label="关联任务">{{ detail.task_name || '一键测试推送' }}</el-descriptions-item>
        <el-descriptions-item label="推送状态">
          <el-tag :type="detail.status === 1 ? 'success' : detail.status === 2 ? 'warning' : 'danger'" size="small" effect="plain">
            {{ detail.status === 1 ? '成功' : detail.status === 2 ? '执行中' : '失败' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="天气信息">{{ detail.weather_info || '-' }}</el-descriptions-item>
        <el-descriptions-item label="消息标题">{{ detail.push_title || '-' }}</el-descriptions-item>
        <el-descriptions-item label="推送内容">
          <div class="hc-detail-text">{{ detail.ai_content || '-' }}</div>
        </el-descriptions-item>
        <el-descriptions-item label="错误信息">
          <div class="hc-detail-text hc-detail-text--error">{{ detail.error_msg || '-' }}</div>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button type="primary" @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 推送日志：分页表格 + 详情弹窗
 */
import { onMounted, ref } from 'vue';

import { apiListLogs } from '@/api';
import { truncate } from '@/utils/format';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = ref(10);
const detailVisible = ref(false);
const detail = ref(null);

/**
 * 拉取日志
 */
async function loadList() {
  loading.value = true;
  try {
    const data = await apiListLogs({ page: page.value, size: size.value });
    list.value = data.list;
    total.value = data.total;
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    loading.value = false;
  }
}

/**
 * 每页条数变化时回到第一页
 */
function handleSizeChange() {
  page.value = 1;
  loadList();
}

/**
 * 打开详情弹窗
 * @param {Object} row
 */
function openDetail(row) {
  detail.value = row;
  detailVisible.value = true;
}

onMounted(loadList);
</script>

<style scoped>
.hc-detail-text {
  white-space: pre-wrap;
  line-height: 1.8;
}

.hc-detail-text--error {
  color: #f56c6c;
}
</style>
