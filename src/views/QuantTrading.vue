<template>
  <div class="page quant-page">
    <h1 class="page-title">量化回测</h1>

    <div class="glass-card intro-card">
      <p class="intro-text">
        量化模拟交易系统：数据获取 → 技术指标 → 交易信号 → 策略回测 → 绩效评估。
        回测支持多级别 K 线（1 分至年 K），优先使用前复权数据；T 根 K 线收盘生成信号，下一根 K 线开盘执行，已计入手续费与滑点。
      </p>
      <div class="pipeline">
        <el-tag effect="plain" round>历史行情</el-tag>
        <el-icon><ArrowRight /></el-icon>
        <el-tag effect="plain" round>因子/指标</el-tag>
        <el-icon><ArrowRight /></el-icon>
        <el-tag effect="plain" round>交易信号</el-tag>
        <el-icon><ArrowRight /></el-icon>
        <el-tag effect="plain" round>模拟回测</el-tag>
        <el-icon><ArrowRight /></el-icon>
        <el-tag effect="plain" round>绩效统计</el-tag>
      </div>
    </div>

    <div class="glass-card history-card">
      <div class="history-head">
        <div class="history-head-left">
          <h3 class="history-title">回测历史</h3>
          <span v-if="backtestHistory.length" class="history-count">共 {{ backtestHistory.length }} 条</span>
        </div>
        <el-button
          v-if="backtestHistory.length"
          text
          type="danger"
          size="small"
          @click="clearHistory"
        >
          清空
        </el-button>
      </div>
      <div class="history-body">
        <div v-if="backtestHistory.length" class="history-list">
          <button
            v-for="item in backtestHistory"
            :key="`${item.code}-${item.backtestedAt}`"
            type="button"
            class="history-item"
            :title="`回测 ${formatBacktestHistoryLabel(item)}`"
            @click="backtestFromHistory(item)"
          >
            {{ formatBacktestHistoryLabel(item) }}
          </button>
        </div>
        <p v-else class="history-empty">暂无回测记录，完成回测后将自动记录在此</p>
      </div>
    </div>

    <div class="layout-grid">
      <div class="glass-card config-card">
        <h3 class="section-title">回测配置</h3>
        <el-form label-width="96px" class="config-form">
          <el-form-item label="股票">
            <el-autocomplete
              v-model="form.code"
              :fetch-suggestions="querySuggest"
              clearable
              placeholder="输入股票名称或代码"
              style="width: 100%"
              value-key="label"
              @select="onSelectStock"
            >
              <template #default="{ item }">
                <span class="suggest-name">{{ item.name }}</span>
                <span class="suggest-code">{{ item.code }}</span>
              </template>
            </el-autocomplete>
          </el-form-item>

          <el-form-item label="策略">
            <el-select v-model="form.strategy" style="width: 100%" @change="onStrategyChange">
              <el-option-group
                v-for="group in strategyGroups"
                :key="group.category"
                :label="group.category"
              >
                <el-option
                  v-for="s in group.items"
                  :key="s.id"
                  :label="s.name"
                  :value="s.id"
                />
              </el-option-group>
            </el-select>
            <p v-if="currentStrategy" class="strategy-desc">{{ currentStrategy.description }}</p>
          </el-form-item>

          <template v-if="currentStrategy">
            <el-form-item
              v-for="param in currentStrategy.params"
              :key="param.key"
              :label="param.label"
            >
              <el-input-number
                v-if="param.type === 'int'"
                v-model="form.params[param.key]"
                :min="param.min"
                :max="param.max"
                controls-position="right"
                style="width: 100%"
              />
              <el-input-number
                v-else
                v-model="form.params[param.key]"
                :min="param.min"
                :max="param.max"
                :step="param.step || 0.1"
                :precision="1"
                controls-position="right"
                style="width: 100%"
              />
            </el-form-item>
          </template>

          <el-form-item label="数据级别">
            <el-radio-group v-model="form.dataPeriod" class="period-radio-group">
              <template v-for="group in dataPeriodGroups" :key="group.group">
                <div class="period-group-label">{{ group.group }}</div>
                <el-radio-button
                  v-for="p in group.items"
                  :key="p.id"
                  :value="p.id"
                >
                  {{ p.label }}
                </el-radio-button>
              </template>
            </el-radio-group>
            <p v-if="currentPeriod?.max_range_days" class="field-hint">
              {{ currentPeriod.label }} 级别建议回测区间不超过 {{ currentPeriod.max_range_days }} 天
            </p>
          </el-form-item>

          <el-form-item label="回测区间">
            <div class="range-wrap">
              <el-radio-group v-model="form.rangePreset" @change="onRangePresetChange">
                <el-radio-button
                  v-for="opt in rangePresetOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </el-radio-button>
                <el-radio-button value="custom">自定义</el-radio-button>
              </el-radio-group>
              <el-date-picker
                v-if="form.rangePreset === 'custom'"
                v-model="form.dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                value-format="YYYY-MM-DD"
                style="width: 100%; margin-top: 10px"
              />
              <p v-else class="field-hint range-hint">
                {{ rangeHintText }}
              </p>
            </div>
          </el-form-item>

          <el-form-item label="初始资金">
            <el-input-number
              v-model="form.initialCapital"
              :min="1000"
              :step="10000"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="手续费率">
            <el-input-number
              v-model="form.commissionRate"
              :min="0"
              :max="0.01"
              :step="0.0001"
              :precision="4"
              controls-position="right"
              style="width: 100%"
            />
            <span class="field-hint">默认万分之一（0.0001）</span>
          </el-form-item>

          <el-form-item label="滑点">
            <el-input-number
              v-model="form.slippage"
              :min="0"
              :max="0.05"
              :step="0.0001"
              :precision="4"
              controls-position="right"
              style="width: 100%"
            />
            <span class="field-hint">默认 0.1%（0.001）</span>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" round :loading="running" @click="() => onRunBacktest()">
              <el-icon><VideoPlay /></el-icon>
              开始回测
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="result-column" v-loading="running">
        <template v-if="result">
          <div class="glass-card result-head">
            <div>
              <h3 class="section-title">
                {{ result.stock?.name }}（{{ result.stock?.code }}）
              </h3>
              <p class="result-meta">
                策略：{{ strategyName(result.strategy) }} ·
                级别：{{ result.data_period_label || '日K' }} ·
                数据：{{ result.data_source }} ·
                {{ result.adjust_label || '前复权' }} ·
                {{ result.bar_count }} 根 K 线
              </p>
              <el-alert
                v-if="result.warning"
                :title="result.warning"
                type="warning"
                show-icon
                :closable="false"
                class="result-warning"
              />
            </div>
          </div>

          <div class="metrics-grid">
            <div class="glass-card metric-card">
              <span class="metric-label">总收益率</span>
              <span class="metric-value" :class="pctClass(result.metrics.total_return)">
                {{ formatPct(result.metrics.total_return) }}
              </span>
            </div>
            <div class="glass-card metric-card">
              <span class="metric-label">年化收益率</span>
              <span class="metric-value" :class="pctClass(result.metrics.annualized_return)">
                {{ formatPct(result.metrics.annualized_return) }}
              </span>
            </div>
            <div class="glass-card metric-card">
              <span class="metric-label">最大回撤</span>
              <span class="metric-value down">{{ formatPct(result.metrics.max_drawdown) }}</span>
            </div>
            <div class="glass-card metric-card">
              <span class="metric-label">夏普比率</span>
              <span class="metric-value">{{ result.metrics.sharpe_ratio }}</span>
            </div>
            <div class="glass-card metric-card">
              <span class="metric-label">胜率</span>
              <span class="metric-value">{{ formatPct(result.metrics.win_rate) }}</span>
            </div>
            <div class="glass-card metric-card">
              <span class="metric-label">期末资产</span>
              <span class="metric-value">¥{{ formatMoney(result.metrics.final_equity) }}</span>
            </div>
          </div>

          <div v-if="result.operation_advice" class="glass-card advice-card">
            <h3 class="section-title">操作建议</h3>
            <p class="advice-disclaimer">{{ result.operation_advice.disclaimer }}</p>
            <div class="advice-grid">
              <div
                v-for="item in adviceItems"
                :key="item.horizon_key"
                class="advice-item"
              >
                <div class="advice-head">
                  <span class="advice-horizon">{{ item.horizon }}</span>
                  <el-tag :type="adviceTagType(item.action)" effect="plain" round>
                    {{ item.action_label }}
                  </el-tag>
                </div>
                <p class="advice-summary">{{ item.summary }}</p>
                <ul v-if="item.reasons?.length" class="advice-reasons">
                  <li v-for="(reason, idx) in item.reasons" :key="idx">{{ reason }}</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="glass-card chart-card">
            <h3 class="section-title">净值曲线</h3>
            <div ref="equityChartRef" class="equity-chart" />
          </div>

          <div class="glass-card table-card">
            <h3 class="section-title">交易记录（{{ result.trades?.length || 0 }} 笔）</h3>
            <el-table :data="result.trades || []" stripe max-height="280" size="small">
              <el-table-column prop="date" label="日期" width="110" />
              <el-table-column label="方向" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.action === 'buy' ? 'danger' : 'success'" size="small" effect="plain">
                    {{ row.action === 'buy' ? '买入' : '卖出' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="price" label="成交价" width="90" align="right" />
              <el-table-column prop="quantity" label="数量" width="90" align="right" />
              <el-table-column prop="amount" label="成交额" width="110" align="right" />
              <el-table-column prop="commission" label="手续费" width="90" align="right" />
              <el-table-column prop="cash_after" label="剩余资金" min-width="110" align="right" />
            </el-table>
            <el-empty v-if="!result.trades?.length" description="回测期间无成交" />
          </div>

          <div class="glass-card table-card">
            <h3 class="section-title">因子/指标预览（最近 {{ result.factor_preview?.length || 0 }} 日）</h3>
            <el-table :data="result.factor_preview || []" stripe max-height="320" size="small">
              <el-table-column prop="date" label="日期" width="110" fixed />
              <el-table-column prop="close" label="收盘" width="90" align="right" />
              <el-table-column
                v-for="col in factorColumns"
                :key="col"
                :prop="col"
                :label="factorLabel(col)"
                width="100"
                align="right"
              />
              <el-table-column label="信号" width="80" align="center">
                <template #default="{ row }">
                  <el-tag size="small" :type="signalTagType(row.signal)" effect="plain">
                    {{ signalLabel(row.signal) }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <div v-else class="glass-card empty-card">
          <el-empty description="配置参数后点击「开始回测」查看模拟交易结果" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import { getQuantStrategies, getStockSuggest, runQuantBacktest } from '../api'
import {
  clearBacktestHistory,
  formatBacktestHistoryLabel,
  loadBacktestHistory,
  saveBacktestHistory,
} from '../utils/quantBacktestHistory'

const route = useRoute()

const strategies = ref([])
const dataPeriods = ref([])
const running = ref(false)
const result = ref(null)
const backtestHistory = ref([])
const equityChartRef = ref(null)
let equityChart = null

const DAY_PRESETS = [
  { value: '60d', days: 60, label: '60天' },
  { value: '180d', days: 180, label: '180天' },
  { value: '365d', days: 365, label: '365天' },
  { value: '730d', days: 730, label: '730天' },
  { value: '1095d', days: 1095, label: '1095天' },
  { value: '1460d', days: 1460, label: '1460天' },
]

const YEAR_PRESETS = [
  { value: '3y', years: 3, label: '3年' },
  { value: '5y', years: 5, label: '5年' },
  { value: '7y', years: 7, label: '7年' },
  { value: '10y', years: 10, label: '10年' },
  { value: '15y', years: 15, label: '15年' },
  { value: '20y', years: 20, label: '20年' },
]

const RANGE_PRESET_MAP = Object.fromEntries([
  ...DAY_PRESETS.map((p) => [p.value, { type: 'days', days: p.days }]),
  ...YEAR_PRESETS.map((p) => [p.value, { type: 'years', years: p.years }]),
])

const form = reactive({
  code: '000001',
  strategy: 'dual_ma',
  dataPeriod: 'day',
  params: {},
  rangePreset: '5y',
  dateRange: dateRangeForYears(5),
  initialCapital: 200000,
  commissionRate: 0.0001,
  slippage: 0.001,
})

const defaultDataPeriods = [
  { id: 'min1', label: '1分', group: '分钟', max_range_days: 60, bars_per_day: 240 },
  { id: 'min5', label: '5分', group: '分钟', max_range_days: 180, bars_per_day: 48 },
  { id: 'min15', label: '15分', group: '分钟', max_range_days: 365, bars_per_day: 16 },
  { id: 'min30', label: '30分', group: '分钟', max_range_days: 730, bars_per_day: 8 },
  { id: 'min60', label: '60分', group: '分钟', max_range_days: 1095, bars_per_day: 4 },
  { id: 'min120', label: '120分', group: '分钟', max_range_days: 1460, bars_per_day: 2 },
  { id: 'day', label: '日K', group: '日线及以上' },
  { id: 'week', label: '周K', group: '日线及以上' },
  { id: 'month', label: '月K', group: '日线及以上' },
  { id: 'quarter', label: '季K', group: '日线及以上' },
  { id: 'year', label: '年K', group: '日线及以上' },
]

const currentPeriod = computed(() => dataPeriods.value.find((p) => p.id === form.dataPeriod))

const isMinutePeriod = computed(() => Boolean(currentPeriod.value?.max_range_days))

const rangePresetOptions = computed(() => {
  if (isMinutePeriod.value) {
    const maxDays = currentPeriod.value.max_range_days
    return DAY_PRESETS.filter((p) => p.days <= maxDays)
  }
  return [
    ...DAY_PRESETS.filter((p) => p.days === 60 || p.days === 180),
    ...YEAR_PRESETS,
  ]
})

const defaultRangePreset = computed(() => {
  if (isMinutePeriod.value) {
    const maxDays = currentPeriod.value.max_range_days
    const match = [...DAY_PRESETS].reverse().find((p) => p.days <= maxDays)
    return match?.value || '60d'
  }
  return '5y'
})

const dataPeriodGroups = computed(() => {
  const order = ['分钟', '日线及以上']
  const map = new Map()
  for (const p of dataPeriods.value) {
    const group = p.group || '其他'
    if (!map.has(group)) map.set(group, [])
    map.get(group).push(p)
  }
  const groups = order.filter((g) => map.has(g)).map((g) => ({ group: g, items: map.get(g) }))
  for (const [group, items] of map) {
    if (!order.includes(group)) groups.push({ group, items })
  }
  return groups
})

const rangeHintText = computed(() => {
  const [start, end] = form.dateRange || []
  const label = currentPeriod.value?.label || '日K'
  const adjust = currentPeriod.value?.id === 'day' ? '前复权' : ''
  const parts = [`${start} 至 ${end}`, label]
  if (adjust) parts.push(adjust)
  return parts.join(' · ')
})

const currentStrategy = computed(() => strategies.value.find((s) => s.id === form.strategy))

const strategyGroups = computed(() => {
  const order = ['趋势跟踪', '均值回归', '动量情绪', '成交量流动性', '组合策略']
  const map = new Map()
  for (const s of strategies.value) {
    const cat = s.category || '其他'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat).push(s)
  }
  const groups = order.filter((c) => map.has(c)).map((c) => ({ category: c, items: map.get(c) }))
  for (const [cat, items] of map) {
    if (!order.includes(cat)) groups.push({ category: cat, items })
  }
  return groups
})

const factorColumns = computed(() => {
  const rows = result.value?.factor_preview || []
  if (!rows.length) return []
  const skip = new Set(['date', 'close', 'signal', 'exec_signal'])
  return Object.keys(rows[0]).filter((k) => !skip.has(k))
})

const adviceItems = computed(() => {
  const advice = result.value?.operation_advice
  if (!advice) return []
  if (advice.items?.length) return advice.items
  return ['current', 'short_term', 'medium_term', 'long_term']
    .map((key) => advice[key])
    .filter(Boolean)
})

function adviceTagType(action) {
  const map = {
    buy: 'danger',
    open: 'danger',
    add: 'danger',
    sell: 'success',
    close: 'success',
    reduce: 'warning',
    hold: 'info',
    wait: '',
  }
  return map[action] || 'info'
}

function formatDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateRangeForYears(years) {
  const end = new Date()
  const start = new Date()
  start.setFullYear(end.getFullYear() - years)
  return [formatDate(start), formatDate(end)]
}

function dateRangeForDays(days) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - days + 1)
  return [formatDate(start), formatDate(end)]
}

function applyRangePreset(preset) {
  if (preset === 'custom') {
    form.dateRange = isMinutePeriod.value
      ? dateRangeForDays(currentPeriod.value?.max_range_days || 60)
      : dateRangeForYears(1)
    return
  }
  const config = RANGE_PRESET_MAP[preset]
  if (!config) return
  form.dateRange = config.type === 'days'
    ? dateRangeForDays(config.days)
    : dateRangeForYears(config.years)
}

function syncRangePresetForPeriod() {
  form.rangePreset = defaultRangePreset.value
  applyRangePreset(form.rangePreset)
}

function onRangePresetChange() {
  applyRangePreset(form.rangePreset)
}

function presetCalendarDays(preset) {
  if (preset === 'custom') return null
  const config = RANGE_PRESET_MAP[preset]
  if (!config) return null
  return config.type === 'days' ? config.days : config.years * 365
}

function calcBacktestLimit() {
  const period = currentPeriod.value
  let days
  if (form.rangePreset !== 'custom') {
    days = presetCalendarDays(form.rangePreset)
  } else {
    const [start, end] = form.dateRange || []
    if (!start || !end) return 500
    days = Math.ceil((new Date(end) - new Date(start)) / 86400000) + 1
  }
  if (!days) return 500
  if (period?.bars_per_day || period?.max_range_days) {
    const barsPerDay = period.bars_per_day
      || { min1: 240, min5: 48, min15: 16, min30: 8, min60: 4, min120: 2 }[period.id]
      || 240
    return Math.max(60, Math.min(Math.ceil(days * barsPerDay) + 30, 5000))
  }
  if (form.rangePreset !== 'custom') {
    const config = RANGE_PRESET_MAP[form.rangePreset]
    if (config?.type === 'years') {
      return config.years * 252 + 60
    }
    return Math.max(60, Math.min(Math.ceil(days * 0.75) + 30, 6000))
  }
  return Math.max(60, Math.min(Math.ceil(days * 0.75) + 30, 6000))
}

function initParams(strategy) {
  if (!strategy) return
  const next = {}
  for (const p of strategy.params || []) {
    next[p.key] = p.default
  }
  form.params = next
}

function onStrategyChange() {
  initParams(currentStrategy.value)
}

function strategyName(id) {
  return strategies.value.find((s) => s.id === id)?.name || id
}

function factorLabel(key) {
  return {
    short_ma: '短均线',
    long_ma: '长均线',
    short_ema: '短 EMA',
    long_ema: '长 EMA',
    boll_mid: '布林中轨',
    boll_upper: '布林上轨',
    boll_lower: '布林下轨',
    ma_spread: '均线收敛度',
    st_upper: 'Supertrend 上轨',
    st_lower: 'Supertrend 下轨',
    st_direction: 'Supertrend 方向',
    macd_dif: 'DIF',
    macd_dea: 'DEA',
    macd_hist: 'MACD柱',
    rsi: 'RSI',
    bias: '乖离率 BIAS',
    momentum: '动量 ROC',
    adj_momentum: '波动调整动量',
    ret_vol: '收益波动率',
    vol_ratio: '量比',
    adx: 'ADX',
    regime: '市场状态',
    atr: 'ATR',
    deviation: 'MA 偏离度',
    factor_score: '综合因子得分',
  }[key] || key
}

function signalLabel(v) {
  return { 1: '买入', '-1': '卖出', 0: '观望' }[String(v)] || '观望'
}

function signalTagType(v) {
  if (v > 0) return 'danger'
  if (v < 0) return 'success'
  return 'info'
}

function pctClass(v) {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}

function formatPct(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return `${(n * 100).toFixed(2)}%`
}

function formatMoney(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

async function querySuggest(query, cb) {
  const q = (query || '').trim()
  if (!q) {
    cb([])
    return
  }
  try {
    const { data } = await getStockSuggest(q)
    cb((data || []).map((item) => ({
      ...item,
      label: `${item.name} (${item.code})`,
    })))
  } catch {
    cb([])
  }
}

function onSelectStock(item) {
  form.code = item.code
}

async function loadStrategies() {
  const { data } = await getQuantStrategies()
  strategies.value = data.strategies || []
  dataPeriods.value = (data.data_periods || []).length ? data.data_periods : defaultDataPeriods
  if (!form.strategy && strategies.value.length) {
    form.strategy = strategies.value[0].id
  }
  if (!dataPeriods.value.some((p) => p.id === form.dataPeriod)) {
    form.dataPeriod = 'day'
  }
  syncRangePresetForPeriod()
  initParams(currentStrategy.value)
}

async function clearHistory() {
  try {
    await ElMessageBox.confirm('确定清空全部回测历史吗？', '清空历史', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  backtestHistory.value = clearBacktestHistory()
  ElMessage.success('回测历史已清空')
}

function backtestFromHistory(item) {
  form.code = item.code || item.query
  onRunBacktest(item.code || item.query)
}

async function onRunBacktest(codeInput) {
  const code = (typeof codeInput === 'string' ? codeInput : form.code).trim()
  if (!code) {
    ElMessage.warning('请输入股票代码或名称')
    return
  }
  form.code = code
  running.value = true
  try {
    const [startDate, endDate] = form.dateRange || []
    const { data } = await runQuantBacktest({
      code,
      strategy: form.strategy,
      data_period: form.dataPeriod,
      params: form.params,
      start_date: startDate,
      end_date: endDate,
      initial_capital: form.initialCapital,
      commission_rate: form.commissionRate,
      slippage: form.slippage,
      limit: calcBacktestLimit(),
    })
    result.value = data
    backtestHistory.value = saveBacktestHistory({
      query: code,
      name: data?.stock?.name,
      code: data?.stock?.code || code,
      strategy: form.strategy,
      strategyName: strategyName(form.strategy),
      dataPeriod: form.dataPeriod,
    })
    await nextTick()
    renderEquityChart()
    ElMessage.success('回测完成')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '回测失败')
  } finally {
    running.value = false
  }
}

function renderEquityChart() {
  const curve = result.value?.equity_curve || []
  if (!equityChartRef.value) return
  if (!curve.length) {
    equityChart?.clear()
    return
  }
  if (!equityChart) {
    equityChart = echarts.init(equityChartRef.value, null, { renderer: 'canvas' })
  }
  equityChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 20, top: 24, bottom: 28 },
    xAxis: {
      type: 'category',
      data: curve.map((i) => i.date),
      axisLabel: { color: '#8b95a8' },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: '#8b95a8' },
    },
    series: [{
      name: '净值',
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 2, color: '#409eff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(64,158,255,0.25)' },
          { offset: 1, color: 'rgba(64,158,255,0.02)' },
        ]),
      },
      data: curve.map((i) => i.equity),
    }],
  }, true)
  equityChart.resize()
}

watch(() => form.dataPeriod, () => {
  syncRangePresetForPeriod()
})

watch(() => result.value?.equity_curve, () => {
  nextTick(() => renderEquityChart())
})

function onResize() {
  equityChart?.resize()
}

function applyRouteCode() {
  const code = (route.query.code || '').toString().trim()
  if (code) {
    form.code = code
  }
}

watch(
  () => route.query.code,
  () => applyRouteCode(),
)

onMounted(async () => {
  window.addEventListener('resize', onResize)
  backtestHistory.value = loadBacktestHistory()
  applyRouteCode()
  await loadStrategies()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  equityChart?.dispose()
  equityChart = null
})
</script>

<style scoped>
.quant-page {
  padding: 8px 4px 32px;
}

.intro-card {
  padding: 16px 20px;
  margin-bottom: 16px;
}

.intro-text {
  margin: 0 0 12px;
  color: var(--muted);
  line-height: 1.7;
  font-size: 14px;
}

.pipeline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  color: var(--muted);
}

.history-card {
  padding: 18px 22px;
  margin-bottom: 16px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.history-head-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.history-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.history-count {
  font-size: 12px;
  color: var(--muted);
}

.history-body {
  min-height: 88px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px dashed rgba(255, 107, 107, 0.18);
}

.history-empty {
  margin: 0;
  padding: 12px 4px;
  font-size: 13px;
  color: var(--muted);
  text-align: center;
  line-height: 1.6;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.history-item {
  border: 1px solid rgba(255, 107, 107, 0.22);
  background: rgba(255, 255, 255, 0.85);
  color: var(--text);
  border-radius: 18px;
  padding: 8px 18px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
}

.history-item:hover {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.12), rgba(78, 205, 196, 0.1));
  border-color: rgba(255, 107, 107, 0.38);
  color: var(--primary);
  transform: translateY(-1px);
}

.layout-grid {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.config-card,
.result-head,
.advice-card,
.chart-card,
.table-card,
.empty-card {
  padding: 16px 18px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
}

.config-form {
  margin-top: 4px;
}

.strategy-desc,
.field-hint,
.range-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.period-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.period-group-label {
  flex: 0 0 100%;
  margin-top: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.period-group-label:first-child {
  margin-top: 0;
}
.field-hint,
.result-meta {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.range-wrap {
  width: 100%;
}

.range-hint {
  margin-top: 8px;
}

.result-warning {
  margin-top: 12px;
}

.result-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.metric-card {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.metric-label {
  font-size: 12px;
  color: var(--muted);
}

.metric-value {
  font-size: 22px;
  font-weight: 700;
}

.metric-value.up { color: #e74c3c; }
.metric-value.down { color: #00b894; }

.advice-disclaimer {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.advice-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.advice-item {
  padding: 14px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.06), rgba(255, 107, 107, 0.04));
  border: 1px solid rgba(64, 158, 255, 0.12);
}

.advice-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.advice-horizon {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
}

.advice-summary {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text);
}

.advice-reasons {
  margin: 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
}

.advice-reasons li + li {
  margin-top: 4px;
}

@media (max-width: 960px) {
  .advice-grid {
    grid-template-columns: 1fr;
  }
}

.equity-chart {
  width: 100%;
  height: 320px;
}

.suggest-name {
  font-weight: 600;
  margin-right: 8px;
}

.suggest-code {
  color: var(--primary);
}

.empty-card {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .layout-grid {
    grid-template-columns: 1fr;
  }

  .metrics-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
