<template>
  <div class="cross-edition-example">
    <div v-if="!areDependenciesLoaded()" class="loading">
      Loading dependencies...
    </div>
    
    <div v-else-if="dependencyLoadError" class="error">
      Error loading dependencies: {{ dependencyLoadError.message }}
    </div>
    
    <div v-else class="content">
      <h3>Cross-Edition Component Example</h3>
      
      <!-- Use resolved dependencies -->
      <div class="platform-info">
        <h4>Available Platforms:</h4>
        <ul>
          <li v-for="platform in availablePlatforms" :key="platform.id">
            {{ platform.name }} ({{ platform.id }})
          </li>
        </ul>
      </div>
      
      <div class="features">
        <h4>Available Features:</h4>
        <ul>
          <li>Community Signals: ✅</li>
          <li>Premium Features: {{ hasPremiumFeatures ? '✅' : '❌' }}</li>
          <li>Sentinel Access: {{ hasSentinelFeatures ? '✅' : '❌' }}</li>
        </ul>
      </div>
      
      <!-- Dynamic component loading example -->
      <div class="dynamic-components">
        <h4>Dynamic Components:</h4>
        <component 
          v-if="signalsListComponent" 
          :is="signalsListComponent" 
          :signals="exampleSignals"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { createCrossEditionMixin } from '@/shared/signals/utils/ComponentLoader';

// Define dependencies needed by this component
const dependencyConfig = {
  platformConstants: {
    type: 'constants',
    name: 'platforms',
  },
  signalsService: {
    type: 'service',
  },
  signalsHelpers: {
    type: 'utility',
    name: 'SignalsHelpers',
  },
  signalsFormatters: {
    type: 'utility',
    name: 'SignalsFormatters',
  },
};

// Use the cross-edition mixin
const crossEditionMixin = createCrossEditionMixin(dependencyConfig);

// Component data
const exampleSignals = ref([]);
const signalsListComponent = ref(null);

// Computed properties
const availablePlatforms = computed(() => {
  const platformConstants = getDependency('platformConstants');
  return platformConstants?.platforms || [];
});

// Methods from mixin
const { getDependency, areDependenciesLoaded } = crossEditionMixin.methods;
const { crossEditionDependencies, dependenciesLoaded, dependencyLoadError } = crossEditionMixin.data();

// Component-specific data
const hasPremiumFeatures = ref(false);
const hasSentinelFeatures = ref(false);

// Load dynamic components
onMounted(async () => {
  try {
    // Load signals list component dynamically
    const { loadSignalsComponent } = await import('@/shared/signals/utils/ComponentLoader');
    signalsListComponent.value = await loadSignalsComponent('SignalsList', 'components', 'list')();
    
    // Check for premium features (this would be determined by actual feature flags)
    hasPremiumFeatures.value = false; // Community edition
    hasSentinelFeatures.value = false; // Community edition
    
    // Load some example signals
    const signalsService = getDependency('signalsService');
    if (signalsService) {
      try {
        const response = await signalsService.query({}, null, 5, 0);
        exampleSignals.value = response.rows || [];
      } catch (error) {
        console.warn('Could not load example signals:', error);
      }
    }
  } catch (error) {
    console.error('Error in component setup:', error);
  }
});

// Apply mixin lifecycle
crossEditionMixin.created?.();
</script>

<style scoped>
.cross-edition-example {
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
  margin: 20px 0;
}

.loading, .error {
  text-align: center;
  padding: 20px;
}

.error {
  color: #d32f2f;
  background-color: #ffebee;
  border-radius: 4px;
}

.platform-info, .features, .dynamic-components {
  margin: 20px 0;
}

.platform-info ul, .features ul {
  list-style-type: disc;
  margin-left: 20px;
}

h3 {
  color: #1976d2;
  margin-bottom: 20px;
}

h4 {
  color: #424242;
  margin-bottom: 10px;
}
</style>