<template>
  <el-select 
    v-model="activeProjectId" 
    :key="componentKey"
    placeholder="Select Project" 
    filterable 
    class="project-selector"
    size="default"
  >
    <el-option
      v-for="project in projects"
      :key="project.id"
      :label="project.name"
      :value="project.id"
    />
  </el-select>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';

const store = useStore();

const activeProjectId = computed({
  get: () => store.getters['devspace/activeProjectId'],
  set: (val) => store.dispatch('devspace/setActiveProjectId', val)
});

const projects = computed(() => store.getters['devspace/projects'] || []);

// Compute a key that changes when the active project name changes to force re-render of label
const componentKey = computed(() => {
    const active = projects.value.find(p => p.id === activeProjectId.value);
    return active ? `${active.id}-${active.name}` : 'default';
});

onMounted(() => {
  if (projects.value.length === 0) {
    store.dispatch('devspace/fetchProjects');
  }
});
</script>

<style scoped>
.project-selector {
  width: 200px;
}
</style>
