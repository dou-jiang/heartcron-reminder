<template>
  <div class="hc-cron">
    <div class="hc-cron__top">
      <el-input v-model="expression" class="hc-cron__input hc-mono" placeholder="0 30 9 * * *">
        <template #prepend>表达式</template>
      </el-input>
      <el-select v-model="preset" class="hc-cron__preset" placeholder="常用模板" clearable @change="applyPreset">
        <el-option v-for="item in CRON_PRESETS" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
    </div>

    <div class="hc-cron__desc">
      <el-tag :type="valid ? 'success' : 'danger'" effect="plain" size="small">
        {{ valid ? '表达式合法' : '表达式不合法' }}
      </el-tag>
      <span>{{ describeCron(expression) }}</span>
    </div>

    <el-tabs v-model="activeField" class="hc-cron__tabs">
      <el-tab-pane v-for="(field, index) in CRON_FIELDS" :key="field.key" :label="field.label" :name="field.key" :disabled="isPhpSite && field.key === 'second'">
        <el-radio-group v-model="fieldStates[index].mode" size="small" @change="syncFromState">
          <el-radio-button value="every">每{{ field.label }}</el-radio-button>
          <el-radio-button value="specific">指定</el-radio-button>
          <el-radio-button value="range">区间</el-radio-button>
          <el-radio-button value="step">间隔</el-radio-button>
          <el-radio-button v-if="field.key === 'day'" value="last">最后一天</el-radio-button>
        </el-radio-group>

        <div class="hc-cron__editor">
          <template v-if="fieldStates[index].mode === 'every'">
            <span class="hc-muted">每一个{{ field.label }}（通配符 *）</span>
          </template>

          <template v-else-if="fieldStates[index].mode === 'specific'">
            <el-select
              v-model="fieldStates[index].specific"
              multiple
              collapse-tags
              collapse-tags-tooltip
              :placeholder="`请选择${field.label}`"
              class="hc-cron__multi"
              @change="syncFromState"
            >
              <el-option v-for="option in optionsOf(field)" :key="option.value" :label="option.label" :value="option.value" />
            </el-select>
          </template>

          <template v-else-if="fieldStates[index].mode === 'range'">
            <el-input-number v-model="fieldStates[index].from" :min="field.min" :max="field.max" size="small" @change="syncFromState" />
            <span class="hc-muted">至</span>
            <el-input-number v-model="fieldStates[index].to" :min="field.min" :max="field.max" size="small" @change="syncFromState" />
          </template>

          <template v-else-if="fieldStates[index].mode === 'step'">
            <span class="hc-muted">从</span>
            <el-input-number v-model="fieldStates[index].from" :min="field.min" :max="field.max" size="small" @change="syncFromState" />
            <span class="hc-muted">到</span>
            <el-input-number v-model="fieldStates[index].to" :min="field.min" :max="field.max" size="small" @change="syncFromState" />
            <span class="hc-muted">每</span>
            <el-input-number v-model="fieldStates[index].step" :min="1" :max="field.max" size="small" @change="syncFromState" />
            <span class="hc-muted">{{ field.label }}</span>
          </template>

          <template v-else>
            <span class="hc-muted">每月最后一天（L）</span>
          </template>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
/**
 * cron 可视化编辑器（标准 6 位：秒 分 时 日 月 周）
 * 交互参考 vue3-cron：按字段分标签页选择「每 / 指定 / 区间 / 间隔」，顶部实时展示表达式与中文描述
 */
import { computed, ref, watch } from 'vue';

import { CRON_FIELDS, CRON_PRESETS, buildCron, createDefaultFieldStates, describeCron, parseCron, validateCron } from '@/utils/cron';

const props = defineProps({
  modelValue: { type: String, default: '' },
});

const emit = defineEmits(['update:modelValue']);

const isPhpSite = Boolean(window.HEARTCRON_PHP);
const activeField = ref(isPhpSite ? 'minute' : 'second');
const preset = ref('');
const expression = ref(props.modelValue || buildCron(createDefaultFieldStates()));
const fieldStates = ref(parseCron(expression.value) || createDefaultFieldStates());

const valid = computed(() => validateCron(expression.value) && (!isPhpSite || expression.value.trim().split(/\s+/)[0] === '0'));

watch(
  () => props.modelValue,
  (value) => {
    const next = value || '';
    if (next === expression.value) return;
    expression.value = next;
    const states = parseCron(next);
    if (states) fieldStates.value = states;
  }
);

/**
 * 字段可选项（星期使用中文名）
 * @param {Object} field
 * @returns {Array<{label:string, value:number}>}
 */
function optionsOf(field) {
  const list = [];
  for (let value = field.min; value <= field.max; value += 1) {
    list.push({ label: field.names ? field.names[value] : String(value), value });
  }
  return list;
}

/**
 * 由字段状态生成表达式并同步给父组件
 */
function syncFromState() {
  expression.value = buildCron(fieldStates.value);
  emit('update:modelValue', expression.value);
}

/**
 * 选择常用模板
 * @param {string} value
 */
function applyPreset(value) {
  if (!value) return;
  expression.value = value;
  const states = parseCron(value);
  if (states) fieldStates.value = states;
  emit('update:modelValue', value);
}

// 直接编辑表达式时，尽量同步回可视化状态
watch(expression, (value) => {
  const states = parseCron(value);
  if (states) fieldStates.value = states;
  emit('update:modelValue', value);
});
</script>

<style scoped>
.hc-cron__top {
  display: flex;
  gap: 8px;
}

.hc-cron__input {
  flex: 1;
}

.hc-cron__preset {
  width: 150px;
}

.hc-cron__desc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 4px;
  font-size: 13px;
  color: #606266;
}

.hc-cron__editor {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 40px;
  padding-top: 8px;
}

.hc-cron__multi {
  width: 100%;
}
</style>
