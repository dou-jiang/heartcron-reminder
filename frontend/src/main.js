/**
 * 前端入口：注册 Element Plus、图标、路由
 */
import { createApp } from 'vue';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import * as ElementPlusIconsVue from '@element-plus/icons-vue';

import 'element-plus/dist/index.css';
import './styles/index.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);

// 全局注册 Element Plus 图标组件
Object.entries(ElementPlusIconsVue).forEach(([name, component]) => {
  app.component(name, component);
});

app.use(ElementPlus, { locale: zhCn });
app.use(router);
app.mount('#app');
