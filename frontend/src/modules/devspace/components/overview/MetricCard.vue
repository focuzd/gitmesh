<template>
  <el-card class="metric-card" :class="{ compact, warning }">
    <div class="metric-header">
      <span class="metric-title">{{ title }}</span>
      <i :class="icon" class="metric-icon"></i>
    </div>
    <div class="metric-body">
      <div class="metric-value-container">
        <span class="metric-value">{{ formattedValue }}</span>
        <span v-if="unit" class="metric-unit">{{ unit }}</span>
        <span v-if="limit" class="metric-limit">/ {{ limit }}</span>
      </div>
      <div v-if="trend !== undefined && trend !== null" class="metric-trend" :class="trendClass">
        <i :class="trendIcon"></i>
        <span>{{ Math.abs(trend) }}%</span>
      </div>
    </div>
    <div v-if="description" class="metric-description">{{ description }}</div>
  </el-card>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  value: { type: [Number, String], required: true },
  unit: { type: String, default: '' },
  limit: { type: Number, default: null },
  trend: { type: Number, default: null },
  icon: { type: String, required: true },
  description: { type: String, default: '' },
  compact: { type: Boolean, default: false },
  warning: { type: Boolean, default: false },
});

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toFixed(props.value % 1 === 0 ? 0 : 1);
  }
  return props.value;
});

const trendClass = computed(() => {
  if (props.trend > 0) return 'trend-up';
  if (props.trend < 0) return 'trend-down';
  return 'trend-neutral';
});

const trendIcon = computed(() => {
  if (props.trend > 0) return 'ri-arrow-up-line';
  if (props.trend < 0) return 'ri-arrow-down-line';
  return 'ri-subtract-line';
});
</script>

<style scoped>
.metric-card {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  transition: all 0.3s ease;
}

.metric-card:hover {
  border-color: var(--el-color-primary);
  transform: translateY(-2px);
}

.metric-card.warning {
  border-color: var(--el-color-warning);
  background-color: rgba(230, 162, 60, 0.05);
}

.metric-card.compact {
  padding: 12px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.metric-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.metric-icon {
  font-size: 20px;
  color: var(--el-text-color-placeholder);
}

.metric-body {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 8px;
}

.metric-value-container {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  line-height: 1;
}

.compact .metric-value {
  font-size: 24px;
}

.metric-unit {
  font-size: 16px;
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.metric-limit {
  font-size: 16px;
  color: var(--el-text-color-placeholder);
  font-weight: 500;
}

.metric-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}

.trend-up {
  background-color: rgba(103, 194, 58, 0.1);
  color: var(--el-color-success);
}

.trend-down {
  background-color: rgba(245, 108, 108, 0.1);
  color: var(--el-color-danger);
}

.trend-neutral {
  background-color: var(--el-fill-color);
  color: var(--el-text-color-secondary);
}

.metric-description {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
