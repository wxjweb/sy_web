<template>
  <div class="page quant-strategy-page">
    <h1 class="page-title">量化策略</h1>
    <p class="page-subtitle">模板沉淀经验，策略实例化运行 · 盯盘配置中心</p>

    <el-tabs v-model="activeTab" class="page-tabs" @tab-change="onTabChange">
      <el-tab-pane label="策略管理" name="manage">
        <StrategyManagePanel ref="manageRef" />
      </el-tab-pane>
      <el-tab-pane label="策略模板" name="templates" lazy>
        <StrategyTemplatePanel ref="templatesRef" @applied="onTemplateApplied" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StrategyManagePanel from '../components/quant-strategy/StrategyManagePanel.vue'
import StrategyTemplatePanel from '../components/quant-strategy/StrategyTemplatePanel.vue'

const TABS = new Set(['manage', 'templates'])
const route = useRoute()
const router = useRouter()
const activeTab = ref('manage')
const manageRef = ref(null)
const templatesRef = ref(null)

function syncTabFromRoute() {
  const tab = route.query.tab
  if (typeof tab === 'string' && TABS.has(tab)) {
    activeTab.value = tab
  }
}

onMounted(syncTabFromRoute)
watch(() => route.query.tab, syncTabFromRoute)

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } })
  }
})

function onTabChange(name) {
  nextTick(() => {
    if (name === 'manage') manageRef.value?.refresh?.()
    if (name === 'templates') templatesRef.value?.refresh?.()
  })
}

function onTemplateApplied() {
  activeTab.value = 'manage'
  nextTick(() => manageRef.value?.refresh?.())
}
</script>

<style scoped>
.quant-strategy-page {
  padding: 8px 4px 32px;
}

.page-subtitle {
  margin: -8px 0 16px;
  font-size: 13px;
  color: var(--muted);
}

.page-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.page-tabs :deep(.el-tabs__content) {
  overflow: visible;
}
</style>
