<template>
  <div class="page">
    <h1 class="page-title">大盘云图</h1>

    <el-tabs v-model="activeTab" class="page-tabs">
      <el-tab-pane label="大盘云图" name="cloud">
        <div class="tab-panel cloud-panel" v-loading="cloudLoading">
          <div class="glass-card toolbar">
            <div class="toolbar-left">
              <span class="label">板块类型</span>
              <el-radio-group v-model="boardType" size="small" @change="onBoardTypeChange">
                <el-radio-button label="full_a">全A股</el-radio-button>
                <el-radio-button label="industry">行业</el-radio-button>
                <el-radio-button label="concept">概念</el-radio-button>
              </el-radio-group>
              <el-checkbox v-if="boardType === 'full_a'" v-model="showCompanyName">显示公司名称</el-checkbox>
              <el-button type="primary" round :loading="cloudLoading" @click="loadCloud">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
            <span v-if="cloudData?.updated_at" class="updated">更新于 {{ cloudData.updated_at }}</span>
          </div>

          <div v-if="boardType === 'full_a'" class="glass-card legend-bar">
            <span class="legend-label">涨跌幅</span>
            <div class="legend-scale">
              <span class="legend-item c-3">-3%</span>
              <span class="legend-item c-2">-2%</span>
              <span class="legend-item c-1">-1%</span>
              <span class="legend-item c0">0</span>
              <span class="legend-item c1">+1%</span>
              <span class="legend-item c2">+2%</span>
              <span class="legend-item c3">+3%</span>
            </div>
            <span class="legend-hint">面积 = 总市值 · 颜色 = 涨跌幅 · 点击板块可钻取</span>
          </div>

          <div v-if="summaryItems.length" class="glass-card summary-bar">
            <div v-for="item in summaryItems" :key="item.label" class="summary-item">
              <span class="label">{{ item.label }}</span>
              <span class="value" :class="item.cls">{{ item.value }}</span>
            </div>
          </div>

          <div class="glass-card treemap-wrap">
            <div ref="cloudChartRef" class="treemap-chart" />
            <div v-if="hoverInfo && boardType === 'full_a'" class="hover-bar">
              <span>名称 {{ hoverInfo.name }}</span>
              <span v-if="hoverInfo.change_pct != null">涨跌幅 {{ signed(hoverInfo.change_pct) }}%</span>
              <span v-if="hoverInfo.market_cap">总市值 {{ formatNum(hoverInfo.market_cap) }}</span>
            </div>
            <el-empty v-if="!cloudLoading && !hasCloudData" class="treemap-empty" description="暂无板块数据" />
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="股票排行榜" name="rank">
        <div ref="rankPanelRef" class="tab-panel rank-panel" v-loading="rankLoading">
          <div class="glass-card toolbar">
            <div class="toolbar-left">
              <span class="label">市场</span>
              <el-select v-model="rankMarket" style="width: 130px" @change="loadRank">
                <el-option
                  v-for="opt in rankMarkets"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <span class="label">排名数量</span>
              <el-select v-model="rankLimit" style="width: 120px" @change="loadRank">
                <el-option v-for="n in rankLimits" :key="n" :label="`${n} 只`" :value="n" />
              </el-select>
              <el-checkbox v-model="rankIncludeSt" @change="loadRank">查看ST股</el-checkbox>
              <el-button type="primary" round :loading="rankLoading" @click="loadRank">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
            <span v-if="rankData?.updated_at" class="updated">更新于 {{ rankData.updated_at }}</span>
          </div>

          <div class="glass-card rank-card">
            <el-table
              :data="rankItems"
              stripe
              height="100%"
              style="width: 100%"
              :default-sort="{ prop: 'change_pct', order: 'descending' }"
              @sort-change="onRankSortChange"
              @row-click="onRowClick"
            >
              <el-table-column prop="rank" label="排名" width="64" align="center" fixed />
              <el-table-column prop="name" label="名称" min-width="110" fixed>
                <template #default="{ row }">
                  <div class="dual-cell name-cell">
                    <div class="stock-name">{{ row.name }}</div>
                    <div class="sub stock-code">{{ row.code }}</div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="market_cap" label="总市值" width="110" align="right" sortable="custom">
                <template #default="{ row }">{{ formatNum(row.market_cap) }}</template>
              </el-table-column>
              <el-table-column prop="float_market_cap" label="流通市值" width="110" align="right" sortable="custom">
                <template #default="{ row }">{{ formatNum(row.float_market_cap) }}</template>
              </el-table-column>
              <el-table-column prop="price" label="最新价" width="90" align="right" sortable="custom">
                <template #default="{ row }">{{ formatPrice(row.price) }}</template>
              </el-table-column>
              <el-table-column prop="change_amount" label="涨跌额" width="90" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_amount)">{{ signed(row.change_amount) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_pct" label="今日涨幅" width="96" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_pct)">{{ signed(row.change_pct) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_5d" label="5日涨幅" width="92" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_5d)">{{ signed(row.change_5d) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_10d" label="10日涨幅" width="96" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_10d)">{{ signed(row.change_10d) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_20d" label="20日涨幅" width="96" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_20d)">{{ signed(row.change_20d) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_60d" label="60日涨幅" width="96" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_60d)">{{ signed(row.change_60d) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_ytd" label="今年以来" width="96" align="right" sortable="custom">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_ytd)">{{ signed(row.change_ytd) }}%</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_1y" label="最近1年" width="96" align="right">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_1y)">{{ formatSignedPct(row.change_1y) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_3y" label="最近3年" width="96" align="right">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_3y)">{{ formatSignedPct(row.change_3y) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_5y" label="最近5年" width="96" align="right">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_5y)">{{ formatSignedPct(row.change_5y) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="change_10y" label="最近10年" width="100" align="right">
                <template #default="{ row }">
                  <span :class="pctClass(row.change_10y)">{{ formatSignedPct(row.change_10y) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="stockActionVisible"
      title="选择操作"
      width="420px"
      align-center
      :close-on-click-modal="true"
    >
      <p v-if="pendingStock" class="stock-action-tip">
        已选择：<strong>{{ pendingStock.name }}</strong>（{{ pendingStock.code }}）
      </p>
      <p class="stock-action-desc">请选择要进行的操作</p>
      <div class="stock-action-btns">
        <el-button type="primary" round size="large" @click="goStockResearch">
          <el-icon><Search /></el-icon>
          个股研究
        </el-button>
        <el-button type="success" round size="large" @click="goQuantBacktest">
          <el-icon><VideoPlay /></el-icon>
          量化回测
        </el-button>
      </div>
    </el-dialog>

    <Teleport to="body">
      <Transition name="fade">
        <button
          v-show="showBackTop"
          type="button"
          class="back-top-btn"
          aria-label="回到顶部"
          @click="scrollToTop"
        >
          <el-icon :size="18"><Top /></el-icon>
          <span>回到顶部</span>
        </button>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Search, Top, VideoPlay } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { getMarketCloudMap, getMarketGainers } from '../api'

const router = useRouter()
const activeTab = ref('cloud')
const boardType = ref('full_a')
const showCompanyName = ref(true)
const hoverInfo = ref(null)
const cloudLoading = ref(false)
const rankLoading = ref(false)
const cloudData = ref(null)
const rankData = ref(null)
const rankLimit = ref(50)
const rankMarket = ref('all')
const rankIncludeSt = ref(false)
const rankSort = ref('change_pct')
const rankOrder = ref('desc')
const rankLimits = [50, 100, 150, 200, 300]
const rankMarkets = [
  { label: '全部A股', value: 'all' },
  { label: '沪深主板', value: 'hs_main' },
  { label: '上海A股', value: 'sh' },
  { label: '深圳A股', value: 'sz' },
  { label: '北京A股', value: 'bj' },
  { label: '创业板', value: 'cyb' },
  { label: '科创板', value: 'kcb' },
]
const RANK_SERVER_SORTS = new Set([
  'price',
  'change_pct',
  'change_amount',
  'market_cap',
  'float_market_cap',
  'change_5d',
  'change_10d',
  'change_20d',
  'change_60d',
  'change_ytd',
])
const rankPanelRef = ref(null)
const showBackTop = ref(false)
const stockActionVisible = ref(false)
const pendingStock = ref(null)
const cloudChartRef = ref(null)
let cloudChart = null
let resizeObserver = null

const BACKTOP_VISIBLE = 300
let scrollTargets = []

function getRankTableScrollEl() {
  if (!rankPanelRef.value) return null
  return (
    rankPanelRef.value.querySelector('.el-table__body-wrapper .el-scrollbar__wrap')
    || rankPanelRef.value.querySelector('.el-table__body-wrapper')
  )
}

function getScrollContainers() {
  const containers = []
  const main = document.querySelector('.layout .el-main.main') || document.querySelector('.layout .el-main')
  if (main) containers.push(main)
  if (rankPanelRef.value) containers.push(rankPanelRef.value)
  const tableScroll = getRankTableScrollEl()
  if (tableScroll) containers.push(tableScroll)
  return containers
}

function updateBackTopVisible() {
  const tops = getScrollContainers().map((el) => el.scrollTop || 0)
  tops.push(window.scrollY || document.documentElement.scrollTop || 0)
  showBackTop.value = Math.max(...tops, 0) >= BACKTOP_VISIBLE
}

function scrollToTop() {
  const tableScroll = getRankTableScrollEl()
  if (tableScroll?.scrollTop) {
    tableScroll.scrollTo({ top: 0, behavior: 'smooth' })
  }
  if (rankPanelRef.value?.scrollTop) {
    rankPanelRef.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const main = document.querySelector('.layout .el-main.main') || document.querySelector('.layout .el-main')
  if (main?.scrollTop) {
    main.scrollTo({ top: 0, behavior: 'smooth' })
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function bindScrollListeners() {
  unbindScrollListeners()
  scrollTargets = getScrollContainers()
  for (const target of scrollTargets) {
    target.addEventListener('scroll', updateBackTopVisible, { passive: true })
  }
}

function unbindScrollListeners() {
  for (const target of scrollTargets) {
    target.removeEventListener('scroll', updateBackTopVisible)
  }
  scrollTargets = []
}

const cloudItems = computed(() => cloudData.value?.list || [])
const cloudTree = computed(() => cloudData.value?.tree || null)
const rankItems = computed(() => rankData.value?.list || [])
const hasCloudData = computed(() => (
  boardType.value === 'full_a'
    ? (cloudTree.value?.children?.length > 0)
    : cloudItems.value.length > 0
))

const summaryItems = computed(() => {
  const s = cloudData.value?.market_summary
  if (!s) return []
  const items = [
    { label: '上涨', value: `${s.rise_count} 家`, cls: 'up' },
    { label: '下跌', value: `${s.fall_count} 家`, cls: 'down' },
    { label: '涨停', value: `${s.limit_up_count} 家`, cls: 'up' },
    { label: '跌停', value: `${s.limit_down_count} 家`, cls: 'down' },
    { label: '北向净买', value: `${signed(s.northbound_net)} 亿`, cls: s.northbound_net >= 0 ? 'up' : 'down' },
  ]
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
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function formatSignedPct(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${signed(n)}%`
}

function formatPrice(v) {
  if (v == null) return '-'
  return Number(v).toFixed(2)
}

function formatNum(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return String(Math.round(n))
}

function formatPct(v) {
  if (v == null || v === '') return '-'
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${n.toFixed(2)}%`
}

function pctClass(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  if (n > 0) return 'up'
  if (n < 0) return 'down'
  return ''
}

function colorForChange(pct) {
  if (pct >= 3) return '#ff2d2d'
  if (pct >= 2) return '#e74c3c'
  if (pct >= 1) return '#e17055'
  if (pct > 0) return '#d35400'
  if (pct === 0) return '#7f8c8d'
  if (pct > -1) return '#55a87a'
  if (pct > -2) return '#00b894'
  if (pct > -3) return '#1e8449'
  return '#0b5345'
}

function decorateTree(node) {
  if (!node) return null
  const copy = {
    ...node,
    itemStyle: {
      color: colorForChange(node.change_pct || 0),
      borderColor: '#0d1117',
      borderWidth: 1,
      gapWidth: 1,
    },
  }
  if (node.children?.length) {
    copy.children = node.children.map(decorateTree).filter(Boolean)
  }
  return copy
}

function resizeCloudChart() {
  if (!cloudChart || !cloudChartRef.value) return
  const { clientWidth, clientHeight } = cloudChartRef.value
  if (clientWidth > 0 && clientHeight > 0) {
    cloudChart.resize({ width: clientWidth, height: clientHeight })
  }
}

function ensureChart() {
  if (!cloudChart && cloudChartRef.value) {
    cloudChart = echarts.init(cloudChartRef.value, null, { renderer: 'canvas' })
    cloudChart.on('click', (params) => {
      const d = params?.data
      if (d?.node_type === 'stock' && d?.code) {
        router.push({ path: '/stocks/research', query: { q: d.code } })
      }
    })
    cloudChart.on('mouseover', (params) => {
      if (params?.data) hoverInfo.value = params.data
    })
    cloudChart.on('mouseout', () => {
      hoverInfo.value = null
    })
  }
}

function treemapLabelFormatter(params) {
  const d = params.data || {}
  if (!showCompanyName.value && d.node_type === 'stock') {
    return (params.rect?.width || 0) > 36 ? `${signed(d.change_pct)}%` : ''
  }
  const lines = [d.name]
  if (d.change_pct != null && d.node_type !== 'root') {
    lines.push(`${signed(d.change_pct)}%`)
  }
  return lines.join('\n')
}

function renderFullATree() {
  if (!cloudChartRef.value || !cloudTree.value?.children?.length) {
    cloudChart?.clear()
    return
  }
  ensureChart()
  const root = decorateTree(cloudTree.value)

  cloudChart.setOption({
    backgroundColor: '#0d1117',
    tooltip: {
      backgroundColor: 'rgba(20,24,32,0.95)',
      borderColor: '#333',
      textStyle: { color: '#eee' },
      formatter: (p) => {
        const d = p.data || {}
        const lines = [`<b>${d.name}</b>`]
        if (d.change_pct != null) lines.push(`涨跌幅：${signed(d.change_pct)}%`)
        if (d.market_cap) lines.push(`总市值：${formatNum(d.market_cap)}`)
        if (d.price) lines.push(`最新价：${formatPrice(d.price)}`)
        if (d.code && d.node_type === 'stock') lines.push(`代码：${d.code}`)
        return lines.join('<br/>')
      },
    },
    series: [{
      type: 'treemap',
      left: 0,
      right: 0,
      top: 30,
      bottom: 6,
      width: '100%',
      height: '100%',
      roam: false,
      nodeClick: 'zoomToNode',
      breadcrumb: {
        show: true,
        top: 4,
        left: 8,
        height: 22,
        itemStyle: { color: '#333', borderColor: '#555', textStyle: { color: '#ddd' } },
        emphasis: { itemStyle: { color: '#444' } },
      },
      squareRatio: 0.5,
      leafDepth: 1,
      label: {
        show: true,
        color: '#fff',
        fontSize: 11,
        overflow: 'truncate',
        formatter: treemapLabelFormatter,
      },
      upperLabel: {
        show: true,
        color: '#fff',
        fontWeight: 'bold',
        height: 22,
      },
      itemStyle: { borderColor: '#0d1117', gapWidth: 1 },
      levels: [
        { itemStyle: { borderWidth: 2, gapWidth: 2 }, upperLabel: { show: true } },
        { itemStyle: { borderWidth: 2, gapWidth: 2 }, upperLabel: { show: true } },
        { itemStyle: { borderWidth: 1, gapWidth: 1 }, upperLabel: { show: true, height: 18 } },
        { itemStyle: { borderWidth: 1, gapWidth: 1 }, label: { fontSize: 11 } },
      ],
      data: [root],
    }],
  }, true)

  requestAnimationFrame(() => {
    resizeCloudChart()
    requestAnimationFrame(resizeCloudChart)
  })
}

function renderCloudChart() {
  if (boardType.value === 'full_a') {
    renderFullATree()
    return
  }
  if (!cloudChartRef.value || !cloudItems.value.length) {
    cloudChart?.clear()
    return
  }
  ensureChart()

  const data = cloudItems.value.map((item) => ({
    name: item.name,
    value: Math.max(item.weight, 1),
    code: item.code,
    change_pct: item.change_pct,
    amount: item.amount,
    net_inflow: item.net_inflow,
    itemStyle: { color: colorForChange(item.change_pct), borderColor: '#0d1117', borderWidth: 1 },
  }))

  cloudChart.setOption({
    backgroundColor: '#0d1117',
    tooltip: {
      backgroundColor: 'rgba(20,24,32,0.95)',
      borderColor: '#333',
      textStyle: { color: '#eee' },
      formatter: (p) => {
        const d = p.data
        return [
          `<b>${d.name}</b>`,
          `涨跌幅：${signed(d.change_pct)}%`,
          `成交额：${formatNum(d.amount)}`,
          `主力净流入：${formatNum(d.net_inflow)}`,
        ].join('<br/>')
      },
    },
    series: [{
      type: 'treemap',
      left: 0, right: 0, top: 0, bottom: 0,
      width: '100%', height: '100%',
      roam: false, nodeClick: false,
      breadcrumb: { show: false },
      squareRatio: 0.5,
      leafDepth: 1,
      label: {
        show: true,
        color: '#fff',
        fontSize: 12,
        formatter: (params) => {
          const d = params.data
          const lines = [d.name, `${signed(d.change_pct)}%`]
          if ((params.rect?.width || 0) > 80) lines.push(`成交 ${formatNum(d.amount)}`)
          return lines.join('\n')
        },
      },
      itemStyle: { borderColor: '#0d1117', gapWidth: 1 },
      data,
    }],
  }, true)

  requestAnimationFrame(() => {
    resizeCloudChart()
    requestAnimationFrame(resizeCloudChart)
  })
}

function bindResizeObserver() {
  if (!cloudChartRef.value?.parentElement || resizeObserver) return
  resizeObserver = new ResizeObserver(() => resizeCloudChart())
  resizeObserver.observe(cloudChartRef.value.parentElement)
}

async function loadCloud(sector = '') {
  cloudLoading.value = true
  try {
    const { data } = await getMarketCloudMap(boardType.value, sector)
    cloudData.value = data
    await nextTick()
    bindResizeObserver()
    renderCloudChart()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '获取大盘云图失败')
  } finally {
    cloudLoading.value = false
  }
}

function onBoardTypeChange() {
  hoverInfo.value = null
  loadCloud()
}

watch(showCompanyName, () => nextTick(renderCloudChart))

async function loadRank() {
  rankLoading.value = true
  try {
    const { data } = await getMarketGainers({
      limit: rankLimit.value,
      order: rankOrder.value,
      sort: rankSort.value,
      market: rankMarket.value,
      include_st: rankIncludeSt.value,
    })
    rankData.value = data
    await nextTick()
    bindScrollListeners()
    updateBackTopVisible()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '获取股票排行榜失败')
  } finally {
    rankLoading.value = false
  }
}

function onRankSortChange({ prop, order }) {
  let nextSort = 'change_pct'
  let nextOrder = 'desc'
  if (prop && order && RANK_SERVER_SORTS.has(prop)) {
    nextSort = prop
    nextOrder = order === 'ascending' ? 'asc' : 'desc'
  }
  // 与当前一致时跳过（避免 default-sort 初始化重复请求）
  if (nextSort === rankSort.value && nextOrder === rankOrder.value) return
  rankSort.value = nextSort
  rankOrder.value = nextOrder
  loadRank()
}

function onRowClick(row) {
  if (!row?.code) return
  pendingStock.value = {
    code: row.code,
    name: row.name || row.code,
  }
  stockActionVisible.value = true
}

function goStockResearch() {
  const stock = pendingStock.value
  if (!stock) return
  stockActionVisible.value = false
  router.push({ path: '/stocks/research', query: { q: stock.code } })
}

function goQuantBacktest() {
  const stock = pendingStock.value
  if (!stock) return
  stockActionVisible.value = false
  router.push({ path: '/stocks/quant/backtest', query: { code: stock.code } })
}

function handleResize() {
  resizeCloudChart()
}

watch(activeTab, (tab) => {
  if (tab === 'cloud') {
    nextTick(() => {
      bindResizeObserver()
      renderCloudChart()
      resizeCloudChart()
    })
  } else if (tab === 'rank') {
    if (!rankData.value) loadRank()
    nextTick(() => {
      bindScrollListeners()
      updateBackTopVisible()
    })
  }
})

onMounted(() => {
  loadCloud()
  window.addEventListener('resize', handleResize)
  nextTick(() => {
    bindScrollListeners()
    updateBackTopVisible()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  unbindScrollListeners()
  resizeObserver?.disconnect()
  cloudChart?.dispose()
  cloudChart = null
})
</script>

<style scoped>
.page {
  padding: 8px 4px 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.page-tabs {
  margin-top: 8px;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.page-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
}

.page-tabs :deep(.el-tab-pane) {
  height: 100%;
}

.tab-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 16px;
  flex-shrink: 0;
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

.summary-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
  padding: 10px 16px;
  flex-shrink: 0;
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

.legend-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 8px 16px;
  flex-shrink: 0;
}

.legend-label {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}

.legend-scale {
  display: flex;
  gap: 4px;
}

.legend-item {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #fff;
}

.legend-item.c-3 { background: #0b5345; }
.legend-item.c-2 { background: #1e8449; }
.legend-item.c-1 { background: #00b894; }
.legend-item.c0 { background: #7f8c8d; }
.legend-item.c1 { background: #d35400; }
.legend-item.c2 { background: #e74c3c; }
.legend-item.c3 { background: #ff2d2d; }

.legend-hint {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.hover-bar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 8px;
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.92);
  border-radius: 8px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 2;
}

.treemap-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.treemap-chart {
  width: 100%;
  height: 100%;
  min-height: 420px;
}

.treemap-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-panel {
  overflow: hidden;
}

.rank-card {
  padding: 12px 16px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.rank-card :deep(.el-table) {
  --el-table-header-bg-color: rgba(255, 255, 255, 0.96);
}

.rank-card :deep(.el-table__header-wrapper th.el-table__cell) {
  background-color: var(--el-table-header-bg-color);
}

.stock-name {
  font-weight: 600;
}

.name-cell {
  text-align: left;
}

.name-cell .stock-code {
  font-weight: 400;
}

.stock-action-tip {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--text);
  line-height: 1.6;
}

.stock-action-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--muted);
}

.stock-action-btns {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding-bottom: 8px;
}

.stock-action-btns .el-button {
  min-width: 140px;
}

.dual-header {
  line-height: 1.25;
  font-size: 12px;
  text-align: right;
}

.dual-header div + div {
  margin-top: 2px;
  color: var(--muted);
  font-weight: 400;
}

.dual-cell {
  line-height: 1.3;
}

.dual-cell .sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--muted);
}

.dual-cell .sub.up,
.dual-cell .sub.down {
  color: inherit;
}

.up { color: #e74c3c; }
.down { color: #00b894; }

:deep(.el-table__row) {
  cursor: pointer;
}

.back-top-btn {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.back-top-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(255, 107, 107, 0.25);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
