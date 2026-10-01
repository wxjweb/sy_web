<template>
  <div class="page quant-monitor-page" :class="{ 'fish-mode': fishMode }">
    <h1 class="page-title">{{ fishMode ? '任务看板' : '量化盯盘' }}</h1>
    <p class="page-subtitle">
      {{ fishMode ? '工作进度与提醒中心' : '策略化自动盯盘 · 信号记录与复盘' }}
    </p>

    <el-tabs v-model="activeTab" class="page-tabs" @tab-change="onTabChange">
      <el-tab-pane :label="fishMode ? '概览' : '盯盘看板'" name="dashboard">
        <MonitorDashboard ref="dashboardRef" :fish-mode="fishMode" @goto="activeTab = $event" />
      </el-tab-pane>
      <el-tab-pane :label="fishMode ? '规则' : '策略管理'" name="strategies" lazy>
        <MonitorStrategies ref="strategiesRef" :fish-mode="fishMode" />
      </el-tab-pane>
      <el-tab-pane :label="fishMode ? '动态' : '实时监控'" name="live" lazy>
        <MonitorLive ref="liveRef" :fish-mode="fishMode" />
      </el-tab-pane>
      <el-tab-pane :label="fishMode ? '记录' : '信号记录'" name="signals" lazy>
        <MonitorSignals ref="signalsRef" :fish-mode="fishMode" />
      </el-tab-pane>
      <el-tab-pane :label="fishMode ? '验证' : '策略回测'" name="backtest" lazy>
        <MonitorBacktest ref="backtestRef" />
      </el-tab-pane>
      <el-tab-pane :label="fishMode ? '偏好' : '系统设置'" name="settings" lazy>
        <MonitorSettings @fish-change="onFishChange" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getQuantMonitorSettings } from '../api'
import MonitorDashboard from '../components/quant-monitor/MonitorDashboard.vue'
import MonitorStrategies from '../components/quant-monitor/MonitorStrategies.vue'
import MonitorLive from '../components/quant-monitor/MonitorLive.vue'
import MonitorSignals from '../components/quant-monitor/MonitorSignals.vue'
import MonitorBacktest from '../components/quant-monitor/MonitorBacktest.vue'
import MonitorSettings from '../components/quant-monitor/MonitorSettings.vue'

const TABS = new Set(['dashboard', 'strategies', 'live', 'signals', 'backtest', 'settings'])
const route = useRoute()
const router = useRouter()
const activeTab = ref('dashboard')
const fishMode = ref(false)
const dashboardRef = ref(null)
const strategiesRef = ref(null)
const liveRef = ref(null)
const signalsRef = ref(null)
const backtestRef = ref(null)

function syncTabFromRoute() {
  const tab = route.query.tab
  if (typeof tab === 'string' && TABS.has(tab)) {
    activeTab.value = tab
  }
}

async function loadFish() {
  try {
    const { data } = await getQuantMonitorSettings()
    fishMode.value = !!data.fish_mode
    if (data.default_page && TABS.has(data.default_page) && !route.query.tab) {
      activeTab.value = data.default_page
    }
  } catch {
    /* ignore */
  }
}

function onFishChange(v) {
  fishMode.value = !!v
}

onMounted(async () => {
  syncTabFromRoute()
  await loadFish()
})
watch(() => route.query.tab, syncTabFromRoute)

watch(activeTab, (tab) => {
  if (route.query.tab !== tab) {
    router.replace({ query: { ...route.query, tab } })
  }
})

function onTabChange(name) {
  nextTick(() => {
    window.dispatchEvent(new Event('resize'))
    if (name === 'dashboard') dashboardRef.value?.refresh?.()
    if (name === 'strategies') strategiesRef.value?.refresh?.()
    if (name === 'live') liveRef.value?.refresh?.()
    if (name === 'signals') signalsRef.value?.refresh?.()
    if (name === 'backtest') backtestRef.value?.refresh?.()
  })
}
</script>

<style scoped>
.quant-monitor-page {
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

.fish-mode .page-title {
  letter-spacing: 0.02em;
}
</style>
