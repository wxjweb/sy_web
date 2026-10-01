<template>
  <div class="realtime-panel">
    <div class="glass-card quote-card">
      <div class="quote-main">
        <div class="quote-left">
          <h2>{{ quote.name }}</h2>
          <div class="code-row">
            <span class="code">{{ quote.code }}</span>
            <el-tag v-if="quote.data_source" size="small" effect="plain" type="info">
              {{ quote.data_source }}
            </el-tag>
            <span v-if="quote.quote_time" class="quote-time">行情 {{ quote.quote_time }}</span>
          </div>
        </div>
        <div class="price" :class="priceClass">
          {{ formatPrice(quote.price) }}
          <span class="change">
            {{ signed(quote.change_amount) }}
            ({{ signed(quote.change_pct) }}%)
          </span>
        </div>
      </div>

      <el-row :gutter="12" class="quote-meta">
        <el-col :xs="8" :sm="4" v-for="item in quoteItems" :key="item.label">
          <div class="meta-item">
            <span class="label">{{ item.label }}</span>
            <span class="value" :class="item.cls">{{ item.value }}</span>
          </div>
        </el-col>
      </el-row>

      <div v-if="hasOrderBook" class="order-book">
        <div class="book-item bid">
          <span class="book-label">买一</span>
          <span class="book-price">{{ formatPrice(quote.bid1) }}</span>
          <span class="book-vol">{{ formatVol(quote.bid_vol1) }}</span>
        </div>
        <div class="book-item ask">
          <span class="book-label">卖一</span>
          <span class="book-price">{{ formatPrice(quote.ask1) }}</span>
          <span class="book-vol">{{ formatVol(quote.ask_vol1) }}</span>
        </div>
      </div>
    </div>

    <div class="glass-card kline-card" v-loading="klineLoading">
      <div class="kline-toolbar">
        <span class="kline-title">行情图</span>
        <el-radio-group v-model="klinePeriod" size="small" @change="onPeriodChange">
          <el-radio-button label="timeline">分时</el-radio-button>
          <el-radio-button label="day">日K</el-radio-button>
          <el-radio-button label="min5">5分</el-radio-button>
          <el-radio-button label="min1">1分</el-radio-button>
        </el-radio-group>
        <span v-if="klineCount" class="kline-count">{{ klineCountLabel }}</span>
        <span v-if="klineSource" class="kline-source">{{ klineSource }}</span>
      </div>
      <div class="kline-body">
        <div ref="klineRef" class="kline-chart" />
        <el-empty v-if="!klineLoading && !klineCount" class="kline-empty" :description="emptyChartText" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { getStockKline, getStockQuote } from '../api'

const props = defineProps({
  code: { type: String, required: true },
  initialQuote: { type: Object, default: null },
})

const emit = defineEmits(['quote-update'])

const quote = ref({ ...(props.initialQuote || {}) })
const klinePeriod = ref('timeline')
const klineSource = ref('')
const klineCount = ref(0)
const timelinePrevClose = ref(0)
const timelineTradeDate = ref('')
const klineLoading = ref(false)
const klineRef = ref(null)
let klineChart = null
let quoteTimer = null
let timelineTimer = null
let resizeObserver = null

const klineCountLabel = computed(() => {
  if (!klineCount.value) return ''
  if (klinePeriod.value === 'timeline') return `${timelineTradeDate.value || '当日'} ${klineCount.value} 点`
  return `共 ${klineCount.value} 根`
})

const emptyChartText = computed(() => (
  klinePeriod.value === 'timeline' ? '暂无分时数据' : '暂无 K 线数据'
))

const priceClass = computed(() => {
  const pct = quote.value?.change_pct || 0
  if (pct > 0) return 'up'
  if (pct < 0) return 'down'
  return ''
})

const hasOrderBook = computed(() => quote.value?.bid1 > 0 || quote.value?.ask1 > 0)

const quoteItems = computed(() => {
  const q = quote.value || {}
  return [
    { label: '今开', value: formatPrice(q.open) },
    { label: '最高', value: formatPrice(q.high), cls: 'up' },
    { label: '最低', value: formatPrice(q.low), cls: 'down' },
    { label: '昨收', value: formatPrice(q.prev_close) },
    { label: '成交量', value: formatNum(q.volume) },
    { label: '成交额', value: formatNum(q.amount) },
    { label: '市盈率', value: q.pe || '-' },
    { label: '市净率', value: q.pb || '-' },
    { label: '换手率', value: q.turnover_rate ? `${q.turnover_rate}%` : '-' },
    { label: '量比', value: q.volume_ratio || '-' },
  ]
})

function formatPrice(v) {
  if (v == null || Number.isNaN(v)) return '-'
  return Number(v).toFixed(2)
}

function formatNum(v) {
  if (!v) return '-'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return String(Math.round(v))
}

function formatVol(v) {
  if (!v) return '-'
  if (v >= 100) return `${(v / 100).toFixed(0)}手`
  return String(v)
}

function signed(v) {
  if (v == null) return '-'
  const n = Number(v)
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function calcMa(data, day) {
  const result = []
  for (let i = 0; i < data.length; i += 1) {
    if (i < day - 1) {
      result.push('-')
      continue
    }
    let sum = 0
    for (let j = 0; j < day; j += 1) {
      sum += data[i - j][1]
    }
    result.push(+(sum / day).toFixed(2))
  }
  return result
}

function splitData(rows) {
  const category = []
  const values = []
  const volumes = []
  const volColors = []
  for (const row of rows) {
    category.push(formatAxisLabel(row.date))
    const o = row.open
    const c = row.close
    values.push([o, c, row.low, row.high])
    volumes.push(row.volume)
    volColors.push(c >= o ? '#e74c3c' : '#00b894')
  }
  return { category, values, volumes, volColors }
}

function formatAxisLabel(date) {
  if (!date) return ''
  if (klinePeriod.value === 'day') {
    return String(date).slice(0, 10)
  }
  const s = String(date)
  return s.length >= 16 ? s.slice(5, 16) : s.slice(5)
}

function defaultZoomStart(len) {
  if (len <= 30) return 0
  if (len <= 60) return 15
  if (len <= 120) return 35
  return 55
}

function resizeKlineChart() {
  if (!klineChart || !klineRef.value) return
  const { clientWidth, clientHeight } = klineRef.value
  if (clientWidth > 0 && clientHeight > 0) {
    klineChart.resize({ width: clientWidth, height: clientHeight })
  }
}

function renderKline(rows) {
  if (!klineRef.value || !rows.length) {
    klineChart?.clear()
    klineCount.value = 0
    return
  }
  klineCount.value = rows.length

  if (!klineChart) {
    klineChart = echarts.init(klineRef.value, null, { renderer: 'canvas' })
  }

  const { category, values, volumes, volColors } = splitData(rows)
  const ma5 = calcMa(values, 5)
  const ma10 = calcMa(values, 10)
  const ma20 = calcMa(values, 20)
  const zoomStart = defaultZoomStart(category.length)

  klineChart.setOption({
    animation: false,
    backgroundColor: '#fafbfc',
    legend: {
      data: ['K线', 'MA5', 'MA10', 'MA20', '成交量'],
      top: 4,
      left: 'center',
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#ddd',
      textStyle: { color: '#333' },
      formatter(params) {
        const candle = params.find((p) => p.seriesName === 'K线')
        if (!candle) return ''
        const [open, close, low, high] = candle.data
        const vol = params.find((p) => p.seriesName === '成交量')
        return [
          `<b>${candle.axisValue}</b>`,
          `开 ${formatPrice(open)}  收 ${formatPrice(close)}`,
          `高 ${formatPrice(high)}  低 ${formatPrice(low)}`,
          `涨跌 ${signed(close - open)} (${signed(((close - open) / open) * 100)}%)`,
          vol ? `成交量 ${formatNum(vol.data)}` : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    grid: [
      { left: 56, right: 20, top: 40, height: '62%', containLabel: false },
      { left: 56, right: 20, top: '76%', height: '14%', containLabel: false },
    ],
    xAxis: [
      {
        type: 'category',
        data: category,
        boundaryGap: true,
        axisLine: { onZero: false, lineStyle: { color: '#ccc' } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax',
      },
      {
        type: 'category',
        gridIndex: 1,
        data: category,
        boundaryGap: true,
        axisLine: { onZero: false, lineStyle: { color: '#ccc' } },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
        min: 'dataMin',
        max: 'dataMax',
      },
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(245,245,245,0.3)'] } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eee' } },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: true, color: '#999', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: zoomStart, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', bottom: 6, height: 22, start: zoomStart, end: 100 },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: values,
        itemStyle: {
          color: '#e74c3c',
          color0: '#00b894',
          borderColor: '#e74c3c',
          borderColor0: '#00b894',
        },
      },
      {
        name: 'MA5',
        type: 'line',
        data: ma5,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#f39c12' },
      },
      {
        name: 'MA10',
        type: 'line',
        data: ma10,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#3498db' },
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.2, color: '#9b59b6' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes.map((v, i) => ({
          value: v,
          itemStyle: { color: volColors[i] },
        })),
      },
    ],
  }, true)

  requestAnimationFrame(() => {
    resizeKlineChart()
    requestAnimationFrame(resizeKlineChart)
  })
}

function renderTimeline(rows, prevClose) {
  if (!klineRef.value || !rows.length) {
    klineChart?.clear()
    klineCount.value = 0
    return
  }
  klineCount.value = rows.length

  if (!klineChart) {
    klineChart = echarts.init(klineRef.value, null, { renderer: 'canvas' })
  }

  const category = rows.map((r) => r.time || String(r.date).slice(11, 16))
  const prices = rows.map((r) => r.price ?? r.close)
  const avgs = rows.map((r) => r.avg_price)
  const volumes = rows.map((r, i) => ({
    value: r.volume,
    itemStyle: { color: (prices[i] >= prevClose ? '#e74c3c' : '#00b894') },
  }))
  const lastPrice = prices[prices.length - 1]
  const areaColor = lastPrice >= prevClose ? 'rgba(231,76,60,0.12)' : 'rgba(0,184,148,0.12)'

  klineChart.setOption({
    animation: false,
    backgroundColor: '#fafbfc',
    legend: {
      data: ['价格', '均价', '成交量'],
      top: 4,
      left: 'center',
      textStyle: { fontSize: 12 },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#ddd',
      textStyle: { color: '#333' },
      formatter(params) {
        const price = params.find((p) => p.seriesName === '价格')
        const avg = params.find((p) => p.seriesName === '均价')
        const vol = params.find((p) => p.seriesName === '成交量')
        if (!price) return ''
        const p = price.data
        const chg = prevClose ? ((p - prevClose) / prevClose) * 100 : 0
        return [
          `<b>${price.axisValue}</b>`,
          `价格 ${formatPrice(p)}`,
          `均价 ${avg ? formatPrice(avg.data) : '-'}`,
          prevClose ? `较昨收 ${signed(chg)}%` : '',
          vol ? `成交量 ${formatNum(vol.data?.value ?? vol.data)}` : '',
        ].filter(Boolean).join('<br/>')
      },
    },
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    grid: [
      { left: 56, right: 24, top: 40, height: '62%', containLabel: false },
      { left: 56, right: 24, top: '76%', height: '14%', containLabel: false },
    ],
    xAxis: [
      {
        type: 'category',
        data: category,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#ccc' } },
        axisLabel: { color: '#666', fontSize: 11, interval: Math.max(Math.floor(category.length / 8), 0) },
        splitLine: { show: false },
      },
      {
        type: 'category',
        gridIndex: 1,
        data: category,
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#ccc' } },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { show: false },
      },
    ],
    yAxis: [
      {
        scale: true,
        splitArea: { show: true, areaStyle: { color: ['rgba(250,250,250,0.3)', 'rgba(245,245,245,0.3)'] } },
        axisLabel: { color: '#666', fontSize: 11 },
        splitLine: { lineStyle: { color: '#eee' } },
      },
      {
        scale: true,
        gridIndex: 1,
        splitNumber: 2,
        axisLabel: { show: true, color: '#999', fontSize: 10 },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: 0, end: 100 },
      { show: true, xAxisIndex: [0, 1], type: 'slider', bottom: 6, height: 22, start: 0, end: 100 },
    ],
    series: [
      {
        name: '价格',
        type: 'line',
        data: prices,
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 1.8, color: '#2d8cf0' },
        areaStyle: { color: areaColor },
        markLine: prevClose ? {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#95a5a6', type: 'dashed', width: 1 },
          label: {
            formatter: `昨收 ${formatPrice(prevClose)}`,
            color: '#666',
            fontSize: 11,
          },
          data: [{ yAxis: prevClose }],
        } : undefined,
      },
      {
        name: '均价',
        type: 'line',
        data: avgs,
        showSymbol: false,
        smooth: true,
        lineStyle: { width: 1.2, color: '#f5a623' },
      },
      {
        name: '成交量',
        type: 'bar',
        xAxisIndex: 1,
        yAxisIndex: 1,
        data: volumes,
      },
    ],
  }, true)

  requestAnimationFrame(() => {
    resizeKlineChart()
    requestAnimationFrame(resizeKlineChart)
  })
}

function renderChart(rows, meta = {}) {
  if (klinePeriod.value === 'timeline') {
    renderTimeline(rows, meta.prev_close || timelinePrevClose.value || quote.value?.prev_close || 0)
  } else {
    renderKline(rows)
  }
}

function clearTimelineTimer() {
  if (timelineTimer) {
    clearInterval(timelineTimer)
    timelineTimer = null
  }
}

function setupTimelineTimer() {
  clearTimelineTimer()
  if (klinePeriod.value === 'timeline') {
    timelineTimer = setInterval(() => loadKline(true), 30000)
  }
}

function onPeriodChange() {
  loadKline()
}

function bindResizeObserver() {
  if (!klineRef.value?.parentElement || resizeObserver) return
  resizeObserver = new ResizeObserver(() => resizeKlineChart())
  resizeObserver.observe(klineRef.value.parentElement)
}

async function refreshQuote() {
  if (!props.code) return
  try {
    const { data } = await getStockQuote(props.code)
    quote.value = data
    emit('quote-update', data)
  } catch {
    // 静默失败
  }
}

async function loadKline(silent = false) {
  if (!props.code) return
  if (!silent) klineLoading.value = true
  try {
    const { data } = await getStockKline(props.code, klinePeriod.value)
    const parts = []
    if (data.data_source) parts.push(`数据来源：${data.data_source}`)
    if (data.trade_date && klinePeriod.value === 'timeline') parts.push(`交易日：${data.trade_date}`)
    klineSource.value = parts.join(' · ')
    timelinePrevClose.value = data.prev_close || quote.value?.prev_close || 0
    timelineTradeDate.value = data.trade_date || ''
    await nextTick()
    bindResizeObserver()
    renderChart(data.list || [], { prev_close: timelinePrevClose.value })
    setupTimelineTimer()
  } finally {
    if (!silent) klineLoading.value = false
  }
}

function handleResize() {
  resizeKlineChart()
}

watch(() => props.initialQuote, (v) => {
  if (v) quote.value = { ...v }
}, { deep: true })

watch(() => props.code, () => {
  loadKline()
  refreshQuote()
})

onMounted(() => {
  if (props.initialQuote) quote.value = { ...props.initialQuote }
  loadKline()
  quoteTimer = setInterval(refreshQuote, 5000)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  if (quoteTimer) clearInterval(quoteTimer)
  clearTimelineTimer()
  window.removeEventListener('resize', handleResize)
  resizeObserver?.disconnect()
  resizeObserver = null
  klineChart?.dispose()
  klineChart = null
})
</script>

<style scoped>
.realtime-panel {
  margin-bottom: 20px;
}

.quote-card {
  padding: 20px 24px;
  margin-bottom: 16px;
}

.quote-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.quote-left h2 {
  margin: 0 0 8px;
  font-size: 1.5rem;
}

.code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.code {
  color: var(--muted);
  font-size: 14px;
}

.quote-time {
  font-size: 12px;
  color: var(--muted);
}

.price {
  font-size: 2rem;
  font-weight: 700;
}

.price.up {
  color: #e74c3c;
}

.price.down {
  color: #00b894;
}

.change {
  font-size: 1rem;
  margin-left: 8px;
}

.meta-item {
  padding: 8px 0;
}

.meta-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.meta-item .value {
  font-weight: 600;
}

.meta-item .value.up {
  color: #e74c3c;
}

.meta-item .value.down {
  color: #00b894;
}

.order-book {
  display: flex;
  gap: 24px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.book-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.book-label {
  color: var(--muted);
}

.book-item.bid .book-price {
  color: #e74c3c;
  font-weight: 700;
}

.book-item.ask .book-price {
  color: #00b894;
  font-weight: 700;
}

.kline-card {
  padding: 12px 16px 10px;
  display: flex;
  flex-direction: column;
}

.kline-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  flex-shrink: 0;
}

.kline-title {
  font-weight: 600;
}

.kline-count {
  font-size: 12px;
  color: var(--muted);
}

.kline-source {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}

.kline-body {
  position: relative;
  width: 100%;
  min-height: 480px;
  height: 52vh;
  max-height: 640px;
}

.kline-chart {
  width: 100%;
  height: 100%;
}

.kline-empty {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
