<template>
  <div class="hc-page">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">定时任务</div>
        <div class="hc-toolbar__desc">
          cron 格式为 秒 分 时 日 月 周。{{ isPhpSite ? '秒位固定为 0，按分钟执行；请先在仪表盘连接宝塔计划任务。' : '任务变更后自动重新加载调度。' }}
        </div>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增任务
      </el-button>
    </div>

    <el-card class="hc-card" shadow="never">
      <el-table v-loading="loading" :data="list" empty-text="暂无定时任务">
        <el-table-column prop="task_name" label="任务名称" min-width="140" />
        <el-table-column prop="push_time_period" label="推送时段" width="110" />
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
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑任务' : '新增任务'" width="700px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="任务名称" prop="task_name">
          <el-input v-model="form.task_name" placeholder="例如：早安提醒" />
        </el-form-item>
        <el-form-item label="推送时段" prop="push_time_period">
          <el-select v-model="form.push_time_period" class="hc-select">
            <el-option v-for="item in periods" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
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
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 定时任务管理：表格 CRUD + cron 可视化选择
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { apiCreateTask, apiDeleteTask, apiGetMeta, apiListTasks, apiUpdateTask } from '@/api';
import { describeCron, validateCron } from '@/utils/cron';
import { formatDateTime } from '@/utils/format';
import CronPicker from '@/components/CronPicker.vue';

const loading = ref(false);
const isPhpSite = Boolean(window.HEARTCRON_PHP);
const saving = ref(false);
const dialogVisible = ref(false);
const list = ref([]);
const periods = ref(['早安', '午间关心', '晚安提醒']);
const formRef = ref(null);

const form = reactive({
  id: null,
  task_name: '',
  cron_expr: '0 30 9 * * *',
  push_time_period: '早安',
  enable: 1,
  remark: '',
});

const rules = {
  task_name: [{ required: true, message: '请输入任务名称', trigger: 'blur' }],
  push_time_period: [{ required: true, message: '请选择推送时段', trigger: 'change' }],
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
    Object.assign(form, { ...row });
  } else {
    Object.assign(form, {
      id: null,
      task_name: '',
      cron_expr: '0 30 9 * * *',
      push_time_period: '早安',
      enable: 1,
      remark: '',
    });
  }
  dialogVisible.value = true;
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

onMounted(async () => {
  loadList();
  try {
    const meta = await apiGetMeta();
    periods.value = meta.pushTimePeriods;
  } catch (err) {
    // 使用默认时段
  }
});
</script>

<style scoped>
.hc-select {
  width: 200px;
}
</style>
