<template>
  <el-container class="hc-layout">
    <el-aside width="212px" class="hc-aside">
      <div class="hc-logo">
        <span class="hc-logo__heart">♥</span>
        <div class="hc-logo__text">
          <div class="hc-logo__name">HeartCron 心时</div>
          <div class="hc-logo__slogan">心意准时抵达</div>
        </div>
      </div>
      <el-menu :default-active="activeMenu" router class="hc-menu">
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="hc-header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item :to="{ path: '/dashboard' }">HeartCron</el-breadcrumb-item>
          <el-breadcrumb-item v-if="currentTitle !== '仪表盘'">{{ currentTitle }}</el-breadcrumb-item>
        </el-breadcrumb>

        <el-dropdown @command="handleCommand">
          <span class="hc-user">
            <el-icon><UserFilled /></el-icon>
            {{ authState.username || 'admin' }}
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-header>

      <el-main class="hc-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
/**
 * 后台整体布局：左侧侧边导航 + 顶部面包屑 + 内容区
 */
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';

import { apiLogout } from '@/api';
import { authState } from '@/utils/auth';

const route = useRoute();
const router = useRouter();

/** 侧边菜单项（取自路由配置） */
const menus = [
  { path: '/dashboard', title: '仪表盘', icon: 'Odometer' },
  { path: '/config', title: '全局配置', icon: 'Setting' },
  { path: '/task', title: '定时任务', icon: 'AlarmClock' },
  { path: '/anniversary', title: '纪念日', icon: 'Star' },
  { path: '/todo', title: '待办事项', icon: 'List' },
  { path: '/log', title: '推送日志', icon: 'Document' },
];

const activeMenu = computed(() => route.path);
const currentTitle = computed(() => route.meta.title || '');

/**
 * 顶部用户下拉操作
 * @param {string} command
 */
async function handleCommand(command) {
  if (command !== 'logout') return;
  try {
    await apiLogout();
  } catch (err) {
    // 退出失败也继续清理本地状态
  }
  authState.loggedIn = false;
  authState.checked = true;
  ElMessage.success('已退出登录');
  router.replace('/login');
}
</script>

<style scoped>
.hc-layout {
  height: 100vh;
}

.hc-aside {
  background: #fff;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}

.hc-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px;
  border-bottom: 1px solid #f2f3f5;
}

.hc-logo__heart {
  color: var(--hc-primary);
  font-size: 22px;
}

.hc-logo__name {
  font-size: 15px;
  font-weight: 600;
}

.hc-logo__slogan {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.hc-menu {
  border-right: none;
  flex: 1;
}

.hc-header {
  background: #fff;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hc-user {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #606266;
  outline: none;
}

.hc-main {
  padding: 0;
  overflow-y: auto;
  background: var(--hc-bg);
}
</style>
