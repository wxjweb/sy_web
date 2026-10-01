<template>
  <div class="watchlist-panel" v-loading="loading">
    <div class="glass-card toolbar">
      <div class="toolbar-filters">
        <el-autocomplete
          v-model="searchKeyword"
          :fetch-suggestions="querySuggest"
          clearable
          placeholder="输入股票名称或代码查询"
          style="width: 220px"
          value-key="label"
          @select="onSearchSelect"
          @keyup.enter="onQuery"
        >
          <template #default="{ item }">
            <span class="suggest-name">{{ item.name }}</span>
            <span class="suggest-code">{{ item.code }}</span>
          </template>
        </el-autocomplete>
        <el-select
          v-model="filterAddSource"
          clearable
          placeholder="添加方式"
          style="width: 140px"
        >
          <el-option label="手动添加" value="manual" />
          <el-option label="推荐添加" value="recommend" />
        </el-select>
        <div class="date-range-split">
          <el-date-picker
            v-model="filterDateStart"
            type="date"
            placeholder="自选开始日期"
            value-format="YYYY-MM-DD"
            clearable
            :disabled-date="disableStartDate"
            style="width: 148px"
          />
          <span class="date-range-sep">到</span>
          <el-date-picker
            v-model="filterDateEnd"
            type="date"
            placeholder="自选结束日期"
            value-format="YYYY-MM-DD"
            clearable
            :disabled-date="disableEndDate"
            style="width: 148px"
          />
        </div>
        <el-tag
          v-if="filterGainBucket"
          closable
          type="primary"
          effect="plain"
          @close="clearGainBucketFilter"
        >
          自选涨幅：{{ filterGainBucket.label }}
        </el-tag>
        <el-button v-if="hasActiveFilters" round @click="resetFilters">重置筛选</el-button>
      </div>
      <div class="toolbar-actions">
        <el-button type="primary" round :loading="querying" @click="onQuery">查询</el-button>
        <el-button round :loading="loading" @click="load">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
        <el-button
          v-if="selectedCount"
          type="danger"
          round
          :loading="bulkDeleting"
          @click="onBulkRemove"
        >
          批量删除（{{ selectedCount }}）
        </el-button>
        <span class="count">
          共 {{ totalCount }} 只
          <template v-if="hasActiveFilters">（已筛选）</template>
          · 本页 {{ items.length }} 只
        </span>
      </div>
    </div>

    <div v-if="totalCount || pieLoading || barLoading" class="glass-card stats-card">
      <div class="stats-header">
        <h3 class="stats-title">自选涨幅统计</h3>
        <span class="stats-sub">
          共 {{ watchlistStats.total }} 只有效数据
          <template v-if="watchlistStats.unknown">
            ，{{ watchlistStats.unknown }} 只暂无自选涨幅
          </template>
          <template v-if="pieLoading || barLoading"> · 统计刷新中</template>
        </span>
      </div>
      <div class="stats-charts">
        <div class="chart-box" v-loading="pieLoading">
          <div class="chart-caption">涨跌分布</div>
          <div ref="pieChartRef" class="chart-canvas" />
        </div>
        <div class="chart-box chart-box-wide" v-loading="barLoading">
          <div class="chart-caption">
            涨幅区间分布
            <span class="chart-hint">点击柱形筛选下方列表</span>
          </div>
          <div ref="barChartRef" class="chart-canvas" />
        </div>
      </div>
    </div>

    <div class="glass-card table-card">
      <div class="watchlist-table-wrap">
        <el-table
          ref="tableRef"
          class="watchlist-table"
          :data="displayItems"
          stripe
          style="width: 100%"
          row-key="stock_code"
          :default-sort="{ prop: 'added_date', order: 'descending' }"
          @sort-change="onSortChange"
          @selection-change="onSelectionChange"
          @row-click="onRowClick"
        >
        <el-table-column type="selection" width="48" />
        <el-table-column label="名称" min-width="128" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <span class="stock-name" :title="row.stock_name">{{ row.stock_name }}</span>
              <div class="name-meta">
                <span class="stock-code">{{ row.stock_code }}</span>
                <el-tag
                  size="small"
                  :type="addSourceTagType(row.add_source)"
                  effect="plain"
                  round
                  class="add-source-tag"
                >
                  {{ addSourceLabel(row.add_source) }}
                </el-tag>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="最新" min-width="76" align="right">
          <template #default="{ row }">{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column
          prop="change_pct"
          min-width="92"
          align="right"
          sortable="custom"
          :sort-method="sortByChangePct"
        >
          <template #header>
            <div class="stacked-header">
              <span>涨幅</span>
              <span class="sub">振幅</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell align-right">
              <span :class="pctClass(row.change_pct)">{{ signed(row.change_pct) }}%</span>
              <span class="sub">{{ formatPct(row.amplitude) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="volume"
          min-width="108"
          align="right"
          sortable="custom"
          :sort-method="sortByVolume"
        >
          <template #header>
            <div class="stacked-header">
              <span>成交量</span>
              <span class="sub">成交额</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell align-right">
              <span>{{ formatVolume(row.volume) }}</span>
              <span class="sub">{{ formatAmount(row.amount) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="turnover_rate" min-width="88" align="right">
          <template #header>
            <div class="stacked-header">
              <span>换手</span>
              <span class="sub">量比</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell align-right">
              <span>{{ formatPct(row.turnover_rate) }}</span>
              <span class="sub">{{ formatRatio(row.volume_ratio) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="high"
          min-width="88"
          align="right"
          sortable="custom"
          :sort-method="sortByHigh"
        >
          <template #header>
            <div class="stacked-header">
              <span>最高</span>
              <span class="sub">最低</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell align-right">
              <span class="up">{{ formatPrice(row.high) }}</span>
              <span class="sub down">{{ formatPrice(row.low) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="watchlist_change_pct"
          min-width="108"
          align="right"
          sortable="custom"
          :sort-method="sortByWatchlistChange"
        >
          <template #header>
            <div class="stacked-header align-right">
              <span>自选价格</span>
              <span class="sub">自选涨幅</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell align-right watchlist-price-cell">
              <el-input
                v-model="row._watchlistPriceInput"
                size="small"
                class="watchlist-price-input"
                :placeholder="formatPrice(row.price)"
                inputmode="decimal"
                @focus="onWatchlistPriceFocus(row)"
                @blur="onWatchlistPriceBlur(row)"
                @keyup.enter="onWatchlistPriceBlur(row)"
                @click.stop
                @mousedown.stop
              />
              <span :class="['sub', pctClass(row.watchlist_change_pct)]">
                {{ signed(row.watchlist_change_pct) }}%
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="added_date"
          min-width="132"
          align="center"
          sortable="custom"
          :sort-method="sortByAddedDate"
        >
          <template #header>
            <div class="stacked-header center">
              <span>自选日期</span>
              <span class="sub">自选天数</span>
            </div>
          </template>
          <template #default="{ row }">
            <div class="stacked-cell center watchlist-date-cell">
              <el-date-picker
                v-model="row._addedDate"
                type="date"
                value-format="YYYY-MM-DD"
                size="small"
                class="watchlist-date-picker"
                @change="(v) => onDateChange(row, v)"
                @click.stop
              />
              <span class="sub">{{ formatWatchlistDays(row) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="68" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link @click.stop="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      </div>
      <el-empty
        v-if="!loading && !displayItems.length"
        :description="emptyDescription"
      />
      <div v-if="totalCount" class="pager-wrap">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="totalCount"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          class="pager"
          @current-change="onPageChange"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'
import {
  addStockWatchlist,
  bulkDeleteStockWatchlist,
  deleteStockWatchlist,
  getStockSuggest,
  getStockWatchlist,
  getStockWatchlistBarStats,
  getStockWatchlistPieStats,
  updateStockWatchlist,
} from '../api'

const emit = defineEmits(['select-stock'])

const WATCHLIST_GAIN_BUCKETS = [
  { label: '≥500%', min: 500, max: Infinity, minInclusive: true, maxInclusive: false },
  { label: '300%~500%', min: 300, max: 500 },
  { label: '100%~300%', min: 100, max: 300 },
  { label: '50%~100%', min: 50, max: 100 },
  { label: '30%~50%', min: 30, max: 50 },
  { label: '10%~30%', min: 10, max: 30 },
  { label: '0%~10%', min: 0, max: 10, minInclusive: false, maxInclusive: true },
  { label: '0%', flat: true },
  { label: '-10%~0%', min: -10, max: 0, minInclusive: false, maxInclusive: false },
  { label: '-30%~-10%', min: -30, max: -10 },
  { label: '-50%~-30%', min: -50, max: -30 },
  { label: '-80%~-50%', min: -80, max: -50 },
  { label: '<-80%', min: -Infinity, max: -80, minInclusive: false, maxInclusive: false },
]

function emptyStats() {
  return {
    up: 0,
    flat: 0,
    down: 0,
    unknown: 0,
    total: 0,
    bucketCounts: WATCHLIST_GAIN_BUCKETS.map((bucket) => ({ ...bucket, count: 0 })),
  }
}

const loading = ref(false)
const querying = ref(false)
const bulkDeleting = ref(false)
const items = ref([])
const totalCount = ref(0)
const statsLoading = ref(false)
const pieLoading = ref(false)
const barLoading = ref(false)
const statsData = ref(emptyStats())
const searchKeyword = ref('')
const activeQuery = ref('')
const page = ref(1)
const pageSize = ref(10)
const sortState = ref({ prop: 'added_date', order: 'descending' })
const filterAddSource = ref('')
const filterDateStart = ref('')
const filterDateEnd = ref('')
const filterGainBucket = ref(null)
const selectedCodes = ref(new Set())
const tableRef = ref(null)
const pieChartRef = ref(null)
const barChartRef = ref(null)
const editingPriceCodes = ref(new Set())
const savingPriceCodes = ref(new Set())
let pollTimer = null
let pieChart = null
let barChart = null
let statsResizeObserver = null
let loadSeq = 0
let pieSeq = 0
let barSeq = 0
let suppressPageWatch = false
let suppressFilterReload = false
let lastStatsAt = 0

const hasActiveFilters = computed(() => Boolean(
  activeQuery.value
  || filterAddSource.value
  || filterDateStart.value
  || filterDateEnd.value
  || filterGainBucket.value,
))

/** 服务端已按关键字/来源/日期/涨幅区间分页；行情相关排序在本页完成。 */
const displayItems = computed(() => {
  const list = [...items.value]
  const { prop, order } = sortState.value
  if (!prop || !order) return list
  const serverSortable = new Set(['added_date'])
  // 加入日期已由服务端排序
  if (serverSortable.has(prop)) return list
  const sorter = {
    change_pct: sortByChangePct,
    added_date: sortByAddedDate,
    watchlist_change_pct: sortByWatchlistChange,
    watchlist_days: sortByWatchlistDays,
    volume: sortByVolume,
    high: sortByHigh,
  }[prop]
  if (!sorter) return list
  const asc = order === 'ascending'
  list.sort((a, b) => (asc ? sorter(a, b) : sorter(b, a)))
  return list
})

const selectedCount = computed(() => selectedCodes.value.size)

const watchlistStats = computed(() => statsData.value)
const emptyDescription = computed(() => {
  if (totalCount.value && hasActiveFilters.value) {
    if (activeQuery.value) {
      return `未找到与「${activeQuery.value}」匹配的自选股`
    }
    if (filterGainBucket.value) {
      return `暂无自选涨幅在「${filterGainBucket.value.label}」区间的股票`
    }
    return '暂无符合条件的自选股'
  }
  return '暂无自选股，可搜索添加或从个股推荐自动加入'
})

function onSortChange({ prop, order }) {
  sortState.value = {
    prop: prop || 'added_date',
    order: order || 'descending',
  }
  // 加入日期走服务端排序，其它列仅本页排序
  if (prop === 'added_date') {
    suppressPageWatch = true
    page.value = 1
    suppressPageWatch = false
    load()
  }
}

function onPageChange() {
  if (suppressPageWatch) return
  load({ refreshStats: false })
}

function onPageSizeChange() {
  suppressPageWatch = true
  page.value = 1
  suppressPageWatch = false
  load({ refreshStats: false })
}

watch([filterAddSource, filterDateStart, filterDateEnd], () => {
  if (suppressFilterReload) return
  selectedCodes.value = new Set()
  suppressPageWatch = true
  page.value = 1
  suppressPageWatch = false
  load()
})

watch(filterGainBucket, () => {
  if (suppressFilterReload) return
  selectedCodes.value = new Set()
  suppressPageWatch = true
  page.value = 1
  suppressPageWatch = false
  load({ refreshStats: false })
  nextTick(renderStatsCharts)
})

watch(displayItems, () => {
  restoreTableSelection()
})

watch(watchlistStats, () => {
  nextTick(renderStatsCharts)
}, { deep: true })

function restoreTableSelection() {
  nextTick(() => {
    const table = tableRef.value
    if (!table) return
    table.clearSelection()
    for (const row of displayItems.value) {
      if (selectedCodes.value.has(row.stock_code)) {
        table.toggleRowSelection(row, true)
      }
    }
  })
}

function onSelectionChange(rows) {
  const pageCodes = new Set(displayItems.value.map((row) => row.stock_code))
  const selectedOnPage = new Set(rows.map((row) => row.stock_code))
  const next = new Set(selectedCodes.value)
  for (const code of pageCodes) {
    if (!selectedOnPage.has(code)) next.delete(code)
  }
  for (const code of selectedOnPage) next.add(code)
  selectedCodes.value = next
}

function resetFilters() {
  suppressFilterReload = true
  suppressPageWatch = true
  searchKeyword.value = ''
  activeQuery.value = ''
  filterAddSource.value = ''
  filterDateStart.value = ''
  filterDateEnd.value = ''
  filterGainBucket.value = null
  page.value = 1
  suppressFilterReload = false
  suppressPageWatch = false
  load()
}

function disableStartDate(date) {
  if (!filterDateEnd.value) return false
  const end = new Date(`${filterDateEnd.value}T00:00:00`)
  return date.getTime() > end.getTime()
}

function disableEndDate(date) {
  if (!filterDateStart.value) return false
  const start = new Date(`${filterDateStart.value}T00:00:00`)
  return date.getTime() < start.getTime()
}

function normalizeStockCode(raw) {
  const s = String(raw || '').toUpperCase().trim()
  const m = s.match(/^(SH|SZ|BJ)?(\d{6})$/)
  return m ? m[2] : ''
}

async function resolveStockCode(query) {
  const code = normalizeStockCode(query)
  if (code) return code
  const q = query.trim()
  if (!q) return null
  const { data } = await getStockSuggest(q)
  const suggestions = data || []
  if (!suggestions.length) return null
  const exact = suggestions.find((s) => s.code === q || s.name === q)
  if (exact) return exact.code
  if (suggestions.length === 1) return suggestions[0].code
  return null
}

async function tryAutoAddStock(query) {
  const targetCode = await resolveStockCode(query)
  if (!targetCode) return false
  if (items.value.some((item) => item.stock_code === targetCode)) return false
  try {
    await addStockWatchlist({ code: targetCode })
    return true
  } catch (e) {
    const msg = e.response?.data?.error || ''
    if (msg.includes('已在自选股')) return false
    throw e
  }
}

function clearGainBucketFilter() {
  filterGainBucket.value = null
}

function onBarBucketClick(bucket) {
  if (!bucket || bucket.count <= 0) return
  const activeLabel = filterGainBucket.value?.label
  if (activeLabel === bucket.label) {
    filterGainBucket.value = null
    ElMessage.success('已取消涨幅区间筛选')
    return
  }
  const { label, min, max, flat, minInclusive, maxInclusive } = bucket
  filterGainBucket.value = { label, min, max, flat, minInclusive, maxInclusive }
  ElMessage.success(`已筛选自选涨幅 ${label}，共 ${bucket.count} 只`)
}

function sortByChangePct(a, b) {
  const av = Number(a.change_pct)
  const bv = Number(b.change_pct)
  const an = Number.isFinite(av) ? av : -Infinity
  const bn = Number.isFinite(bv) ? bv : -Infinity
  return an - bn
}

function sortByVolume(a, b) {
  const av = Number(a.volume)
  const bv = Number(b.volume)
  return (Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity)
}

function sortByHigh(a, b) {
  const av = Number(a.high)
  const bv = Number(b.high)
  return (Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity)
}

function sortByWatchlistChange(a, b) {
  const av = Number(a.watchlist_change_pct)
  const bv = Number(b.watchlist_change_pct)
  const an = Number.isFinite(av) ? av : -Infinity
  const bn = Number.isFinite(bv) ? bv : -Infinity
  return an - bn
}

function sortByAddedDate(a, b) {
  const av = new Date(a.added_date || 0).getTime()
  const bv = new Date(b.added_date || 0).getTime()
  if (av !== bv) return av - bv
  const ac = new Date(a.created_at || 0).getTime()
  const bc = new Date(b.created_at || 0).getTime()
  return ac - bc
}

function sortByWatchlistDays(a, b) {
  return calcWatchlistDays(a) - calcWatchlistDays(b)
}

function calcWatchlistDays(item) {
  if (item?.watchlist_days != null && Number.isFinite(Number(item.watchlist_days))) {
    return Number(item.watchlist_days)
  }
  const added = item?.added_date
  if (!added) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(`${added}T00:00:00`)
  if (Number.isNaN(start.getTime())) return 0
  return Math.max(0, Math.round((today - start) / 86400000))
}

function formatWatchlistDays(row) {
  const days = calcWatchlistDays(row)
  return days === 0 ? '0天' : `${days}天`
}

function signed(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  const n = Number(v)
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function addSourceLabel(source) {
  return { manual: '手动添加', recommend: '推荐添加' }[source] || '手动添加'
}

function addSourceTagType(source) {
  return source === 'recommend' ? 'warning' : 'info'
}

function formatPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  return Number(v).toFixed(2)
}

function formatPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  return `${Number(v).toFixed(2)}%`
}

function formatRatio(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  return Number(v).toFixed(2)
}

function formatAmount(v) {
  if (!v) return '-'
  const n = Number(v)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return String(Math.round(n))
}

function formatVolume(v) {
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

function calcWatchlistChangePct(watchlistPrice, latestPrice) {
  const base = Number(watchlistPrice)
  const latest = Number(latestPrice)
  if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(latest) || latest <= 0) {
    return null
  }
  return Math.round(((latest - base) / base) * 10000) / 100
}

function applyItemMetrics(item) {
  const watchlistChangePct = calcWatchlistChangePct(item.watchlist_price, item.price)
  return {
    ...item,
    watchlist_change_pct: watchlistChangePct ?? item.watchlist_change_pct ?? null,
    watchlist_days: calcWatchlistDays(item),
  }
}

function formatWatchlistPriceInput(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return ''
  return Number(value).toFixed(2)
}

function decorateItem(item) {
  const enriched = applyItemMetrics(item)
  return {
    ...enriched,
    _addedDate: enriched.added_date,
    _watchlistPriceInput: formatWatchlistPriceInput(enriched.watchlist_price),
    _watchlistPriceOriginal: formatWatchlistPriceInput(enriched.watchlist_price),
  }
}

function decorateItems(list) {
  return (list || []).map(decorateItem)
}

function mergeLoadedItems(newList) {
  const oldMap = new Map(items.value.map((item) => [item.stock_code, item]))
  return (newList || []).map((item) => {
    const old = oldMap.get(item.stock_code)
    if (old && editingPriceCodes.value.has(item.stock_code)) {
      return {
        ...decorateItem(item),
        _watchlistPriceInput: old._watchlistPriceInput,
        _addedDate: old._addedDate,
      }
    }
    return decorateItem(item)
  })
}

function buildListFilterParams() {
  const params = {}
  if (activeQuery.value) params.q = activeQuery.value.trim()
  if (filterAddSource.value) params.add_source = filterAddSource.value
  if (filterDateStart.value) params.date_start = filterDateStart.value
  if (filterDateEnd.value) params.date_end = filterDateEnd.value
  return params
}

/** 列表查询参数（含涨幅区间）；统计接口不要带 gain_label，以免图被二次过滤。 */
function buildListQueryParams() {
  const params = buildListFilterParams()
  if (filterGainBucket.value?.label) {
    params.gain_label = filterGainBucket.value.label
  }
  return params
}

function applyPiePayload(data) {
  const next = { ...statsData.value }
  next.up = Number(data?.up) || 0
  next.flat = Number(data?.flat) || 0
  next.down = Number(data?.down) || 0
  next.unknown = Number(data?.unknown) || 0
  next.total = Number(data?.total) || (next.up + next.flat + next.down)
  statsData.value = next
}

function applyBarPayload(data) {
  const buckets = (data?.buckets || data?.bucket_counts || []).map((b, idx) => {
    const fallback = WATCHLIST_GAIN_BUCKETS[idx] || {}
    const min = b.min == null ? fallback.min : Number(b.min)
    const max = b.max == null ? fallback.max : Number(b.max)
    return {
      ...fallback,
      label: b.label || fallback.label,
      count: Number(b.count) || 0,
      flat: Boolean(b.flat ?? fallback.flat),
      min: Number.isFinite(min) ? min : fallback.min,
      max: Number.isFinite(max) ? max : fallback.max,
      minInclusive: b.minInclusive ?? fallback.minInclusive ?? true,
      maxInclusive: b.maxInclusive ?? fallback.maxInclusive ?? false,
    }
  })
  while (buckets.length < WATCHLIST_GAIN_BUCKETS.length) {
    const fallback = WATCHLIST_GAIN_BUCKETS[buckets.length]
    buckets.push({ ...fallback, count: 0 })
  }
  const next = { ...statsData.value }
  next.bucketCounts = buckets
  if (data?.unknown != null) next.unknown = Number(data.unknown) || 0
  if (data?.total != null && !next.total) next.total = Number(data.total) || 0
  statsData.value = next
}

async function loadPieStats() {
  const seq = ++pieSeq
  pieLoading.value = true
  try {
    const { data } = await getStockWatchlistPieStats(buildListFilterParams())
    if (seq !== pieSeq) return
    applyPiePayload(data)
    nextTick(renderPieChart)
  } catch (e) {
    if (seq === pieSeq) {
      ElMessage.warning(e?.response?.data?.error || '涨跌分布统计加载失败')
    }
  } finally {
    if (seq === pieSeq) pieLoading.value = false
  }
}

async function loadBarStats() {
  const seq = ++barSeq
  barLoading.value = true
  try {
    const { data } = await getStockWatchlistBarStats(buildListFilterParams())
    if (seq !== barSeq) return
    applyBarPayload(data)
    nextTick(renderBarChart)
  } catch (e) {
    if (seq === barSeq) {
      ElMessage.warning(e?.response?.data?.error || '涨幅区间统计加载失败')
    }
  } finally {
    if (seq === barSeq) barLoading.value = false
  }
}

async function loadStats({ force = false } = {}) {
  const now = Date.now()
  if (!force && now - lastStatsAt < 25000) return
  lastStatsAt = now
  statsLoading.value = true
  try {
    await Promise.all([loadPieStats(), loadBarStats()])
  } finally {
    statsLoading.value = false
    nextTick(() => {
      renderPieChart()
      renderBarChart()
    })
  }
}

async function load({ silent = false, refreshStats = null } = {}) {
  const seq = ++loadSeq
  if (!silent) loading.value = true
  try {
    const params = {
      page: page.value,
      page_size: pageSize.value,
      sort: 'added_date',
      order: sortState.value.prop === 'added_date' && sortState.value.order === 'ascending'
        ? 'asc'
        : 'desc',
      ...buildListQueryParams(),
    }

    const { data } = await getStockWatchlist(params)
    if (seq !== loadSeq) return

    const list = data?.list || []
    const total = Number(data?.total ?? list.length) || 0
    const serverPage = Number(data?.page || page.value) || 1

    items.value = silent ? mergeLoadedItems(list) : decorateItems(list)
    totalCount.value = total

    if (serverPage !== page.value) {
      suppressPageWatch = true
      page.value = serverPage
      suppressPageWatch = false
    }

    const shouldRefreshStats = refreshStats == null ? !silent : refreshStats
    loadStats({ force: shouldRefreshStats })

    nextTick(() => {
      tableRef.value?.doLayout?.()
    })
  } catch (e) {
    if (!silent && seq === loadSeq) {
      ElMessage.error(e.response?.data?.error || '获取自选股失败')
    }
  } finally {
    if (!silent && seq === loadSeq) loading.value = false
  }
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

function onSearchSelect(item) {
  searchKeyword.value = item.code
  onQuery(item.code)
}

async function onQuery(codeInput) {
  const q = (codeInput ?? searchKeyword.value).trim()
  if (!q) {
    ElMessage.warning('请输入股票名称或代码')
    return
  }
  querying.value = true
  try {
    const added = await tryAutoAddStock(q)
    activeQuery.value = q
    searchKeyword.value = q
    suppressPageWatch = true
    page.value = 1
    suppressPageWatch = false
    await load()
    if (added) {
      ElMessage.success('已加入自选股并展示')
    } else if (!totalCount.value) {
      ElMessage.info('未找到匹配的自选股')
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '查询失败')
  } finally {
    querying.value = false
  }
}

async function onDateChange(row, value) {
  if (!value || value === row.added_date) return
  try {
    await updateStockWatchlist(row.stock_code, { added_date: value })
    row.added_date = value
    row.watchlist_days = calcWatchlistDays(row)
    ElMessage.success('自选日期已更新')
    await load({ silent: true })
  } catch (e) {
    row._addedDate = row.added_date
    ElMessage.error(e.response?.data?.error || '更新失败')
  }
}

function parseWatchlistPriceInput(raw) {
  const text = String(raw ?? '').trim().replace(/,/g, '')
  if (!text) return null
  const price = Number(text)
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('invalid')
  }
  return Math.round(price * 100) / 100
}

function onWatchlistPriceFocus(row) {
  row._watchlistPriceOriginal = row._watchlistPriceInput
  editingPriceCodes.value = new Set([...editingPriceCodes.value, row.stock_code])
}

function normalizeWatchlistPriceInput(raw) {
  try {
    const parsed = parseWatchlistPriceInput(raw)
    return parsed == null ? '' : formatWatchlistPriceInput(parsed)
  } catch {
    return String(raw ?? '').trim()
  }
}

function isWatchlistPriceDirty(row) {
  return normalizeWatchlistPriceInput(row._watchlistPriceInput)
    !== normalizeWatchlistPriceInput(row._watchlistPriceOriginal)
}

function patchRowFromServer(row, serverItem) {
  const decorated = decorateItem(serverItem)
  Object.assign(row, decorated, {
    _watchlistPriceInput: decorated._watchlistPriceInput,
    _watchlistPriceOriginal: decorated._watchlistPriceInput,
  })
}

async function saveWatchlistPrice(row, price) {
  if (savingPriceCodes.value.has(row.stock_code)) return
  savingPriceCodes.value = new Set([...savingPriceCodes.value, row.stock_code])
  row.watchlist_price = price
  row.watchlist_change_pct = calcWatchlistChangePct(price, row.price)
  row._watchlistPriceInput = formatWatchlistPriceInput(price)
  try {
    const { data } = await updateStockWatchlist(row.stock_code, { watchlist_price: price })
    patchRowFromServer(row, data)
    ElMessage.success('自选价格已更新')
  } finally {
    savingPriceCodes.value = new Set(
      [...savingPriceCodes.value].filter((code) => code !== row.stock_code),
    )
  }
}

async function clearWatchlistPrice(row) {
  if (savingPriceCodes.value.has(row.stock_code)) return
  savingPriceCodes.value = new Set([...savingPriceCodes.value, row.stock_code])
  try {
    const { data } = await updateStockWatchlist(row.stock_code, { watchlist_price: null })
    patchRowFromServer(row, data)
    ElMessage.success('自选价格已清除')
  } finally {
    savingPriceCodes.value = new Set(
      [...savingPriceCodes.value].filter((code) => code !== row.stock_code),
    )
  }
}

async function onWatchlistPriceBlur(row) {
  editingPriceCodes.value = new Set(
    [...editingPriceCodes.value].filter((code) => code !== row.stock_code),
  )
  if (!isWatchlistPriceDirty(row)) {
    row._watchlistPriceInput = formatWatchlistPriceInput(row.watchlist_price)
    return
  }
  let price
  try {
    price = parseWatchlistPriceInput(row._watchlistPriceInput)
  } catch {
    row._watchlistPriceInput = formatWatchlistPriceInput(row.watchlist_price)
    ElMessage.warning('请输入有效的自选价格')
    return
  }
  if (price == null) {
    if (row.watchlist_price == null) {
      row._watchlistPriceInput = ''
      row._watchlistPriceOriginal = ''
      return
    }
    try {
      await clearWatchlistPrice(row)
    } catch (e) {
      row._watchlistPriceInput = formatWatchlistPriceInput(row.watchlist_price)
      ElMessage.error(e.response?.data?.error || '清除自选价格失败')
    }
    return
  }
  try {
    await saveWatchlistPrice(row, price)
  } catch (e) {
    row._watchlistPriceInput = formatWatchlistPriceInput(row.watchlist_price)
    ElMessage.error(e.response?.data?.error || '更新自选价格失败')
  }
}

async function onBulkRemove() {
  const codes = [...selectedCodes.value]
  if (!codes.length) return
  try {
    await ElMessageBox.confirm(`确定将选中的 ${codes.length} 只自选股移出列表吗？`, '批量删除自选', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  bulkDeleting.value = true
  try {
    const { data } = await bulkDeleteStockWatchlist(codes)
    selectedCodes.value = new Set()
    ElMessage.success(`已删除 ${data?.deleted ?? codes.length} 只自选股`)
    await load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '批量删除失败')
  } finally {
    bulkDeleting.value = false
  }
}

async function onRemove(row) {
  try {
    await ElMessageBox.confirm(`确定将 ${row.stock_name}（${row.stock_code}）移出自选股吗？`, '删除自选', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await deleteStockWatchlist(row.stock_code)
    ElMessage.success('已移出自选股')
    await load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

function onRowClick(row, _column, event) {
  if (event?.target?.closest?.('.el-checkbox')) return
  emit('select-stock', { code: row.stock_code, name: row.stock_name })
}

function startPoll() {
  stopPoll()
  pollTimer = setInterval(() => {
    if (editingPriceCodes.value.size || savingPriceCodes.value.size) return
    load({ silent: true })
  }, 5000)
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function disposeStatsCharts() {
  if (statsResizeObserver) {
    statsResizeObserver.disconnect()
    statsResizeObserver = null
  }
  if (pieChart) {
    pieChart.dispose()
    pieChart = null
  }
  if (barChart) {
    barChart.dispose()
    barChart = null
  }
}

function renderPieChart() {
  if (!pieChartRef.value) return
  if (!pieChart) pieChart = echarts.init(pieChartRef.value, null, { renderer: 'canvas' })
  const { up, flat, down, total } = watchlistStats.value
  const pieData = [
    { name: '上涨', value: up, itemStyle: { color: '#e74c3c' } },
    { name: '平盘', value: flat, itemStyle: { color: '#636e72' } },
    { name: '下跌', value: down, itemStyle: { color: '#00b894' } },
  ].filter((item) => item.value > 0)
  pieChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p) => {
        const ratio = total ? ((p.value / total) * 100).toFixed(1) : '0.0'
        return `${p.name}<br/>${p.value} 只（${ratio}%）`
      },
    },
    graphic: [{
      type: 'text',
      left: 'center',
      top: '38%',
      style: {
        text: `共${total}只`,
        textAlign: 'center',
        textVerticalAlign: 'middle',
        fill: '#303133',
        fontSize: 14,
        fontWeight: 600,
      },
    }],
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 12 },
    },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      label: {
        formatter: (p) => {
          const ratio = total ? ((p.value / total) * 100).toFixed(1) : '0.0'
          return `${p.name}\n${p.value}只 ${ratio}%`
        },
        fontSize: 12,
      },
      data: pieData.length ? pieData : [{ name: '暂无数据', value: 1, itemStyle: { color: '#dfe6e9' } }],
    }],
  }, true)
  setupStatsResizeObserver()
}

function renderBarChart() {
  if (!barChartRef.value) return
  if (!barChart) {
    barChart = echarts.init(barChartRef.value, null, { renderer: 'canvas' })
    bindBarChartClick()
  }
  const { bucketCounts } = watchlistStats.value
  const labels = bucketCounts.map((b) => b.label)
  const values = bucketCounts.map((b) => b.count)
  const activeLabel = filterGainBucket.value?.label
  barChart.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const p = params?.[0]
        if (!p) return ''
        const hint = Number(p.value) > 0 ? '<br/><span style="color:#409eff">点击筛选下方列表</span>' : ''
        return `${p.name}<br/>${p.value} 只${hint}`
      },
    },
    grid: { left: 48, right: 16, top: 24, bottom: 72 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { rotate: 35, fontSize: 11, interval: 0 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      name: '数量',
      nameTextStyle: { fontSize: 12 },
    },
    series: [{
      type: 'bar',
      cursor: 'pointer',
      data: values.map((v, i) => {
        const bucket = bucketCounts[i]
        const selected = activeLabel === bucket.label
        return {
          value: v,
          itemStyle: {
            color: barColorForBucket(bucket),
            borderRadius: [4, 4, 0, 0],
            opacity: activeLabel && !selected ? 0.42 : 1,
            borderColor: selected ? '#409eff' : 'transparent',
            borderWidth: selected ? 2 : 0,
            shadowBlur: selected ? 8 : 0,
            shadowColor: selected ? 'rgba(64,158,255,0.45)' : 'transparent',
          },
        }
      }),
      barMaxWidth: 36,
      label: {
        show: true,
        position: 'top',
        formatter: ({ value }) => (value > 0 ? value : ''),
        fontSize: 11,
      },
    }],
  }, true)
  setupStatsResizeObserver()
}

function renderStatsCharts() {
  renderPieChart()
  renderBarChart()
}

function bindBarChartClick() {
  if (!barChart) return
  barChart.off('click')
  barChart.on('click', (params) => {
    if (params.componentType !== 'series' || params.seriesType !== 'bar') return
    const bucket = watchlistStats.value.bucketCounts[params.dataIndex]
    onBarBucketClick(bucket)
  })
}

function barColorForBucket(bucket) {
  if (!bucket) return '#74b9ff'
  if (bucket.flat) return '#636e72'
  const min = Number(bucket.min)
  const max = Number(bucket.max)
  if (Number.isFinite(min) && min >= 100) return '#c0392b'
  if (Number.isFinite(min) && min >= 30) return '#e74c3c'
  if (Number.isFinite(min) && min >= 10) return '#e17055'
  if (Number.isFinite(min) && min >= 0) return '#fab1a0'
  if (Number.isFinite(max) && max <= -50) return '#006266'
  if (Number.isFinite(max) && max <= -10) return '#00b894'
  return '#74b9ff'
}

function setupStatsResizeObserver() {
  if (statsResizeObserver || !pieChartRef.value) return
  statsResizeObserver = new ResizeObserver(() => {
    pieChart?.resize()
    barChart?.resize()
    nextTick(() => tableRef.value?.doLayout?.())
  })
  statsResizeObserver.observe(pieChartRef.value)
  if (barChartRef.value) statsResizeObserver.observe(barChartRef.value)
}

onMounted(async () => {
  await load()
  startPoll()
  nextTick(() => {
    renderStatsCharts()
    setupStatsResizeObserver()
    tableRef.value?.doLayout?.()
  })
})

onBeforeUnmount(() => {
  stopPoll()
  disposeStatsCharts()
})
</script>

<style scoped>
.watchlist-panel {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 16px;
  box-sizing: border-box;
}

.stats-card {
  padding: 14px 16px 10px;
  flex-shrink: 0;
}

.stats-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.stats-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}

.stats-sub {
  font-size: 12px;
  color: var(--muted);
}

.stats-charts {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  gap: 16px;
  align-items: stretch;
}

.chart-box {
  min-width: 0;
}

.chart-box-wide {
  min-width: 0;
}

.chart-caption {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 4px;
}

.chart-hint {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #409eff;
}

.chart-canvas {
  width: 100%;
  height: 200px;
}

@media (max-width: 960px) {
  .stats-charts {
    grid-template-columns: 1fr;
  }
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  flex-shrink: 0;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
}

.date-range-split {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.date-range-sep {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--muted, #909399);
  line-height: 1;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  margin-left: auto;
}

.toolbar-actions .count {
  font-size: 13px;
  color: var(--muted);
  white-space: nowrap;
}

.table-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 10px 12px 8px;
  box-sizing: border-box;
}

.watchlist-table-wrap {
  width: 100%;
  /* 表头约 44px + 10 行 × 56px */
  min-height: 604px;
}

.watchlist-table {
  width: 100%;
}

.pager-wrap {
  flex-shrink: 0;
  width: 100%;
  padding: 12px 0 6px;
  margin-top: 4px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  box-sizing: border-box;
}

.stacked-header.align-right {
  align-items: flex-end;
}

.watchlist-price-cell {
  gap: 4px;
}

.watchlist-price-cell .sub.up,
.watchlist-price-cell .sub.down {
  font-size: 11px;
  font-weight: 600;
}

.stacked-header,
.stacked-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.25;
}

.stacked-header.center,
.stacked-cell.center {
  align-items: center;
}

.stacked-cell.align-right {
  align-items: flex-end;
}

.stacked-header .sub,
.stacked-cell .sub {
  font-size: 11px;
  color: var(--muted);
  font-weight: 400;
}

.stacked-header {
  font-size: 13px;
  font-weight: 600;
}

.watchlist-date-cell {
  gap: 4px;
}

.watchlist-date-picker {
  width: 100% !important;
  max-width: 124px;
}

.watchlist-table :deep(.el-table__cell) {
  padding: 8px 10px;
}

.watchlist-table :deep(.el-table__header .el-table__cell) {
  padding: 8px 0;
}

.watchlist-table :deep(.el-table__row) {
  height: 56px;
}

.watchlist-table :deep(.el-table__body-wrapper) {
  overflow: visible;
}

.stock-name {
  font-weight: 600;
  font-size: 13px;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  overflow: hidden;
}

.name-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  overflow: hidden;
}

.name-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.add-source-tag {
  flex-shrink: 1;
  max-width: 68px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stock-code {
  font-size: 11px;
  color: var(--muted);
  flex-shrink: 0;
}

.suggest-name {
  font-weight: 600;
  margin-right: 8px;
}

.suggest-code {
  color: var(--primary);
}

.watchlist-price-input {
  width: 100%;
  max-width: 96px;
}

.watchlist-price-input :deep(.el-input__inner) {
  text-align: right;
}

.up { color: #e74c3c; }
.down { color: #00b894; }

:deep(.el-table__row) {
  cursor: pointer;
}

.pager {
  display: flex;
  justify-content: center;
  width: 100%;
  margin-top: 0;
}
</style>
