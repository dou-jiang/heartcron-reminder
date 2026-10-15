<template>
  <div class="hc-login">
    <div class="hc-login__panel">
      <div class="hc-login__brand">
        <span class="hc-login__heart">♥</span>
        <h1>HeartCron 心时</h1>
        <p>Cron调度时间，心意准时抵达。</p>
      </div>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="handleSubmit">
        <el-form-item label="账号" prop="username">
          <el-input v-model="form.username" placeholder="请输入后台账号" size="large" clearable>
            <template #prefix><el-icon><User /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入后台密码"
            size="large"
            show-password
            @keyup.enter="handleSubmit"
          >
            <template #prefix><el-icon><Lock /></el-icon></template>
          </el-input>
        </el-form-item>
        <el-button type="primary" size="large" class="hc-login__submit" :loading="loading" @click="handleSubmit">
          登录
        </el-button>
      </el-form>

      <p class="hc-login__tip">账号密码保存在后端 .env 文件中，首次部署请及时修改</p>
    </div>
  </div>
</template>

<script setup>
/**
 * 登录页：账号密码登录表单
 */
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

import { apiLogin } from '@/api';
import { authState } from '@/utils/auth';

const route = useRoute();
const router = useRouter();

const formRef = ref(null);
const loading = ref(false);
const form = reactive({ username: '', password: '' });

const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

/**
 * 提交登录
 */
async function handleSubmit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await apiLogin({ username: form.username, password: form.password });
    authState.checked = true;
    authState.loggedIn = true;
    authState.username = data.username;
    ElMessage.success('登录成功');
    router.replace(route.query.redirect || '/dashboard');
  } catch (err) {
    // 错误提示已由 axios 拦截器统一处理
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.hc-login {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ffe8ee 0%, #f5f7fb 55%, #e8f0ff 100%);
}

.hc-login__panel {
  width: 380px;
  padding: 32px 28px 24px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
}

.hc-login__brand {
  text-align: center;
  margin-bottom: 22px;
}

.hc-login__heart {
  color: var(--hc-primary);
  font-size: 30px;
}

.hc-login__brand h1 {
  font-size: 22px;
  margin: 8px 0 4px;
}

.hc-login__brand p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.hc-login__submit {
  width: 100%;
  margin-top: 6px;
}

.hc-login__tip {
  margin: 18px 0 0;
  font-size: 12px;
  color: #a8abb2;
  text-align: center;
}
</style>
