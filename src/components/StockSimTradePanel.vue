<template>
  <div class="sim-trade-panel" v-loading="loading">
    <div class="glass-card summary-card">
      <div class="summary-header">
        <div>
          <h3 class="summary-title">模拟交易账户</h3>
          <p class="summary-desc">
            初始资金 {{ formatMoney(summary.initial_capital) }} ·
            自选价买入 1000 股 · 佣金 0.01%（最低 5 元）· 卖出印花税 0.05%
          </p>
        </div>
        <div class="summary-actions">
          <el-button round :loading="loading" @click="load">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
          <el-button round :loading="syncing" @click="onSync">同步自选股</el-button>
        </div>
      </div>
      <div class="summary-grid">
        <div class="summary-item highlight">
          <div class="label">总资产</div>
          <div class="value">{{ formatMoney(summary.total_assets) }}</div>
        </div>
        <div class="summary-item">
          <div class="label">可用资金</div>
          <div class="value">{{ formatMoney(summary.cash) }}</div>
        </div>
        <div class="summary-item">
          <div class="label">总投入本金</div>
          <div class="value">{{ formatMoney(summary.invested) }}</div>
        </div>
        <div class="summary-item">
          <div class="label">总市值</div>
          <div class="value">{{ formatMoney(summary.market_value) }}</div>
        </div>
        <div class="summary-item">
          <div class="label">浮动盈亏</div>
          <div class="value" :class="pctClass(summary.floating_pnl)">
            {{ formatSignedMoney(summary.floating_pnl) }}
            <span v-if="summary.floating_pnl_pct != null" class="pct">
              ({{ signed(summary.floating_pnl_pct) }}%)
            </span>
          </div>
        </div>
        <div class="summary-item">
          <div class="label">持仓只数</div>
          <div class="value">{{ summary.position_count || 0 }}</div>
        </div>
      </div>
    </div>

    <div class="glass-card toolbar">
      <el-input
        v-model="keyword"
        clearable
        placeholder="搜索名称或代码"
        style="width: 220px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button type="primary" round @click="onSearch">查询</el-button>
      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button label="positions">持仓</el-radio-button>
        <el-radio-button label="logs">操作日志</el-radio-button>
      </el-radio-group>
      <span class="count">共 {{ viewMode === 'positions' ? totalCount : logTotal }} 条</span>
    </div>

    <div v-if="viewMode === 'positions'" class="glass-card table-card">
      <el-table
        :data="items"
        stripe
        style="width: 100%"
        row-key="stock_code"
        :default-sort="{ prop: 'pnl', order: 'descending' }"
        @sort-change="onSortChange"
        @row-click="onRowClick"
      >
        <el-table-column label="名称" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="name-cell">
              <span class="stock-name">{{ row.stock_name }}</span>
              <span class="stock-code">{{ row.stock_code }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="cost_price" label="成本" min-width="88" align="right" sortable="custom">
          <template #default="{ row }">{{ formatPrice(row.cost_price) }}</template>
        </el-table-column>
        <el-table-column prop="price" label="最新" min-width="88" align="right" sortable="custom">
          <template #default="{ row }">{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="持仓" min-width="80" align="right" sortable="custom" />
        <el-table-column prop="buy_date" label="买入日期" min-width="110" align="center" sortable="custom">
          <template #default="{ row }">{{ row.buy_date || '-' }}</template>
        </el-table-column>
        <el-table-column prop="pnl" label="盈亏" min-width="110" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="pctClass(row.pnl)">{{ formatSignedMoney(row.pnl) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pnl_pct" label="盈亏百分比" min-width="110" align="right" sortable="custom">
          <template #default="{ row }">
            <span :class="pctClass(row.pnl_pct)">
              {{ row.pnl_pct == null ? '-' : `${signed(row.pnl_pct)}%` }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="danger" link @click.stop="onSell(row)">卖出</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="totalCount"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="load"
          @size-change="onPageSizeChange"
        />
      </div>
    </div>

    <div v-else class="glass-card table-card">
      <div class="log-filters">
        <el-select v-model="logSide" clearable placeholder="方向" style="width: 120px" @change="loadLogs">
          <el-option label="买入" value="buy" />
          <el-option label="卖出" value="sell" />
        </el-select>
        <el-input
          v-model="logCode"
          clearable
          placeholder="股票代码"
          style="width: 140px"
          @keyup.enter="loadLogs"
          @clear="loadLogs"
        />
        <el-button round @click="loadLogs">筛选</el-button>
      </div>
      <el-table :data="logs" stripe style="width: 100%" row-key="id">
        <el-table-column prop="created_at" label="时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.created_at) }}</template>
        </el-table-column>
        <el-table-column label="名称" min-width="130">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="stock-name">{{ row.stock_name }}</span>
              <span class="stock-code">{{ row.stock_code }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="side" label="方向" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.side === 'buy' ? 'danger' : 'success'" size="small" effect="plain">
              {{ row.side === 'buy' ? '买入' : '卖出' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="price" label="成交价" min-width="88" align="right">
          <template #default="{ row }">{{ formatPrice(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="quantity" label="数量" min-width="80" align="right" />
        <el-table-column prop="amount" label="成交额" min-width="110" align="right">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="commission" label="佣金" min-width="80" align="right">
          <template #default="{ row }">{{ formatMoney(row.commission) }}</template>
        </el-table-column>
        <el-table-column prop="stamp_tax" label="印花税" min-width="80" align="right">
          <template #default="{ row }">{{ formatMoney(row.stamp_tax) }}</template>
        </el-table-column>
        <el-table-column prop="realized_pnl" label="已实现盈亏" min-width="110" align="right">
          <template #default="{ row }">
            <span v-if="row.side === 'sell'" :class="pctClass(row.realized_pnl)">
              {{ formatSignedMoney(row.realized_pnl) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="logPage"
          v-model:page-size="logPageSize"
          :total="logTotal"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadLogs"
          @size-change="onLogPageSizeChange"
        />
      </div>
    </div>

    <el-dialog v-model="sellVisible" title="手动卖出" width="420px" align-center>
      <div v-if="sellRow" class="sell-form">
        <p>
          {{ sellRow.stock_name }}（{{ sellRow.stock_code }}）
          · 持仓 {{ sellRow.quantity }} 股 · 最新 {{ formatPrice(sellRow.price) }}
        </p>
        <el-form label-width="88px">
          <el-form-item label="卖出数量">
            <el-input-number
              v-model="sellQty"
              :min="1"
              :max="sellRow.quantity"
              :step="100"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="卖出价格">
            <el-input-number
              v-model="sellPrice"
              :min="0.01"
              :step="0.01"
              :precision="2"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
        <p class="sell-hint">留空价格将使用最新价；卖出收取佣金 0.01%（最低 5 元）+ 印花税 0.05%。</p>
      </div>
      <template #footer>
        <el-button round @click="sellVisible = false">取消</el-button>
        <el-button type="danger" round :loading="selling" @click="confirmSell">确认卖出</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import {
  getSimTradePortfolio,
  getSimTradeLogs,
  sellSimTrade,
  syncSimTrade,
} from '../api'

const emit = defineEmits(['select-stock'])

const loading = ref(false)
const syncing = ref(false)
const selling = ref(false)
const viewMode = ref('positions')
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)
const totalCount = ref(0)
const sortProp = ref('pnl')
const sortOrder = ref('desc')
const items = ref([])
const summary = reactive({
  total_capital: 1e9,
  initial_capital: 1e9,
  cash: 1e9,
  invested: 0,
  market_value: 0,
  total_assets: 1e9,
  floating_pnl: 0,
  floating_pnl_pct: null,
  position_count: 0,
})

const logs = ref([])
const logTotal = ref(0)
const logPage = ref(1)
const logPageSize = ref(20)
const logSide = ref('')
const logCode = ref('')

const sellVisible = ref(false)
const sellRow = ref(null)
const sellQty = ref(1000)
const sellPrice = ref(0)

function formatPrice(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  return Number(v).toFixed(2)
}

function formatMoney(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  const n = Number(v)
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return n.toFixed(2)
}

function formatSignedMoney(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  const n = Number(v)
  const text = formatMoney(Math.abs(n))
  if (n > 0) return `+${text}`
  if (n < 0) return `-${text}`
  return text
}

function signed(v) {
  if (v == null || !Number.isFinite(Number(v))) return '-'
  const n = Number(v)
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

function pctClass(v) {
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}

function formatTime(v) {
  if (!v) return '-'
  return String(v).replace('T', ' ').slice(0, 19)
}

function applySummary(data) {
  const s = data || {}
  summary.total_capital = s.total_capital ?? 1e9
  summary.initial_capital = s.initial_capital ?? s.total_capital ?? 1e9
  summary.cash = s.cash ?? 0
  summary.invested = s.invested ?? 0
  summary.market_value = s.market_value ?? 0
  summary.total_assets = s.total_assets ?? (Number(summary.cash) + Number(summary.market_value))
  summary.floating_pnl = s.floating_pnl ?? 0
  summary.floating_pnl_pct = s.floating_pnl_pct ?? null
  summary.position_count = s.position_count ?? 0
}

async function load() {
  loading.value = true
  try {
    const { data } = await getSimTradePortfolio({
      page: page.value,
      page_size: pageSize.value,
      q: keyword.value.trim(),
      sort: sortProp.value,
      order: sortOrder.value,
      sync: 1,
    })
    items.value = data?.list || []
    totalCount.value = data?.total || 0
    page.value = data?.page || page.value
    applySummary(data?.summary)
    const syncInfo = data?.sync
    if (syncInfo?.added > 0) {
      const tip = syncInfo.remaining > 0
        ? `已自动建仓 ${syncInfo.added} 只，仍有 ${syncInfo.remaining} 只待同步`
        : `已自动建仓 ${syncInfo.added} 只`
      ElMessage.success(tip)
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadLogs() {
  loading.value = true
  try {
    const { data } = await getSimTradeLogs({
      page: logPage.value,
      page_size: logPageSize.value,
      side: logSide.value || undefined,
      code: logCode.value.trim() || undefined,
    })
    logs.value = data?.list || []
    logTotal.value = data?.total || 0
    logPage.value = data?.page || logPage.value
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载日志失败')
  } finally {
    loading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

function onPageSizeChange() {
  page.value = 1
  load()
}

function onLogPageSizeChange() {
  logPage.value = 1
  loadLogs()
}

function onSortChange({ prop, order }) {
  if (!prop || !order) {
    sortProp.value = 'pnl'
    sortOrder.value = 'desc'
  } else {
    sortProp.value = prop
    sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
  }
  page.value = 1
  load()
}

function onRowClick(row) {
  emit('select-stock', { code: row.stock_code, name: row.stock_name })
}

function onSell(row) {
  sellRow.value = row
  sellQty.value = row.quantity
  sellPrice.value = Number(row.price) > 0 ? Number(row.price) : undefined
  sellVisible.value = true
}

async function confirmSell() {
  if (!sellRow.value) return
  const qty = Number(sellQty.value)
  if (!Number.isFinite(qty) || qty <= 0) {
    ElMessage.warning('请输入有效卖出数量')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认卖出 ${sellRow.value.stock_name} ${qty} 股？`,
      '确认卖出',
      { type: 'warning', confirmButtonText: '卖出', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  selling.value = true
  try {
    const payload = {
      code: sellRow.value.stock_code,
      quantity: qty,
    }
    if (sellPrice.value != null && Number(sellPrice.value) > 0) {
      payload.price = Number(sellPrice.value)
    }
    const { data: result } = await sellSimTrade(payload)
    ElMessage.success(
      `卖出成功，已实现盈亏 ${formatSignedMoney(result?.realized_pnl)}`,
    )
    sellVisible.value = false
    await load()
    if (viewMode.value === 'logs') await loadLogs()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '卖出失败')
  } finally {
    selling.value = false
  }
}

async function onSync() {
  syncing.value = true
  try {
    let totalAdded = 0
    let lastFailed = 0
    let rounds = 0
    while (rounds < 50) {
      rounds += 1
      const { data: result } = await syncSimTrade()
      totalAdded += result?.added || 0
      lastFailed = result?.failed || 0
      if (!(result?.remaining > 0)) {
        ElMessage.success(
          `同步完成：本轮新增买入 ${totalAdded}，失败 ${lastFailed}`,
        )
        break
      }
    }
    await load()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

watch(viewMode, (mode) => {
  if (mode === 'logs') loadLogs()
  else load()
})

onMounted(() => {
  load()
})
</script>

<style scoped>
.sim-trade-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.summary-card,
.toolbar,
.table-card {
  padding: 16px 18px;
}

.summary-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.summary-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.summary-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.summary-actions {
  display: flex;
  gap: 8px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.summary-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.summary-item.highlight {
  background: rgba(64, 158, 255, 0.12);
}

.summary-item.highlight .value {
  color: var(--el-color-primary);
}

.summary-item .label {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.summary-item .value {
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.summary-item .pct {
  font-size: 13px;
  font-weight: 500;
  margin-left: 4px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.count {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted);
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-name {
  font-weight: 500;
}

.stock-code {
  font-size: 12px;
  color: var(--muted);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.log-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.sell-form p {
  margin: 0 0 12px;
  line-height: 1.5;
}

.sell-hint {
  font-size: 12px;
  color: var(--muted);
}

.up {
  color: #ef5350;
}

.down {
  color: #26a69a;
}
</style>
