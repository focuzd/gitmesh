<template>
  <div class="overview-page devspace-page">
    <div class="page-header">
      <div>
        <h1>Project Overview</h1>
        <p class="subtitle" v-if="activeProjectId && currentProject">
          Intelligence dashboard for <strong>{{ currentProject.name }}</strong>
        </p>
        <p class="subtitle" v-else>Select a project to view metrics</p>
      </div>
      <div class="header-actions">
        <el-tooltip
          :content="healthStatus.description"
          placement="bottom"
          effect="dark"
        >
          <el-tag
            :type="healthStatus.type"
            size="large"
            class="health-status-badge"
            effect="dark"
          >
            <i :class="healthStatusIcon"></i>
            <span>{{ healthStatusLabel }}</span>
          </el-tag>
        </el-tooltip>
        <el-select v-model="timeRange" size="default" style="width: 150px">
          <el-option label="Last 7 days" value="7d" />
          <el-option label="Last 30 days" value="30d" />
          <el-option label="Last 90 days" value="90d" />
        </el-select>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <el-skeleton :rows="8" animated />
    </div>

    <div v-else-if="!activeProjectId" class="empty-state">
      <el-empty description="Please select a project from the header to view overview." />
    </div>

    <div v-else class="dashboard-content">
      <!-- Primary Metrics Grid -->
      <div class="metrics-grid primary-metrics">
        <metric-card
          title="Delivery Velocity"
          :value="metrics.velocity"
          unit="pts/week"
          :trend="metrics.velocityTrend"
          icon="ri-speed-line"
          :description="`${metrics.completedIssues} issues completed`"
        />
        <metric-card
          title="Cycle Time"
          :value="metrics.avgCycleTime"
          unit="days"
          :trend="metrics.cycleTimeTrend"
          icon="ri-time-line"
          description="Average time to complete"
        />
        <metric-card
          title="Work in Progress"
          :value="metrics.wipCount"
          :limit="metrics.wipLimit"
          :trend="metrics.wipTrend"
          icon="ri-loader-line"
          :description="`${metrics.wipLimit ? 'Limit: ' + metrics.wipLimit : 'No limit set'}`"
          :warning="metrics.wipCount > metrics.wipLimit"
        />
        <metric-card
          title="Capacity Utilization"
          :value="metrics.capacityUtilization"
          unit="%"
          :trend="metrics.capacityTrend"
          icon="ri-dashboard-3-line"
          :description="`${metrics.allocatedHours}h / ${metrics.totalCapacity}h`"
        />
      </div>

      <!-- Secondary Metrics Row -->
      <div class="metrics-grid secondary-metrics">
        <metric-card
          title="Throughput"
          :value="metrics.throughput"
          unit="issues"
          icon="ri-checkbox-circle-line"
          description="Completed this period"
          compact
        />
        <metric-card
          title="Active Contributors"
          :value="metrics.activeContributors"
          icon="ri-group-line"
          description="Team members working"
          compact
        />
        <metric-card
          title="Aging Issues"
          :value="metrics.agingIssues"
          icon="ri-alarm-warning-line"
          :description="`${metrics.stalledIssues} stalled > 14d`"
          :warning="metrics.agingIssues > 5"
          compact
        />
        <metric-card
          title="Planned vs Actual"
          :value="metrics.plannedVsActual"
          unit="%"
          icon="ri-pie-chart-line"
          :description="`${metrics.completedPlanned}/${metrics.totalPlanned} planned done`"
          compact
        />
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        <el-row :gutter="24">
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>Delivery Trend</span>
                  <el-tag size="small">{{ timeRange }}</el-tag>
                </div>
              </template>
              <delivery-trend-chart :data="charts.deliveryTrend" :loading="loading" />
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>Cycle Time Distribution</span>
                  <el-tag size="small">{{ timeRange }}</el-tag>
                </div>
              </template>
              <cycle-time-distribution-chart :data="charts.cycleTimeDistribution" :loading="loading" />
            </el-card>
          </el-col>
        </el-row>

        <el-row :gutter="24" class="mt-4">
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>Contributor Load Balance</span>
                  <el-tag size="small">Current cycle</el-tag>
                </div>
              </template>
              <contributor-load-chart :data="charts.contributorLoad" :loading="loading" />
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card class="chart-card">
              <template #header>
                <div class="card-header">
                  <span>Issue Aging Analysis</span>
                  <el-tag size="small">Active issues</el-tag>
                </div>
              </template>
              <issue-aging-chart :data="charts.issueAging" :loading="loading" />
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- Insights & Recommendations -->
      <el-card v-if="insights.length > 0" class="insights-card">
        <template #header>
          <div class="card-header">
            <i class="ri-lightbulb-line"></i>
            <span>Insights & Recommendations</span>
          </div>
        </template>
        <div class="insights-list">
          <div v-for="insight in insights" :key="insight.id" class="insight-item" :class="insight.severity">
            <i :class="insight.icon"></i>
            <div class="insight-content">
              <div class="insight-title">{{ insight.title }}</div>
              <div class="insight-description">{{ insight.description }}</div>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useStore } from 'vuex';
import DevtelService from '../services/devtel-api';
import { ElMessage } from 'element-plus';
import MetricCard from '../components/overview/MetricCard.vue';
import DeliveryTrendChart from '../components/overview/DeliveryTrendChart.vue';
import CycleTimeDistributionChart from '../components/overview/CycleTimeDistributionChart.vue';
import ContributorLoadChart from '../components/overview/ContributorLoadChart.vue';
import IssueAgingChart from '../components/overview/IssueAgingChart.vue';

const store = useStore();
const activeProjectId = computed(() => store.getters['devspace/activeProjectId']);
const currentProject = computed(() => store.getters['devspace/activeProject']);

const loading = ref(false);
const timeRange = ref('30d');
const metrics = ref({
  velocity: 0,
  velocityTrend: 0,
  avgCycleTime: 0,
  cycleTimeTrend: 0,
  wipCount: 0,
  wipLimit: 0,
  wipTrend: 0,
  capacityUtilization: 0,
  capacityTrend: 0,
  allocatedHours: 0,
  totalCapacity: 0,
  throughput: 0,
  activeContributors: 0,
  agingIssues: 0,
  stalledIssues: 0,
  plannedVsActual: 0,
  completedPlanned: 0,
  totalPlanned: 0,
  completedIssues: 0,
});

const charts = ref({
  deliveryTrend: [],
  cycleTimeDistribution: [],
  contributorLoad: [],
  issueAging: [],
});

const insights = ref([]);

const healthStatus = computed(() => {
  // Check if we have enough data to assess health
  const hasMinimalData = 
    metrics.value.completedIssues > 0 || 
    metrics.value.wipCount > 0 || 
    metrics.value.activeContributors > 0;
  
  if (!hasMinimalData) {
    return {
      title: 'Project Health: Insufficient Data',
      type: 'info',
      description: 'Not enough project activity to assess health. Start by creating and working on issues.',
    };
  }
  
  const issues = [];
  const warnings = [];
  
  // Critical issues (red flags)
  // Industry benchmark: WIP should not exceed team size * 2
  if (metrics.value.wipCount > metrics.value.wipLimit && metrics.value.wipLimit > 0) {
    issues.push('WIP limit exceeded');
  }
  
  // Industry benchmark: Cycle time > 14 days indicates process problems
  if (metrics.value.avgCycleTime > 14) {
    issues.push('Cycle time too high (>14 days)');
  }
  
  // Industry benchmark: >90% utilization leads to burnout
  if (metrics.value.capacityUtilization > 90) {
    issues.push('Team over capacity (>90%)');
  }
  
  // Industry benchmark: >20% velocity drop is significant
  if (metrics.value.velocityTrend < -20) {
    issues.push('Velocity declining significantly');
  }
  
  // Industry benchmark: >30% of WIP aging is problematic
  if (metrics.value.wipCount > 0 && (metrics.value.agingIssues / metrics.value.wipCount) > 0.3) {
    issues.push('Too many aging issues (>30% of WIP)');
  }
  
  // Industry benchmark: <70% sprint completion indicates planning issues
  if (metrics.value.totalPlanned > 0 && metrics.value.plannedVsActual < 70) {
    issues.push('Low sprint completion rate (<70%)');
  }
  
  // Warnings (yellow flags)
  // Industry benchmark: 5-10 aging issues is a warning sign
  if (metrics.value.agingIssues >= 5 && metrics.value.agingIssues <= 10) {
    warnings.push('Several issues aging');
  }
  
  // Industry benchmark: 70-90% utilization is high but manageable
  if (metrics.value.capacityUtilization >= 70 && metrics.value.capacityUtilization <= 90) {
    warnings.push('High capacity utilization');
  }
  
  // Industry benchmark: Cycle time 7-14 days is acceptable but could improve
  if (metrics.value.avgCycleTime >= 7 && metrics.value.avgCycleTime <= 14) {
    warnings.push('Cycle time could be improved');
  }
  
  // Industry benchmark: <50% utilization indicates underutilization
  if (metrics.value.capacityUtilization < 50 && metrics.value.totalCapacity > 0) {
    warnings.push('Team underutilized (<50%)');
  }
  
  // Determine overall health
  if (issues.length === 0 && warnings.length === 0) {
    return {
      title: 'Project Health: Excellent',
      type: 'success',
      description: 'All metrics are within optimal ranges. Team is performing well.',
    };
  } else if (issues.length === 0 && warnings.length > 0) {
    return {
      title: 'Project Health: Good',
      type: 'success',
      description: warnings.join(', ') + '. Minor improvements possible.',
    };
  } else if (issues.length <= 2) {
    return {
      title: 'Project Health: Needs Attention',
      type: 'warning',
      description: issues.join(', ') + '. Review and address these issues.',
    };
  } else {
    return {
      title: 'Project Health: Critical',
      type: 'error',
      description: issues.join(', ') + '. Immediate action required.',
    };
  }
});

const healthStatusIcon = computed(() => {
  switch (healthStatus.value.type) {
    case 'success':
      return 'ri-checkbox-circle-fill';
    case 'warning':
      return 'ri-error-warning-fill';
    case 'error':
      return 'ri-close-circle-fill';
    case 'info':
    default:
      return 'ri-information-fill';
  }
});

const healthStatusLabel = computed(() => {
  const title = healthStatus.value.title;
  // Extract just the status part (e.g., "Excellent" from "Project Health: Excellent")
  return title.replace('Project Health: ', '');
});

const fetchData = async () => {
  if (!activeProjectId.value) {
    console.log('[Overview] No active project ID');
    return;
  }
  
  console.log('[Overview] Fetching data for project:', activeProjectId.value);
  loading.value = true;
  
  try {
    const days = parseInt(timeRange.value);
    
    // Fetch raw data first (this always works)
    const [issues, cycles] = await Promise.all([
      DevtelService.listIssues(activeProjectId.value, { limit: 1000 }),
      DevtelService.listCycles(activeProjectId.value),
    ]);
    
    console.log('[Overview] Fetched issues:', issues?.length || 0);
    console.log('[Overview] Fetched cycles:', cycles?.length || 0);
    
    // Try to fetch from overview endpoint, fall back to calculating from raw data
    let overview;
    try {
      console.log('[Overview] Attempting to fetch from overview endpoint...');
      overview = await DevtelService.getProjectOverview(activeProjectId.value, { days });
      console.log('[Overview] Successfully fetched from endpoint:', overview);
    } catch (overviewError) {
      console.warn('[Overview] Endpoint not available, calculating from raw data:', overviewError.message);
      
      // Fallback: Calculate metrics from raw data
      let analytics;
      try {
        analytics = await DevtelService.getTeamAnalytics(activeProjectId.value, { projectId: activeProjectId.value });
        console.log('[Overview] Fetched analytics:', analytics);
      } catch (analyticsError) {
        console.warn('[Overview] Analytics not available:', analyticsError.message);
        analytics = { completionsByUser: [], totalCompleted: 0, totalPoints: 0 };
      }
      
      overview = calculateOverviewFromData(issues, cycles, analytics, days);
      console.log('[Overview] Calculated overview from data:', overview);
    }
    
    // Update metrics
    metrics.value = {
      velocity: overview.velocity || 0,
      velocityTrend: overview.velocityTrend || 0,
      avgCycleTime: overview.avgCycleTime || 0,
      cycleTimeTrend: overview.cycleTimeTrend || 0,
      wipCount: overview.wipCount || 0,
      wipLimit: overview.wipLimit || 0,
      wipTrend: overview.wipTrend || 0,
      capacityUtilization: overview.capacityUtilization || 0,
      capacityTrend: overview.capacityTrend || 0,
      allocatedHours: overview.allocatedHours || 0,
      totalCapacity: overview.totalCapacity || 0,
      throughput: overview.throughput || 0,
      activeContributors: overview.activeContributors || 0,
      agingIssues: overview.agingIssues || 0,
      stalledIssues: overview.stalledIssues || 0,
      plannedVsActual: overview.plannedVsActual || 0,
      completedPlanned: overview.completedPlanned || 0,
      totalPlanned: overview.totalPlanned || 0,
      completedIssues: overview.completedIssues || 0,
    };
    
    console.log('[Overview] Updated metrics:', metrics.value);
    
    // Update charts
    charts.value = {
      deliveryTrend: overview.deliveryTrend || [],
      cycleTimeDistribution: overview.cycleTimeDistribution || [],
      contributorLoad: overview.contributorLoad || [],
      issueAging: overview.issueAging || [],
    };
    
    // Generate insights
    insights.value = generateInsights(overview, issues, cycles);
    console.log('[Overview] Generated insights:', insights.value.length);
    
  } catch (error) {
    console.error('[Overview] Failed to fetch overview:', error);
    ElMessage.error('Failed to load project overview: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const calculateOverviewFromData = (issues, cycles, analytics, days) => {
  console.log('[Overview] Calculating from data - issues:', issues?.length, 'cycles:', cycles?.length);
  
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  // Handle both array and object responses
  const issuesArray = Array.isArray(issues) ? issues : (issues?.rows || []);
  const cyclesArray = Array.isArray(cycles) ? cycles : (cycles?.rows || []);
  
  console.log('[Overview] Processed arrays - issues:', issuesArray.length, 'cycles:', cyclesArray.length);
  
  // Filter issues by date range
  const recentIssues = issuesArray.filter(issue => {
    const updatedAt = new Date(issue.updatedAt);
    return updatedAt >= startDate;
  });
  
  console.log('[Overview] Recent issues:', recentIssues.length);
  
  // Calculate completed issues
  const completedIssues = recentIssues.filter(issue => issue.status === 'done');
  const wipIssues = issuesArray.filter(issue => issue.status === 'in_progress');
  
  console.log('[Overview] Completed:', completedIssues.length, 'WIP:', wipIssues.length);
  
  // Calculate velocity (story points per week)
  const totalPoints = completedIssues.reduce((sum, issue) => sum + (issue.storyPoints || 0), 0);
  const weeks = days / 7;
  const velocity = totalPoints / weeks;
  
  // Calculate cycle time
  const issuesWithCycleTime = completedIssues.filter(issue => issue.createdAt && issue.updatedAt);
  const avgCycleTime = issuesWithCycleTime.length > 0
    ? issuesWithCycleTime.reduce((sum, issue) => {
        const cycleTime = (new Date(issue.updatedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24);
        return sum + cycleTime;
      }, 0) / issuesWithCycleTime.length
    : 0;
  
  // Calculate aging issues
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  
  const agingIssues = wipIssues.filter(issue => new Date(issue.updatedAt) < sevenDaysAgo).length;
  const stalledIssues = wipIssues.filter(issue => new Date(issue.updatedAt) < fourteenDaysAgo).length;
  
  // Get active contributors
  const activeContributors = new Set(
    completedIssues.filter(issue => issue.assigneeId).map(issue => issue.assigneeId)
  ).size;
  
  // Calculate planned vs actual from active cycle
  const activeCycle = cyclesArray.find(cycle => cycle.status === 'active');
  let plannedVsActual = 0;
  let completedPlanned = 0;
  let totalPlanned = 0;
  
  if (activeCycle) {
    const cycleIssues = issuesArray.filter(issue => issue.cycleId === activeCycle.id);
    totalPlanned = cycleIssues.length;
    completedPlanned = cycleIssues.filter(issue => issue.status === 'done').length;
    plannedVsActual = totalPlanned > 0 ? (completedPlanned / totalPlanned) * 100 : 0;
  }
  
  // Build cycle time distribution
  const cycleTimeDistribution = [
    { range: '0-2 days', count: 0 },
    { range: '3-5 days', count: 0 },
    { range: '6-10 days', count: 0 },
    { range: '11-20 days', count: 0 },
    { range: '20+ days', count: 0 },
  ];
  
  issuesWithCycleTime.forEach(issue => {
    const cycleTime = (new Date(issue.updatedAt) - new Date(issue.createdAt)) / (1000 * 60 * 60 * 24);
    if (cycleTime <= 2) cycleTimeDistribution[0].count++;
    else if (cycleTime <= 5) cycleTimeDistribution[1].count++;
    else if (cycleTime <= 10) cycleTimeDistribution[2].count++;
    else if (cycleTime <= 20) cycleTimeDistribution[3].count++;
    else cycleTimeDistribution[4].count++;
  });
  
  // Build issue aging distribution
  const issueAging = [
    { range: '0-3 days', count: 0 },
    { range: '4-7 days', count: 0 },
    { range: '8-14 days', count: 0 },
    { range: '14+ days', count: 0 },
  ];
  
  wipIssues.forEach(issue => {
    const age = (now - new Date(issue.updatedAt)) / (1000 * 60 * 60 * 24);
    if (age <= 3) issueAging[0].count++;
    else if (age <= 7) issueAging[1].count++;
    else if (age <= 14) issueAging[2].count++;
    else issueAging[3].count++;
  });
  
  const result = {
    velocity: parseFloat(velocity.toFixed(1)),
    velocityTrend: 0, // Would need historical data
    avgCycleTime: parseFloat(avgCycleTime.toFixed(1)),
    cycleTimeTrend: 0, // Would need historical data
    wipCount: wipIssues.length,
    wipLimit: 0, // Would need project settings
    wipTrend: 0,
    capacityUtilization: 0, // Would need capacity data
    capacityTrend: 0,
    allocatedHours: 0,
    totalCapacity: 0,
    throughput: completedIssues.length,
    activeContributors,
    agingIssues,
    stalledIssues,
    plannedVsActual: parseFloat(plannedVsActual.toFixed(1)),
    completedPlanned,
    totalPlanned,
    completedIssues: completedIssues.length,
    deliveryTrend: [],
    cycleTimeDistribution,
    contributorLoad: [],
    issueAging,
  };
  
  console.log('[Overview] Calculated result:', result);
  return result;
};

const generateInsights = (overview, issues, cycles) => {
  const insights = [];
  
  // Check if we have enough data
  if (overview.completedIssues === 0 && overview.wipCount === 0) {
    insights.push({
      id: 'no-data',
      severity: 'info',
      icon: 'ri-information-line',
      title: 'Getting Started',
      description: 'Create issues and start working on them to see meaningful metrics and insights.',
    });
    return insights;
  }
  
  // Track if we found any issues or warnings
  let hasIssues = false;
  let hasWarnings = false;
  
  // WIP Management (Industry standard: WIP should be limited)
  if (overview.wipCount > overview.wipLimit && overview.wipLimit > 0) {
    hasIssues = true;
    const excess = overview.wipCount - overview.wipLimit;
    insights.push({
      id: 'wip-exceeded',
      severity: 'error',
      icon: 'ri-alert-line',
      title: 'WIP Limit Exceeded',
      description: `Current WIP (${overview.wipCount}) exceeds limit (${overview.wipLimit}) by ${excess} issues. Research shows limiting WIP improves flow efficiency by 25-40%. Focus on completing existing work.`,
    });
  } else if (overview.wipLimit === 0 && overview.wipCount > 0) {
    insights.push({
      id: 'no-wip-limit',
      severity: 'info',
      icon: 'ri-information-line',
      title: 'Set a WIP Limit',
      description: `Consider setting a WIP limit. Industry best practice: 1-2 items per team member. For ${overview.activeContributors} contributors, try ${overview.activeContributors * 2} as a starting point.`,
    });
  }
  
  // Cycle Time Analysis (Industry benchmark: <7 days is excellent, 7-14 acceptable, >14 problematic)
  if (overview.avgCycleTime > 14) {
    hasIssues = true;
    insights.push({
      id: 'high-cycle-time',
      severity: 'error',
      icon: 'ri-time-line',
      title: 'Cycle Time Too High',
      description: `Average cycle time of ${overview.avgCycleTime.toFixed(1)} days exceeds industry benchmark of 14 days. Long cycle times indicate bottlenecks, unclear requirements, or technical debt. Break down large issues.`,
    });
  } else if (overview.avgCycleTime >= 7 && overview.avgCycleTime <= 14) {
    hasWarnings = true;
    insights.push({
      id: 'moderate-cycle-time',
      severity: 'info',
      icon: 'ri-time-line',
      title: 'Cycle Time Acceptable',
      description: `Cycle time of ${overview.avgCycleTime.toFixed(1)} days is within acceptable range (7-14 days). Target <7 days for optimal flow. Consider smaller issue sizes.`,
    });
  } else if (overview.avgCycleTime > 0 && overview.avgCycleTime < 7) {
    insights.push({
      id: 'excellent-cycle-time',
      severity: 'success',
      icon: 'ri-check-line',
      title: 'Excellent Cycle Time',
      description: `Cycle time of ${overview.avgCycleTime.toFixed(1)} days is excellent. Teams with <7 day cycle times deliver 3x faster than industry average. Keep it up!`,
    });
  }
  
  // Aging Issues (Industry benchmark: >30% of WIP aging is problematic)
  if (overview.wipCount > 0) {
    const agingPercentage = (overview.agingIssues / overview.wipCount) * 100;
    if (agingPercentage > 30) {
      hasIssues = true;
      insights.push({
        id: 'aging-issues',
        severity: 'error',
        icon: 'ri-alarm-warning-line',
        title: 'Too Many Aging Issues',
        description: `${overview.agingIssues} of ${overview.wipCount} WIP issues (${agingPercentage.toFixed(0)}%) are aging >7 days. Industry data shows aged issues are 5x more likely to be abandoned. Review blockers immediately.`,
      });
    } else if (agingPercentage > 15) {
      hasWarnings = true;
      insights.push({
        id: 'some-aging-issues',
        severity: 'warning',
        icon: 'ri-time-line',
        title: 'Some Issues Aging',
        description: `${overview.agingIssues} issues aging >7 days (${agingPercentage.toFixed(0)}% of WIP). Check for blockers or unclear requirements.`,
      });
    }
  }
  
  // Velocity Trend Analysis (Industry benchmark: ±20% is normal variance, >20% is significant)
  if (overview.velocityTrend < -20) {
    hasIssues = true;
    insights.push({
      id: 'velocity-declining',
      severity: 'error',
      icon: 'ri-arrow-down-line',
      title: 'Velocity Declining Significantly',
      description: `Velocity dropped ${Math.abs(overview.velocityTrend).toFixed(0)}% vs previous period. Common causes: technical debt (40%), unclear requirements (30%), team changes (20%). Investigate root cause.`,
    });
  } else if (overview.velocityTrend < -10) {
    hasWarnings = true;
    insights.push({
      id: 'velocity-declining-minor',
      severity: 'warning',
      icon: 'ri-arrow-down-line',
      title: 'Velocity Declining',
      description: `Velocity down ${Math.abs(overview.velocityTrend).toFixed(0)}%. Monitor for continued decline. Some variance is normal.`,
    });
  } else if (overview.velocityTrend > 20) {
    insights.push({
      id: 'velocity-improving',
      severity: 'success',
      icon: 'ri-arrow-up-line',
      title: 'Velocity Improving',
      description: `Velocity increased ${overview.velocityTrend.toFixed(0)}% vs previous period. Great momentum! Ensure quality isn't sacrificed for speed.`,
    });
  }
  
  // Capacity Utilization (Industry benchmark: 70-85% is optimal, >90% risks burnout, <50% is underutilized)
  if (overview.capacityUtilization > 90) {
    hasIssues = true;
    insights.push({
      id: 'over-capacity',
      severity: 'error',
      icon: 'ri-alarm-warning-line',
      title: 'Team Over Capacity',
      description: `Team at ${overview.capacityUtilization.toFixed(0)}% capacity. Research shows >90% utilization increases burnout risk by 300% and defect rates by 50%. Reduce load immediately.`,
    });
  } else if (overview.capacityUtilization >= 85 && overview.capacityUtilization <= 90) {
    hasWarnings = true;
    insights.push({
      id: 'high-capacity',
      severity: 'warning',
      icon: 'ri-alert-line',
      title: 'High Capacity Utilization',
      description: `Team at ${overview.capacityUtilization.toFixed(0)}% capacity. Approaching burnout threshold. Leave buffer for unplanned work and learning.`,
    });
  } else if (overview.capacityUtilization < 50 && overview.totalCapacity > 0) {
    insights.push({
      id: 'under-capacity',
      severity: 'info',
      icon: 'ri-information-line',
      title: 'Capacity Available',
      description: `Team at ${overview.capacityUtilization.toFixed(0)}% capacity. Consider pulling in more work from backlog or investing in technical improvements.`,
    });
  } else if (overview.capacityUtilization >= 70 && overview.capacityUtilization < 85) {
    insights.push({
      id: 'optimal-capacity',
      severity: 'success',
      icon: 'ri-check-line',
      title: 'Optimal Capacity',
      description: `Team at ${overview.capacityUtilization.toFixed(0)}% capacity. This is the sweet spot - high productivity with buffer for quality and innovation.`,
    });
  }
  
  // Planning Accuracy (Industry benchmark: 70-85% is good, <70% indicates estimation issues)
  if (overview.totalPlanned > 0) {
    if (overview.plannedVsActual < 70) {
      hasWarnings = true;
      insights.push({
        id: 'planning-accuracy-low',
        severity: 'warning',
        icon: 'ri-pie-chart-line',
        title: 'Low Planning Accuracy',
        description: `Only ${overview.plannedVsActual.toFixed(0)}% of planned work completed. Industry benchmark is 70-85%. Common causes: overcommitment (45%), poor estimation (35%), scope creep (20%). Review planning process.`,
      });
    } else if (overview.plannedVsActual >= 70 && overview.plannedVsActual <= 85) {
      insights.push({
        id: 'planning-accuracy-good',
        severity: 'success',
        icon: 'ri-check-line',
        title: 'Good Planning Accuracy',
        description: `${overview.plannedVsActual.toFixed(0)}% of planned work completed. This is within industry best practice range (70-85%). Predictable delivery builds trust.`,
      });
    } else if (overview.plannedVsActual > 95) {
      insights.push({
        id: 'planning-accuracy-too-high',
        severity: 'info',
        icon: 'ri-information-line',
        title: 'Consider More Ambitious Goals',
        description: `${overview.plannedVsActual.toFixed(0)}% completion suggests conservative planning. Consider taking on slightly more work to optimize throughput.`,
      });
    }
  }
  
  // Throughput Analysis
  if (overview.throughput === 0 && overview.wipCount > 0) {
    hasWarnings = true;
    insights.push({
      id: 'no-throughput',
      severity: 'warning',
      icon: 'ri-alert-line',
      title: 'No Completed Work',
      description: `${overview.wipCount} issues in progress but none completed this period. Focus on finishing work rather than starting new items.`,
    });
  }
  
  // Team Collaboration
  if (overview.activeContributors === 1 && overview.completedIssues > 0) {
    insights.push({
      id: 'single-contributor',
      severity: 'info',
      icon: 'ri-user-line',
      title: 'Single Contributor',
      description: 'Only one active contributor. Consider pair programming or code reviews to reduce knowledge silos and improve quality.',
    });
  }
  
  // If we have data but no issues or warnings, add a positive insight
  if (!hasIssues && !hasWarnings && insights.length === 0 && overview.completedIssues > 0) {
    insights.push({
      id: 'all-healthy',
      severity: 'success',
      icon: 'ri-check-double-line',
      title: 'All Metrics Healthy',
      description: 'All key metrics are within optimal ranges. Team is performing well with good velocity, manageable cycle times, and balanced capacity. Keep up the excellent work!',
    });
  }
  
  return insights;
};

watch([activeProjectId, timeRange], () => {
  if (activeProjectId.value) {
    fetchData();
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

.overview-page {
  padding: 0;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.health-status-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-weight: 600;
  cursor: help;
  transition: all 0.3s ease;
}

.health-status-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.health-status-badge i {
  font-size: 16px;
}

.metrics-grid {
  display: grid;
  gap: 20px;
  margin-bottom: 24px;
}

.primary-metrics {
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.secondary-metrics {
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.charts-section {
  margin-bottom: 24px;
}

.chart-card {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  min-height: 320px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.mt-4 {
  margin-top: 24px;
}

.insights-card {
  background-color: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
}

.insights-card .card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.insights-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border-radius: 6px;
  background-color: var(--el-fill-color-light);
}

.insight-item i {
  font-size: 20px;
  margin-top: 2px;
}

.insight-item.success {
  background-color: rgba(103, 194, 58, 0.1);
  color: var(--el-color-success);
}

.insight-item.warning {
  background-color: rgba(230, 162, 60, 0.1);
  color: var(--el-color-warning);
}

.insight-item.error {
  background-color: rgba(245, 108, 108, 0.1);
  color: var(--el-color-danger);
}

.insight-item.info {
  background-color: rgba(64, 158, 255, 0.1);
  color: var(--el-color-info);
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-weight: 600;
  margin-bottom: 4px;
  color: var(--el-text-color-primary);
}

.insight-description {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
</style>
