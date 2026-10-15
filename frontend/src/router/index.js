/**
 * 路由配置：登录页 + 后台管理页面
 * 全局前置守卫统一校验登录态，未登录跳转 /login
 */
import { createRouter, createWebHistory } from 'vue-router';

import { apiSession } from '@/api';
import { authState } from '@/utils/auth';

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { title: '登录', public: true },
  },
  {
    path: '/',
    component: () => import('@/layout/AdminLayout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: '仪表盘', icon: 'Odometer' },
      },
      {
        path: 'config',
        name: 'config',
        component: () => import('@/views/ConfigView.vue'),
        meta: { title: '全局配置', icon: 'Setting' },
      },
      {
        path: 'task',
        name: 'task',
        component: () => import('@/views/TaskView.vue'),
        meta: { title: '定时任务', icon: 'AlarmClock' },
      },
      {
        path: 'anniversary',
        name: 'anniversary',
        component: () => import('@/views/AnniversaryView.vue'),
        meta: { title: '纪念日', icon: 'Star' },
      },
      {
        path: 'todo',
        name: 'todo',
        component: () => import('@/views/TodoView.vue'),
        meta: { title: '待办事项', icon: 'List' },
      },
      {
        path: 'log',
        name: 'log',
        component: () => import('@/views/LogView.vue'),
        meta: { title: '推送日志', icon: 'Document' },
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (to.meta.public) return true;

  if (!authState.checked) {
    try {
      const session = await apiSession();
      authState.checked = true;
      authState.loggedIn = Boolean(session && session.loggedIn);
      authState.username = (session && session.username) || '';
    } catch (err) {
      authState.checked = true;
      authState.loggedIn = false;
    }
  }

  if (!authState.loggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } };
  }
  return true;
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · HeartCron 心时` : 'HeartCron 心时';
});

export default router;
