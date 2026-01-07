<template>
  <div class="chart-container">
    <div v-if="loading" class="chart-loading">
      <el-skeleton :rows="3" animated />
    </div>
    <div v-else-if="!data || data.length === 0" class="chart-empty">
      <el-empty description="No data available" :image-size="80" />
    </div>
    <canvas v-else ref="chartRef" style="max-height: 250px;"></canvas>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const props = defineProps({
  data: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
});

const chartRef = ref(null);
let chartInstance = null;

const initChart = () => {
  if (!chartRef.value || props.loading || !props.data || props.data.length === 0) return;
  
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  const ctx = chartRef.value.getContext('2d');
  
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: props.data.map(d => d.name),
      datasets: [
        {
          label: 'Assigned',
          data: props.data.map(d => d.assigned),
          backgroundColor: '#409eff',
        },
        {
          label: 'Capacity',
          data: props.data.map(d => d.capacity),
          backgroundColor: '#67c23a',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: '#a1a1aa' },
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderColor: '#3f3f46',
          borderWidth: 1,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#a1a1aa' },
          grid: { color: '#27272a' },
        },
        x: {
          ticks: { color: '#a1a1aa', maxRotation: 30, minRotation: 30 },
          grid: { color: '#27272a' },
        },
      },
    },
  });
};

watch(() => [props.data, props.loading], () => {
  nextTick(() => initChart());
}, { deep: true });

onMounted(() => {
  nextTick(() => initChart());
});

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy();
  }
});
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 250px;
}

.chart-loading,
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 250px;
}
</style>
