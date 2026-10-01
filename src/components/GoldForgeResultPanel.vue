<template>
  <div class="result-panel" v-loading="loading">
    <template v-if="result">
      <el-alert
        v-if="sResonanceAlert"
        title="⏰ 时空共振信号（S级）"
        :description="resonanceDesc"
        type="warning"
        show-icon
        :closable="false"
        class="resonance-alert"
      />

      <div class="glass-card verdict-card" v-if="m8">
        <div class="verdict-head">
          <el-tag size="large" effect="dark" type="danger">{{ m8.rating }}</el-tag>
          <span class="verdict-plan">推荐方案：{{ m8.recommended_plan }}</span>
          <span class="verdict-confidence">置信度 {{ m8.confidence_score }} 分</span>
        </div>
        <p class="verdict-logic">{{ m8.rating_logic }}</p>
        <el-alert v-if="m8.strategy_revision" title="⚠️ 策略修正" type="warning" show-icon :closable="false">
          <ul><li v-for="(r, i) in m8.revision_reasons" :key="i">{{ r }}</li></ul>
        </el-alert>
      </div>

      <div v-if="planCards.length" class="plans-grid">
        <div
          v-for="plan in planCards"
          :key="plan.key"
          class="glass-card plan-card"
          :class="plan.colorClass"
        >
          <h4>{{ plan.label }}</h4>
          <p class="plan-pos">仓位 {{ plan.data.total_position_pct || '—' }}</p>
          <p class="plan-shares">{{ plan.data.total_shares || '—' }}</p>
          <p class="plan-stop">止损 {{ plan.data.stop_loss_price ?? '—' }}</p>
          <el-tag v-if="plan.resonance" size="small" effect="plain">{{ plan.resonance }}</el-tag>
          <p v-if="plan.data.note" class="plan-note">{{ plan.data.note }}</p>
        </div>
      </div>

      <div class="glass-card chart-card">
        <h3 class="section-title">K 线 · 斐波那契网格</h3>
        <div ref="klineChartRef" class="kline-chart" />
      </div>

      <div class="glass-card">
        <h3 class="section-title">模块分析详情</h3>
        <el-collapse v-model="expandedModules">
          <el-collapse-item v-for="m in moduleResultList" :key="m.id" :name="m.id">
            <template #title>
              <span class="mod-title">{{ m.id.toUpperCase() }} · {{ m.title }}</span>
              <el-tag v-if="!m.ok" size="small" type="warning">部分解析失败</el-tag>
            </template>
            <GoldForgeModulePanel
              :module-id="m.id"
              :result="m.result"
              :reasoning="m.reasoning"
            />
          </el-collapse-item>
        </el-collapse>
      </div>

      <div v-if="m8?.watch_list?.length" class="glass-card">
        <h3 class="section-title">跟踪指标清单</h3>
        <el-table :data="m8.watch_list" stripe size="small">
          <el-table-column prop="indicator" label="指标" />
          <el-table-column prop="threshold" label="观察阈值" />
          <el-table-column prop="current_value" label="当前值" />
          <el-table-column prop="status" label="状态" />
        </el-table>
      </div>

      <p v-if="m8?.disclaimer" class="disclaimer">{{ m8.disclaimer }}</p>
    </template>

    <div v-else class="glass-card empty-card">
      <el-empty :description="emptyText" />
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import GoldForgeModulePanel from './GoldForgeModulePanel.vue'

const props = defineProps({
  result: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无分析结果' },
})

const expandedModules = ref(['m8', 'm7', 'm6'])
const klineChartRef = ref(null)
let klineChart = null

const m8 = computed(() => props.result?.modules?.m8?.result)
const sResonanceAlert = computed(() => props.result?.s_resonance_alert)
const resonanceDesc = computed(() => {
  const p = sResonanceAlert.value
  if (!p) return ''
  return `建议在 ${p.entry_grid?.effective_entry_range} 区间关注，仓位 ${p.total_position_pct}`
})

const planCards = computed(() => {
  const plans = props.result?.modules?.m7?.result?.plans || {}
  const map = {
    conservative: { label: '保守型', colorClass: 'plan-green' },
    moderate: { label: '稳健型', colorClass: 'plan-orange' },
    aggressive: { label: '激进型', colorClass: 'plan-red' },
  }
  return Object.entries(plans).map(([key, data]) => ({
    key,
    label: map[key]?.label || key,
    colorClass: map[key]?.colorClass || '',
    data,
    resonance: data.entry_grid?.time_resonance?.resonance_grade,
  }))
})

const moduleResultList = computed(() => {
  const mods = props.result?.modules || {}
  return Object.entries(mods).map(([id, m]) => ({
    id,
    title: m.title || id,
    ok: m.ok !== false,
    reasoning: m.reasoning,
    result: m.result,
  }))
})

function renderKlineChart() {
  const snapshot = props.result?.snapshot
  const klines = snapshot?.klines || []
  const fib = props.result?.modules?.m7?.result?.fibonacci_levels || {}
  if (!klineChartRef.value || !klines.length) {
    klineChart?.clear()
    return
  }

  if (!klineChart) {
    klineChart = echarts.init(klineChartRef.value)
  }

  const dates = klines.map((k) => k.date)
  const closes = klines.map((k) => k.close)
  const markLines = Object.entries(fib).map(([ratio, price]) => ({
    yAxis: price,
    name: `${(Number(ratio) * 100).toFixed(1)}%`,
    lineStyle: { type: 'dashed', color: ratio === '0.618' ? '#f1c40f' : '#95a5a6' },
  }))

  const t = snapshot?.technical || {}
  if (t.support_level) {
    markLines.push({ yAxis: t.support_level, name: '支撑S', lineStyle: { color: '#27ae60' } })
  }
  if (t.resistance_r1) {
    markLines.push({ yAxis: t.resistance_r1, name: '阻力R1', lineStyle: { color: '#e74c3c' } })
  }

  klineChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 20, top: 24, bottom: 28 },
    xAxis: { type: 'category', data: dates, axisLabel: { color: '#8b95a8' } },
    yAxis: { scale: true, axisLabel: { color: '#8b95a8' } },
    series: [{
      type: 'line',
      data: closes,
      smooth: false,
      showSymbol: false,
      lineStyle: { width: 1.5, color: '#409eff' },
      markLine: { symbol: 'none', data: markLines, label: { formatter: '{b}' } },
    }],
  }, true)
  klineChart.resize()
}

function onResize() {
  klineChart?.resize()
}

watch(() => props.result?.snapshot, () => nextTick(() => renderKlineChart()), { immediate: true })

onMounted(() => {
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  klineChart?.dispose()
  klineChart = null
})
</script>

<style scoped>
.result-panel {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title { margin: 0 0 12px; font-size: 16px; }
.resonance-alert { margin-bottom: 0; }
.verdict-card { padding: 16px 20px; }
.verdict-head { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 10px; }
.verdict-plan, .verdict-confidence { font-size: 14px; color: var(--text); }
.verdict-logic { margin: 0; line-height: 1.7; color: var(--text); }
.plans-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
@media (max-width: 900px) { .plans-grid { grid-template-columns: 1fr; } }
.plan-card { padding: 16px; border-top: 3px solid #ccc; }
.plan-green { border-top-color: #27ae60; }
.plan-orange { border-top-color: #e67e22; }
.plan-red { border-top-color: #e74c3c; }
.plan-card h4 { margin: 0 0 8px; }
.plan-pos { font-size: 20px; font-weight: 700; margin: 4px 0; }
.plan-shares, .plan-stop { font-size: 13px; color: var(--muted); margin: 4px 0; }
.plan-note { font-size: 12px; color: #e67e22; margin-top: 8px; }
.chart-card { padding: 16px 20px; }
.kline-chart { height: 320px; width: 100%; }
.mod-title { font-weight: 600; margin-right: 8px; }
:deep(.el-collapse-item__content) { padding-bottom: 16px; }
.disclaimer { font-size: 12px; color: var(--muted); text-align: center; padding: 8px; }
.empty-card { padding: 48px; }
</style>
