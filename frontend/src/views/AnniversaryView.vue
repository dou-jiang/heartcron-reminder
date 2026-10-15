<template>
  <div class="hc-page">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">纪念日</div>
        <div class="hc-toolbar__desc">系统会自动计算倒计时，并在开启「展示倒计时」后融入 AI 文案</div>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增纪念日
      </el-button>
    </div>

    <el-card class="hc-card" shadow="never">
      <el-table v-loading="loading" :data="list" empty-text="暂无纪念日">
        <el-table-column prop="name" label="纪念日名称" min-width="140" />
        <el-table-column prop="target_date" label="日期" width="140" />
        <el-table-column label="距今" width="140">
          <template #default="{ row }">
            <el-tag :type="row.days_left === 0 ? 'success' : 'info'" effect="plain" size="small">
              {{ describeDaysLeft(row.days_left) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="展示倒计时" width="120">
          <template #default="{ row }">
            <el-switch :model-value="row.show_countdown === 1" @change="(value) => toggleField(row, 'show_countdown', value)" />
          </template>
        </el-table-column>
        <el-table-column label="启用" width="90">
          <template #default="{ row }">
            <el-switch :model-value="row.enable === 1" @change="(value) => toggleField(row, 'enable', value)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDialog(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑纪念日' : '新增纪念日'" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="名称" prop="name">
          <el-input v-model="form.name" placeholder="例如：相识纪念日" />
        </el-form-item>
        <el-form-item label="日期" prop="target_date">
          <el-date-picker v-model="form.target_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" class="hc-date" />
        </el-form-item>
        <el-form-item label="展示倒计时">
          <el-switch v-model="form.show_countdown" :active-value="1" :inactive-value="0" />
          <span class="hc-muted hc-inline-tip">开启后倒计时会出现在 AI 文案中</span>
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="form.enable" :active-value="1" :inactive-value="0" />
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
 * 纪念日管理：表格 CRUD + 倒计时 / 启用开关
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { apiCreateAnniversary, apiDeleteAnniversary, apiListAnniversaries, apiUpdateAnniversary } from '@/api';
import { describeDaysLeft } from '@/utils/format';

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const list = ref([]);
const formRef = ref(null);

const form = reactive({ id: null, name: '', target_date: '', enable: 1, show_countdown: 1 });

const rules = {
  name: [{ required: true, message: '请输入纪念日名称', trigger: 'blur' }],
  target_date: [{ required: true, message: '请选择日期', trigger: 'change' }],
};

/**
 * 拉取列表
 */
async function loadList() {
  loading.value = true;
  try {
    const data = await apiListAnniversaries();
    list.value = data.list;
  } catch (err) {
    // 错误提示已统一处理
  } finally {
    loading.value = false;
  }
}

/**
 * 打开弹窗
 * @param {Object} [row]
 */
function openDialog(row) {
  if (row) {
    Object.assign(form, { id: row.id, name: row.name, target_date: row.target_date, enable: row.enable, show_countdown: row.show_countdown });
  } else {
    Object.assign(form, { id: null, name: '', target_date: '', enable: 1, show_countdown: 1 });
  }
  dialogVisible.value = true;
}

/**
 * 保存
 */
async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  saving.value = true;
  const payload = { name: form.name, target_date: form.target_date, enable: form.enable, show_countdown: form.show_countdown };
  try {
    if (form.id) {
      await apiUpdateAnniversary(form.id, payload);
      ElMessage.success('纪念日已更新');
    } else {
      await apiCreateAnniversary(payload);
      ElMessage.success('纪念日已创建');
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
 * 切换开关
 * @param {Object} row
 * @param {string} field
 * @param {boolean} value
 */
async function toggleField(row, field, value) {
  try {
    await apiUpdateAnniversary(row.id, {
      name: row.name,
      target_date: row.target_date,
      enable: field === 'enable' ? (value ? 1 : 0) : row.enable,
      show_countdown: field === 'show_countdown' ? (value ? 1 : 0) : row.show_countdown,
    });
    loadList();
  } catch (err) {
    loadList();
  }
}

/**
 * 删除
 * @param {Object} row
 */
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除纪念日「${row.name}」吗？`, '删除确认', { type: 'warning' });
  } catch (err) {
    return;
  }
  try {
    await apiDeleteAnniversary(row.id);
    ElMessage.success('纪念日已删除');
    loadList();
  } catch (err) {
    // 错误提示已统一处理
  }
}

onMounted(loadList);
</script>

<style scoped>
.hc-date {
  width: 220px;
}

.hc-inline-tip {
  margin-left: 10px;
}
</style>
