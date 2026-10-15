<template>
  <el-dialog v-model="visible" title="测试推送结果" width="640px" :close-on-click-modal="false">
    <el-alert
      v-if="result"
      :type="result.success ? 'success' : 'error'"
      :title="result.success ? '推送成功，请查看微信消息' : '推送失败'"
      :description="result.success ? `触发方式：一键测试 · 时间：${result.createTime}` : result.errorMsg"
      show-icon
      :closable="false"
    />

    <div v-if="result" class="hc-result">
      <div class="hc-result__block">
        <div class="hc-result__label">天气信息</div>
        <div class="hc-result__text">{{ result.weatherInfo || '-' }}</div>
      </div>
      <div class="hc-result__block">
        <div class="hc-result__label">推送内容</div>
        <div class="hc-result__content">{{ result.content || '-' }}</div>
      </div>
      <div v-if="result.errorMsg" class="hc-result__block">
        <div class="hc-result__label">错误信息</div>
        <div class="hc-result__text hc-result__text--error">{{ result.errorMsg }}</div>
      </div>
    </div>

    <template #footer>
      <el-button type="primary" @click="visible = false">知道了</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
/**
 * 测试推送结果弹窗：展示天气、AI 文案与推送状态
 */
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  result: { type: Object, default: null },
});

const emit = defineEmits(['update:modelValue']);

const visible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});
</script>

<style scoped>
.hc-result {
  margin-top: 16px;
}

.hc-result__block + .hc-result__block {
  margin-top: 14px;
}

.hc-result__label {
  font-size: 13px;
  color: #909399;
  margin-bottom: 6px;
}

.hc-result__text {
  font-size: 14px;
  color: #303133;
  line-height: 1.7;
}

.hc-result__text--error {
  color: #f56c6c;
}

.hc-result__content {
  padding: 12px 14px;
  background: #f7f8fa;
  border-radius: 8px;
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
