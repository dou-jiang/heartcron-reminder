<template>
  <div class="hc-secret">
    <el-input
      :model-value="inner"
      :type="reveal ? 'text' : 'password'"
      :placeholder="placeholder"
      autocomplete="new-password"
      @update:model-value="handleInput"
      @focus="handleFocus"
      @blur="handleBlur"
    >
      <template #suffix>
        <el-icon class="hc-secret__eye" @click="reveal = !reveal">
          <Hide v-if="reveal" />
          <View v-else />
        </el-icon>
      </template>
    </el-input>
    <div class="hc-secret__hint">
      <template v-if="configured">已配置（掩码展示）。留空表示不修改，输入新值将覆盖原密钥。</template>
      <template v-else>尚未配置，请填入完整密钥。</template>
    </div>
  </div>
</template>

<script setup>
/**
 * 敏感密钥输入框
 * 展示：默认掩码显示；聚焦编辑时清空掩码，输入明文并支持眼睛图标切换显示
 * 提交：未修改时回传掩码值，后端识别掩码后保持原密钥不变
 */
import { ref, watch } from 'vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  configured: { type: Boolean, default: false },
  placeholder: { type: String, default: '请输入密钥' },
});

const emit = defineEmits(['update:modelValue']);

const inner = ref(props.modelValue || '');
const reveal = ref(false);

watch(
  () => props.modelValue,
  (value) => {
    // 外部值变化（例如保存后刷新）时同步，正在编辑则忽略
    if (value !== inner.value && !editing) inner.value = value || '';
  }
);

let editing = false;

/**
 * 聚焦时：若当前是掩码值则清空，方便直接输入新密钥
 */
function handleFocus() {
  editing = true;
  if (String(inner.value || '').includes('****')) {
    inner.value = '';
  }
}

/**
 * 失焦时：未输入内容且原本已配置，则恢复掩码显示
 */
function handleBlur() {
  editing = false;
  if (!inner.value && props.configured) {
    inner.value = props.modelValue || '';
    emit('update:modelValue', inner.value);
  }
}

/**
 * 输入时同步到父组件
 * @param {string} value
 */
function handleInput(value) {
  inner.value = value;
  emit('update:modelValue', value);
}
</script>

<style scoped>
.hc-secret__eye {
  cursor: pointer;
  color: #909399;
}

.hc-secret__hint {
  margin-top: 4px;
  font-size: 12px;
  color: #a8abb2;
  line-height: 1.5;
}
</style>
