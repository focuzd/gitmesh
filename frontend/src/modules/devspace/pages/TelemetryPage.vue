<template>
  <div class="telemetry-page devspace-page">
    <div class="page-header">
      <div>
        <h1>Developer Telemetry</h1>
        <p class="subtitle" v-if="activeProjectId && currentProject">
          Real-time metrics for <strong>{{ currentProject.name }}</strong>
        </p>
        <p class="subtitle" v-else>Select a project to view metrics</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="5" animated />
    </div>

    <div v-else-if="!activeProjectId" class="empty-state">
      <el-empty description="Please select a project from the header to view telemetry." />
    </div>

    <div v-else class="dashboard-content">
      <div class="dashboard-grid">
        <el-card class="metric-card">
          <template #header>
            <div class="card-header">
               <span>Velocity (30d)</span>
               <i class="ri-speed-line"></i>
            </div>
          </template>
          <div class="metric-value">{{ metrics.totalPoints || 0 }} pts</div>
          <div class="metric-desc">Total Story Points</div>
        </el-card>

        <el-card class="metric-card">
          <template #header>
            <div class="card-header">
               <span>Throughput (30d)</span>
               <i class="ri-checkbox-circle-line"></i>
            </div>
          </template>
          <div class="metric-value">{{ metrics.totalCompleted || 0 }} issues</div>
          <div class="metric-desc">Completed Issues</div>
        </el-card>

        <el-card class="metric-card">
          <template #header>
            <div class="card-header">
               <span>Active Contributors</span>
               <i class="ri-group-line"></i>
            </div>
          </template>
          <div class="metric-value">{{ contributorCount }}</div>
          <div class="metric-desc">Assigned Members</div>
        </el-card>
      </div>
      
      <div class="charts-section mt-6">
         <el-card>
           <template #header>Top Contributors (Last 30 Days)</template>
           <el-table :data="topContributors" stripe style="width: 100%">
             <el-table-column prop="user.fullName" label="Member" />
             <el-table-column prop="completedCount" label="Issues Done" width="120" />
             <el-table-column prop="storyPoints" label="Points" width="120" />
           </el-table>
         </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import DevtelService from '../services/devtel-api';
import { ElMessage } from 'element-plus';

const store = useStore();
const activeProjectId = computed(() => store.getters['devspace/activeProjectId']);
const currentProject = computed(() => store.getters['devspace/activeProject']);

const loading = ref(false);
const metrics = ref({});
const contributorCount = ref(0);
const topContributors = ref([]);

const fetchData = async () => {
  if (!activeProjectId.value) {
    // Clear metrics when no project is selected
    metrics.value = {};
    topContributors.value = [];
    contributorCount.value = 0;
    return;
  }
  
  console.log('[TelemetryPage] Fetching analytics for project:', activeProjectId.value);
  
  loading.value = true;
  try {
    const analytics = await DevtelService.getTeamAnalytics(activeProjectId.value);
    
    console.log('[TelemetryPage] Received analytics:', analytics);
    
    metrics.value = {
      totalPoints: analytics.totalPoints || 0,
      totalCompleted: analytics.totalCompleted || 0
    };
    
    // Process contributors
    if (analytics.completionsByUser && Array.isArray(analytics.completionsByUser)) {
        topContributors.value = analytics.completionsByUser
            .sort((a, b) => (b.storyPoints || 0) - (a.storyPoints || 0))
            .slice(0, 5);
        contributorCount.value = analytics.completionsByUser.length;
    } else {
        topContributors.value = [];
        contributorCount.value = 0;
    }
    
  } catch (error) {
    console.error('Failed to fetch telemetry:', error);
    
    // Clear data on error
    metrics.value = {};
    topContributors.value = [];
    contributorCount.value = 0;
    
    // Provide more specific error messages
    if (error.response?.status === 404) {
      ElMessage.error('Telemetry service not available. Please check your tenant configuration.');
    } else if (error.message?.includes('tenant context')) {
      ElMessage.error('Please ensure you are logged in and have selected a workspace.');
    } else {
      ElMessage.error('Failed to load telemetry data');
    }
  } finally {
    loading.value = false;
  }
};

watch(activeProjectId, (newVal, oldVal) => {
  console.log('[TelemetryPage] Project changed from', oldVal, 'to', newVal);
  if (newVal) {
    fetchData();
  } else {
    metrics.value = {};
    topContributors.value = [];
    contributorCount.value = 0;
  }
});

onMounted(() => {
  if (activeProjectId.value) {
    fetchData();
  }
});
</script>

<style scoped>
@import '../styles/devspace-common.css';

.telemetry-page {
  padding: 0;
  min-height: 100%;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h1 {
  font-size: 24px;
  margin-bottom: 8px;
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.subtitle {
  color: var(--el-text-color-secondary);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 24px;
}

.metric-card {
  background-color: transparent !important; /* Let the global var handle it or enforce transparency if we want pure black */
  border: 1px solid var(--el-border-color);
  --el-card-bg-color: #000000;
}

.metric-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
  margin: 16px 0 8px;
}

.metric-desc {
    color: var(--el-text-color-secondary);
    font-size: 14px;
}

.mt-6 {
  margin-top: 24px;
}
</style>
