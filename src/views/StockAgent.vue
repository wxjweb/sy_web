<template>
  <div class="page stock-agent-page">
    <h1 class="page-title">智能体</h1>
    <p class="page-subtitle">股票智能分析与决策助手</p>

    <el-tabs v-model="activeTab" class="page-tabs" @tab-change="onTabChange">
      <el-tab-pane label="问天阁" name="wentiange">
        <Wentiange />
      </el-tab-pane>
      <el-tab-pane label="星舆堂" name="hot" lazy>
        <FinanceHotTopicsPanel />
      </el-tab-pane>
      <el-tab-pane label="观复亭" name="review" lazy>
        <DailyReviewPanel />
      </el-tab-pane>
      <el-tab-pane label="铸金台" name="gold-forge" lazy>
        <GoldForge />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GoldForge from './GoldForge.vue'
import Wentiange from './Wentiange.vue'
import DailyReviewPanel from '../components/DailyReviewPanel.vue'
import FinanceHotTopicsPanel from '../components/FinanceHotTopicsPanel.vue'

const route = useRoute()
const AGENT_TABS = new Set(['gold-forge', 'hot', 'review', 'wentiange'])
const activeTab = ref('wentiange')

onMounted(() => {
  const tab = route.query.tab
  if (typeof tab === 'string' && AGENT_TABS.has(tab)) {
    activeTab.value = tab
  }
})

watch(
  () => route.query.tab,
  (tab) => {
    if (typeof tab === 'string' && AGENT_TABS.has(tab)) {
      activeTab.value = tab
    }
  },
)

function onTabChange() {
  nextTick(() => window.dispatchEvent(new Event('resize')))
}
</script>

<style scoped>
.stock-agent-page {
  padding: 8px 4px 32px;
}

.page-subtitle {
  margin: -8px 0 16px;
  font-size: 13px;
  color: var(--muted);
}

.page-tabs {
  margin-top: 4px;
}

.page-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
}

.page-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.page-tabs :deep(.el-tab-pane) {
  padding: 0;
}
</style>
