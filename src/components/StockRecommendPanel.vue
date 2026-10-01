<template>
  <div class="recommend-panel" v-loading="loading">
    <div class="meta-section">
      <div class="glass-card toolbar">
        <div class="toolbar-left">
          <span class="label">推荐数量</span>
          <el-select v-model="limit" style="width: 120px" @change="load">
            <el-option v-for="n in limitOptions" :key="n" :label="`${n} 只`" :value="n" />
          </el-select>
          <el-button type="primary" round :loading="loading" @click="load">
            <el-icon><Refresh /></el-icon>
            刷新推荐
          </el-button>
          <el-radio-group v-model="viewMode" size="small" @change="onViewModeChange">
            <el-radio-button value="cards">卡片</el-radio-button>
            <el-radio-button value="treemap">云图</el-radio-button>
            <el-radio-button value="table">列表</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="data?.updated_at" class="toolbar-right">
          <span class="updated">更新于 {{ data.updated_at }}</span>
        </div>
      </div>

      <el-tabs v-model="activeHorizon" class="horizon-tabs" @tab-change="onHorizonChange">
        <el-tab-pane
          v-for="tab in horizonTabs"
          :key="tab.key"
          :label="`${tab.label} (${tab.count})`"
          :name="tab.key"
        />
      </el-tabs>

      <div v-if="activeMeta" class="glass-card horizon-intro">
        <div class="intro-title">{{ activeMeta.label }}推荐 · {{ activeMeta.subtitle }}</div>
        <div class="intro-focus">关注维度：{{ activeMeta.focus }}</div>
      </div>

      <div v-if="summaryItems.length || hotSectors.length || hotConcepts.length" class="glass-card meta-bar">
        <div v-if="summaryItems.length" class="summary-row">
          <div v-for="item in summaryItems" :key="item.label" class="summary-item">
            <span class="label">{{ item.label }}</span>
            <span class="value" :class="item.cls">{{ item.value }}</span>
          </div>
        </div>
        <div v-if="hotSectors.length" class="sector-row">
          <span class="sector-title">热点行业</span>
          <el-tag
            v-for="s in hotSectors"
            :key="s.name"
            :type="s.change_pct >= 0 ? 'danger' : 'success'"
            effect="plain"
            size="small"
          >
            {{ s.name }} {{ signed(s.change_pct) }}%
          </el-tag>
        </div>
        <div v-if="hotConcepts.length" class="sector-row">
          <span class="sector-title">热门概念</span>
          <el-tag
            v-for="s in hotConcepts"
            :key="s.name"
            type="warning"
            effect="plain"
            size="small"
          >
            {{ s.name }} {{ signed(s.change_pct) }}%
          </el-tag>
        </div>
        <div v-if="dimensions.length" class="dimension-row">
          <span class="sector-title">评分维度</span>
          <el-tag
            v-for="d in dimensions"
            :key="d.name"
            effect="plain"
            size="small"
            class="dim-tag"
          >
            {{ d.name }} · {{ d.sources }}
          </el-tag>
        </div>
      </div>

      <el-alert
        title="短期侧重资金与情绪，中期侧重趋势与板块轮动，长期侧重基本面与赛道质量。仅供参考，不构成投资建议。"
        type="warning"
        :closable="false"
        show-icon
        class="risk-tip"
      />
    </div>

    <div v-if="viewMode === 'cards'" class="glass-card cards-wrap">
      <div v-if="stocks.length" class="stock-grid">
        <button
          v-for="(item, idx) in stocks"
          :key="item.code"
          type="button"
          class="stock-card"
          :class="pctCardClass(item.change_pct)"
          @click="onCardClick(item)"
        >
          <span class="card-rank">{{ idx + 1 }}</span>
          <div class="card-head">
            <span class="card-name" :title="item.name">{{ item.name }}</span>
            <span class="card-code">{{ item.code }}</span>
          </div>
          <div class="card-price-row">
            <span class="card-price">{{ formatPrice(item.price) }}</span>
            <span class="card-pct" :class="pctClass(item.change_pct)">{{ signed(item.change_pct) }}%</span>
          </div>
          <div v-if="activeHorizon !== 'short'" class="card-extra">
            <span v-if="item.change_5d != null">5日 {{ signed(item.change_5d) }}%</span>
            <span v-if="item.change_20d != null">20日 {{ signed(item.change_20d) }}%</span>
          </div>
          <div class="card-footer">
            <span class="card-score">推荐分 {{ item.score }}</span>
            <span v-if="item.sector" class="card-sector" :title="item.sector">{{ item.sector }}</span>
          </div>
          <div v-if="item.signals?.length" class="card-signals">
            <el-tag v-for="sig in item.signals.slice(0, 2)" :key="sig" size="small" effect="plain">{{ sig }}</el-tag>
          </div>
        </button>
      </div>
      <el-empty v-else-if="!loading" description="暂无推荐数据，请稍后刷新" />
    </div>

    <div v-else-if="viewMode === 'treemap'" class="glass-card treemap-wrap">
      <div ref="chartRef" class="treemap-chart" />
      <el-empty v-if="!loading && !stocks.length" class="treemap-empty" description="暂无推荐数据，请稍后刷新" />
    </div>

    <div v-if="viewMode === 'table' && stocks.length" class="glass-card list-card">
      <h3>{{ activeMeta?.label || '' }}推荐列表</h3>
      <el-table :data="stocks" stripe style="width: 100%" max-height="320" @row-click="onRowClick">
        <el-table-column type="index" width="50" />
        <el-table-column prop="name" label="名称" min-width="110" fixed>
          <template #default="{ row }">
            <span class="stock-name">{{ row.name }}</span>
            <span class="stock-code">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="最新" width="80" align="right">
          <template #default="{ row }">{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="change_pct" label="日涨跌" width="88" align="right">
          <template #default="{ row }">
            <span :class="pctClass(row.change_pct)">{{ signed(row.change_pct) }}%</span>
          </template>
        </el-table-column>
        <el-table-column v-if="activeHorizon !== 'short'" prop="change_5d" label="5日" width="80" align="right">
          <template #default="{ row }">
            <span :class="pctClass(row.change_5d)">{{ signed(row.change_5d) }}%</span>
          </template>
        </el-table-column>
        <el-table-column v-if="activeHorizon !== 'short'" prop="change_20d" label="20日" width="80" align="right">
          <template #default="{ row }">
            <span :class="pctClass(row.change_20d)">{{ signed(row.change_20d) }}%</span>
          </template>
        </el-table-column>
        <el-table-column v-if="activeHorizon === 'long'" prop="change_ytd" label="年内" width="80" align="right">
          <template #default="{ row }">
            <span :class="pctClass(row.change_ytd)">{{ signed(row.change_ytd) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="net_inflow" label="主力净流入" width="105" align="right">
          <template #default="{ row }">{{ formatAmount(row.net_inflow) }}</template>
        </el-table-column>
        <el-table-column prop="sector" label="板块" min-width="90" show-overflow-tooltip />
        <el-table-column prop="score" label="推荐分" width="72" align="right" />
        <el-table-column label="信号" min-width="150">
          <template #default="{ row }">
            <el-tag
              v-for="sig in (row.signals || []).slice(0, 3)"
              :key="sig"
              size="small"
              effect="plain"
              class="signal-tag"
            >
              {{ sig }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="推荐理由" min-width="120" show-overflow-tooltip />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts'
import { bulkAddStockWatchlist, getStockRecommendations } from '../api'

const emit = defineEmits(['select-stock'])

const limitOptions = [10, 20, 30, 50, 80, 100]
const limit = ref(30)
const loading = ref(false)
const viewMode = ref('cards')
const activeHorizon = ref('short')
const data = ref(null)
const chartRef = ref(null)
let chart = null
let resizeObserver = null

const horizonTabs = computed(() => {
  const h = data.value?.horizons || {}
  const counts = {
    short: data.value?.short_term?.length ?? 0,
    medium: data.value?.medium_term?.length ?? 0,
    long: data.value?.long_term?.length ?? 0,
  }
  return [
    { key: 'short', label: '短期', count: h.short?.count ?? counts.short },
    { key: 'medium', label: '中期', count: h.medium?.count ?? counts.medium },
    { key: 'long', label: '长期', count: h.long?.count ?? counts.long },
  ]
})

const activeMeta = computed(() => data.value?.horizons?.[activeHorizon.value] || null)

const stocks = computed(() => {
  if (!data.value) return []
  const map = {
    short: data.value.short_term,
    medium: data.value.medium_term,
    long: data.value.long_term,
  }
  return map[activeHorizon.value] || data.value.list || []
})

const hotSectors = computed(() => data.value?.sectors || [])
const hotConcepts = computed(() => data.value?.concepts || [])
const dimensions = computed(() => data.value?.dimensions || [])

const summaryItems = computed(() => {
  const s = data.value?.market_summary
  if (!s) return []
  const items = [
    { label: '上涨', value: `${s.rise_count} 家`, cls: 'up' },
    { label: '下跌', value: `${s.fall_count} 家`, cls: 'down' },
    { label: '涨停', value: `${s.limit_up_count} 家`, cls: 'up' },
    { label: '北向净买', value: `${signed(s.northbound_net)} 亿`, cls: s.northbound_net >= 0 ? 'up' : 'down' },
  ]
  if (s.margin_balance_yi) {
    items.push({ label: '融资余额', value: `${s.margin_balance_yi} 亿`, cls: '' })
  }
  if (s.margin_inflow_yi != null) {
    items.push({
      label: '融资净流入',
      value: `${signed(s.margin_inflow_yi)} 亿`,
      cls: s.margin_inflow_yi >= 0 ? 'up' : 'down',
    })
  }
  for (const idx of s.indices || []) {
    items.push({
      label: idx.name,
      value: `${signed(idx.change_pct)}%`,
      cls: idx.change_pct >= 0 ? 'up' : 'down',
    })
  }
  return items
})

function signed(v) {
  if (v == null) return '-'
  const n = Number(v)
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function formatPrice(v) {
  if (v == null) return '-'
  return Number(v).toFixed(2)
}

function formatAmount(v) {
  if (!v) return '-'
  const n = Number(v)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return String(Math.round(n))
}

function pctClass(v) {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}

function colorForChange(pct) {
  if (pct >= 5) return '#c0392b'
  if (pct >= 2) return '#e74c3c'
  if (pct > 0) return '#e17055'
  if (pct === 0) return '#636e72'
  if (pct > -2) return '#55a87a'
  if (pct > -5) return '#00b894'
  return '#1e8449'
}

function pctCardClass(v) {
  if (v >= 5) return 'hot-up'
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return 'flat'
}

function buildTreemapData(list) {
  return list.map((item) => ({
    name: item.name,
    value: 1,
    code: item.code,
    price: item.price,
    change_pct: item.change_pct,
    net_inflow: item.net_inflow,
    sector: item.sector,
    score: item.score,
    reason: item.reason,
    signals: item.signals,
    itemStyle: { color: colorForChange(item.change_pct), borderColor: '#1a1f2e', borderWidth: 2, gapWidth: 2 },
  }))
}

function resizeChart() {
  if (!chart || !chartRef.value) return
  const { clientWidth, clientHeight } = chartRef.value
  if (clientWidth > 0 && clientHeight > 0) {
    chart.resize({ width: clientWidth, height: clientHeight })
  }
}

function renderChart() {
  if (!chartRef.value || !stocks.value.length) {
    chart?.clear()
    return
  }
  if (!chart) {
    chart = echarts.init(chartRef.value, null, { renderer: 'canvas' })
    chart.on('click', (params) => {
      if (params?.data?.code) {
        emit('select-stock', { code: params.data.code, name: params.data.name })
      }
    })
  }

  chart.setOption({
    backgroundColor: '#0d1117',
    tooltip: {
      backgroundColor: 'rgba(20,24,32,0.95)',
      borderColor: '#333',
      textStyle: { color: '#eee', fontSize: 13 },
      formatter: (p) => {
        const d = p.data
        const lines = [
          `<b>${d.name}</b> (${d.code})`,
          `最新价：${formatPrice(d.price)}`,
          `涨跌幅：${signed(d.change_pct)}%`,
          `主力净流入：${formatAmount(d.net_inflow)}`,
          `板块：${d.sector || '-'}`,
          `推荐分：${d.score}`,
        ]
        if (d.signals?.length) lines.push(`信号：${d.signals.join('、')}`)
        lines.push(`理由：${d.reason || '-'}`)
        return lines.join('<br/>')
      },
    },
    series: [{
      type: 'treemap',
      left: 0, right: 0, top: 0, bottom: 0,
      width: '100%', height: '100%',
      roam: false, nodeClick: false,
      breadcrumb: { show: false },
      squareRatio: 1,
      leafDepth: 1,
      label: {
        show: true,
        overflow: 'break',
        color: '#fff',
        fontSize: 13,
        lineHeight: 18,
        formatter: (params) => {
          const d = params.data
          const rect = params.rect || {}
          const lines = [d.name]
          if (rect.width > 56) lines.push(`${signed(d.change_pct)}%`)
          if (rect.width > 72 && rect.height > 52) lines.push(formatPrice(d.price))
          if (rect.width > 100 && rect.height > 78) lines.push(`分 ${d.score}`)
          return lines.join('\n')
        },
      },
      upperLabel: { show: false },
      itemStyle: { borderColor: '#1a1f2e', gapWidth: 2, borderWidth: 2 },
      levels: [{ itemStyle: { borderWidth: 2, gapWidth: 2 }, label: { fontSize: 13 } }],
      data: buildTreemapData(stocks.value),
    }],
  }, true)

  requestAnimationFrame(() => {
    resizeChart()
    requestAnimationFrame(resizeChart)
  })
}

function onRowClick(row) {
  emit('select-stock', { code: row.code, name: row.name })
}

function onCardClick(item) {
  emit('select-stock', { code: item.code, name: item.name })
}

function onViewModeChange() {
  nextTick(() => {
    if (viewMode.value === 'treemap') {
      bindResizeObserver()
      renderChart()
    }
  })
}

function handleResize() {
  resizeChart()
}

function bindResizeObserver() {
  if (!chartRef.value?.parentElement || resizeObserver) return
  resizeObserver = new ResizeObserver(() => resizeChart())
  resizeObserver.observe(chartRef.value.parentElement)
}

function onHorizonChange() {
  nextTick(() => {
    if (viewMode.value === 'treemap') renderChart()
  })
}

async function load() {
  loading.value = true
  try {
    const { data: res } = await getStockRecommendations(limit.value)
    data.value = res
    const allStocks = [
      ...(res?.short_term || []),
      ...(res?.medium_term || []),
      ...(res?.long_term || []),
    ]
    const seen = new Set()
    const unique = allStocks.filter((s) => {
      if (seen.has(s.code)) return false
      seen.add(s.code)
      return true
    })
    if (unique.length) {
      try {
        await bulkAddStockWatchlist(unique.map((s) => ({ code: s.code, name: s.name, add_source: 'recommend' })))
      } catch {
        /* ignore */
      }
    }
    await nextTick()
    if (viewMode.value === 'treemap') {
      bindResizeObserver()
      renderChart()
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '获取推荐失败')
  } finally {
    loading.value = false
  }
}

watch(stocks, () => {
  if (viewMode.value === 'treemap') nextTick(renderChart)
})
watch(viewMode, onViewModeChange)
watch(activeHorizon, onHorizonChange)

onMounted(() => {
  load()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  chart?.dispose()
  chart = null
})
</script>

<style scoped>
.recommend-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
  padding-bottom: 8px;
  box-sizing: border-box;
}

.meta-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.horizon-tabs {
  margin: 0 4px;
}

.horizon-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.horizon-intro {
  padding: 10px 16px;
}

.intro-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
}

.intro-focus {
  font-size: 13px;
  color: var(--muted);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left .label {
  font-size: 14px;
  color: var(--muted);
}

.updated {
  font-size: 13px;
  color: var(--muted);
}

.meta-bar {
  padding: 10px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.summary-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 2px;
}

.summary-item .value {
  font-size: 15px;
  font-weight: 700;
}

.summary-item .value.up { color: #e74c3c; }
.summary-item .value.down { color: #00b894; }

.sector-row,
.dimension-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.sector-title {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
  margin-right: 4px;
}

.dim-tag {
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.risk-tip { margin: 0; }

.cards-wrap {
  flex: 1;
  min-height: 360px;
  padding: 14px;
  overflow: auto;
}

.stock-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(176px, 1fr));
  gap: 12px;
}

.stock-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 12px 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  cursor: pointer;
  text-align: left;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.stock-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  border-color: rgba(64, 158, 255, 0.35);
}

.stock-card.up { border-top: 3px solid #e74c3c; }
.stock-card.hot-up { border-top: 3px solid #c0392b; background: rgba(231, 76, 60, 0.04); }
.stock-card.down { border-top: 3px solid #00b894; }
.stock-card.flat { border-top: 3px solid #95a5a6; }

.card-rank {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: 11px;
  color: var(--muted);
  font-weight: 700;
}

.card-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-right: 24px;
}

.card-name {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.35;
  word-break: break-all;
}

.card-code {
  font-size: 12px;
  color: var(--muted);
}

.card-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.card-price {
  font-size: 20px;
  font-weight: 800;
  line-height: 1.2;
}

.card-pct {
  font-size: 15px;
  font-weight: 700;
}

.card-extra {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: 12px;
  color: var(--muted);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 12px;
}

.card-score {
  font-weight: 700;
  color: var(--primary);
  flex-shrink: 0;
}

.card-sector {
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 58%;
  text-align: right;
}

.card-signals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.treemap-wrap {
  position: relative;
  flex: 1;
  min-height: 480px;
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.treemap-chart {
  flex: 1;
  width: 100%;
  min-height: 0;
  height: 100%;
}

.treemap-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.6);
}

.list-card {
  flex: 1;
  min-height: 360px;
  padding: 12px 16px 8px;
  overflow: auto;
}

.list-card h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.stock-name { font-weight: 600; margin-right: 8px; }
.stock-code { font-size: 12px; color: var(--muted); }
.signal-tag { margin-right: 4px; margin-bottom: 2px; }
.up { color: #e74c3c; }
.down { color: #00b894; }

:deep(.el-table__row) { cursor: pointer; }
</style>
