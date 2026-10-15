<template>
  <div class="hc-page">
    <div class="hc-toolbar">
      <div>
        <div class="hc-toolbar__title">待办事项</div>
        <div class="hc-toolbar__desc">启用的待办会出现在 AI 文案中；开启「仅工作日」后周末自动跳过</div>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon>
        新增待办
      </el-button>
    </div>

    <el-card class="hc-card" shadow="never">
      <el-table v-loading="loading" :data="list" empty-text="暂无待办事项">
        <el-table-column prop="content" label="待办内容" min-width="240" show-overflow-tooltip />
        <el-table-column label="仅工作日" width="110">
          <template #default="{ row }">
            <el-switch :model-value="row.only_workday === 1" @change="(value) => toggleField(row, 'only_workday', value)" />
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

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑待办' : '新增待办'" width="520px" :close-on-click-modal="false">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="待办内容" prop="content">
          <el-input v-model="form.content" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：记得吃维生素、早点睡觉" />
        </el-form-item>
        <el-form-item label="仅工作日">
          <el-switch v-model="form.only_workday" :active-value="1" :inactive-value="0" />
          <span class="hc-muted hc-inline-tip">开启后周六周日不推送该条待办</span>
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
 * 待办事项管理：表格 CRUD + 启用 / 仅工作日开关
 */
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

import { apiCreateTodo, apiDeleteTodo, apiListTodos, apiUpdateTodo } from '@/api';

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const list = ref([]);
const formRef = ref(null);

const form = reactive({ id: null, content: '', enable: 1, only_workday: 0 });

const rules = {
  content: [{ required: true, message: '请输入待办内容', trigger: 'blur' }],
};

/**
 * 拉取列表
 */
async function loadList() {
  loading.value = true;
  try {
    const data = await apiListTodos();
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
    Object.assign(form, { id: row.id, content: row.content, enable: row.enable, only_workday: row.only_workday });
  } else {
    Object.assign(form, { id: null, content: '', enable: 1, only_workday: 0 });
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
  const payload = { content: form.content, enable: form.enable, only_workday: form.only_workday };
  try {
    if (form.id) {
      await apiUpdateTodo(form.id, payload);
      ElMessage.success('待办已更新');
    } else {
      await apiCreateTodo(payload);
      ElMessage.success('待办已创建');
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
    await apiUpdateTodo(row.id, {
      content: row.content,
      enable: field === 'enable' ? (value ? 1 : 0) : row.enable,
      only_workday: field === 'only_workday' ? (value ? 1 : 0) : row.only_workday,
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
    await ElMessageBox.confirm('确定删除该条待办吗？', '删除确认', { type: 'warning' });
  } catch (err) {
    return;
  }
  try {
    await apiDeleteTodo(row.id);
    ElMessage.success('待办已删除');
    loadList();
  } catch (err) {
    // 错误提示已统一处理
  }
}

onMounted(loadList);
</script>

<style scoped>
.hc-inline-tip {
  margin-left: 10px;
}
</style>
