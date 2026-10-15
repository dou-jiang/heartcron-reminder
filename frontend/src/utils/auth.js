/**
 * 登录态与跳转工具（避免 api 与 router 相互引用）
 */
import { reactive } from 'vue';

/** 全局登录态 */
export const authState = reactive({
  checked: false,
  loggedIn: false,
  username: '',
  csrfToken: '',
});

/**
 * 未登录时跳转到登录页
 */
export function redirectToLogin() {
  authState.checked = true;
  authState.loggedIn = false;
  authState.csrfToken = '';
  if (window.HEARTCRON_PHP) {
    window.location.hash = '/login';
  } else if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}
