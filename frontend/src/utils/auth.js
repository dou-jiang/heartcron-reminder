/**
 * 登录态与跳转工具（避免 api 与 router 相互引用）
 */
import { reactive } from 'vue';

/** 全局登录态 */
export const authState = reactive({
  checked: false,
  loggedIn: false,
  username: '',
});

/**
 * 未登录时跳转到登录页
 */
export function redirectToLogin() {
  authState.checked = true;
  authState.loggedIn = false;
  if (window.location.pathname !== '/login') {
    window.location.replace('/login');
  }
}
