/**
 * 后端接口封装：统一 baseURL、错误提示与 401 跳转
 * 约定后端返回 { success, data, message }
 */
import axios from 'axios';
import { ElMessage } from 'element-plus';

import { authState, redirectToLogin } from '@/utils/auth';

const isPhpSite = Boolean(window.HEARTCRON_PHP);
const http = axios.create({
  baseURL: isPhpSite ? '' : '/api',
  timeout: 120000,
  withCredentials: true,
});

let csrfRequest;
http.interceptors.request.use(async (config) => {
  if (isPhpSite) {
    config.heartcronRoute = config.url;
    config.params = { ...config.params, route: config.url };
    config.url = './api.php';
    if (!['get', 'head', 'options'].includes(String(config.method || 'get').toLowerCase())) {
      if (!authState.csrfToken) {
        csrfRequest ||= axios.get('./api.php', { params: { route: 'session' }, withCredentials: true })
          .then(({ data }) => { authState.csrfToken = data.data.csrfToken; })
          .finally(() => { csrfRequest = null; });
        await csrfRequest;
      }
      config.headers['X-CSRF-Token'] = authState.csrfToken;
    }
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    if (isPhpSite && response.headers['x-csrf-token']) authState.csrfToken = response.headers['x-csrf-token'];
    const payload = response.data;
    if (payload && payload.success === false) {
      const message = payload.message || '请求失败';
      ElMessage.error(message);
      return Promise.reject(new Error(message));
    }
    return payload ? payload.data : null;
  },
  (error) => {
    const status = error.response && error.response.status;
    const message = (error.response && error.response.data && error.response.data.message) || error.message || '网络请求失败';

    if (status === 401 && (error.config.heartcronRoute || error.config.url) !== '/login') {
      redirectToLogin();
      return Promise.reject(new Error(message));
    }
    ElMessage.error(message);
    return Promise.reject(new Error(message));
  }
);

/* ---------------- 登录 ---------------- */
export const apiLogin = (data) => http.post('/login', data);
export const apiLogout = () => http.post('/logout');
export const apiSession = () => http.get('/session');

/* ---------------- 系统配置 ---------------- */
export const apiGetConfig = () => http.get('/config');
export const apiUpdateConfig = (data) => http.put('/config', data);

/* ---------------- 定时任务 ---------------- */
export const apiListTasks = () => http.get('/task');
export const apiCreateTask = (data) => http.post('/task', data);
export const apiUpdateTask = (id, data) => http.put(`/task/${id}`, data);
export const apiDeleteTask = (id) => http.delete(`/task/${id}`);

/* ---------------- 纪念日 ---------------- */
export const apiListAnniversaries = () => http.get('/anniversary');
export const apiCreateAnniversary = (data) => http.post('/anniversary', data);
export const apiUpdateAnniversary = (id, data) => http.put(`/anniversary/${id}`, data);
export const apiDeleteAnniversary = (id) => http.delete(`/anniversary/${id}`);

/* ---------------- 待办事项 ---------------- */
export const apiListTodos = () => http.get('/todo');
export const apiCreateTodo = (data) => http.post('/todo', data);
export const apiUpdateTodo = (id, data) => http.put(`/todo/${id}`, data);
export const apiDeleteTodo = (id) => http.delete(`/todo/${id}`);

/* ---------------- 推送日志与推送 ---------------- */
export const apiListLogs = (params) => http.get('/log', { params });
export const apiGetMeta = () => http.get('/meta');
export const apiGetPreview = () => http.get('/preview');
export const apiTestPush = (data = {}) => http.post('/test-push', data);
