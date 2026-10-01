<template>
  <div class="gold-forge-history">
    <div class="history-header">
      <div class="history-header-left">
        <el-button round @click="$emit('back')">
          <el-icon><ArrowLeft /></el-icon>
          返回铸金台
        </el-button>
        <h2 class="history-title">分析历史</h2>
        <span class="history-sub">同一股票多次分析可横向 / 纵向对比</span>
      </div>
    </div>

    <div class="glass-card history-toolbar">
      <el-autocomplete
        v-model="filterCode"
        :fetch-suggestions="querySuggest"
        clearable
        placeholder="筛选股票代码或名称"
        style="width: 220px"
        value-key="label"
        @select="onSelectStock"
        @clear="loadSessions"
      >
        <template #default="{ item }">
          <span class="suggest-name">{{ item.name }}</span>
          <span class="suggest-code">{{ item.code }}</span>
        </template>
      </el-autocomplete>
      <el-date-picker
        v-model="filterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        clearable
        style="width: 260px"
      />
      <el-checkbox v-model="onlyCurrentStock" @change="loadSessions">
        仅看当前配置股票
      </el-checkbox>
      <el-button round :loading="loading" @click="loadSessions">
        <el-icon><Refresh /></el-icon>
        刷新
      </el-button>
      <span class="history-count">共 {{ filteredSessions.length }} 条记录</span>
    </div>

    <div v-if="compareRows.length >= 2" class="glass-card compare-card">
      <div class="compare-head">
        <h3 class="section-title">对比视图（{{ compareRows.length }} 条）</h3>
        <el-button link type="primary" @click="clearSelection">清空选择</el-button>
      </div>
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="metric-col">指标</th>
              <th v-for="row in compareRows" :key="row.id" class="value-col">
                <div class="compare-col-head">
                  <span class="compare-stock">{{ row.stock_name }}</span>
                  <span class="compare-code">{{ row.stock_code }}</span>
                  <span class="compare-time">{{ formatSessionTime(row.created_at) }}</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="metric in compareMetrics" :key="metric.key">
              <td class="metric-col">{{ metric.label }}</td>
              <td
                v-for="row in compareRows"
                :key="`${metric.key}-${row.id}`"
                class="value-col"
                :class="metric.classFn?.(row)"
              >
                {{ metric.value(row) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="history-layout">
      <div class="glass-card list-card">
        <el-table
          ref="tableRef"
          v-loading="loading"
          :data="filteredSessions"
          stripe
          size="small"
          row-key="id"
          highlight-current-row
          @selection-change="onSelectionChange"
          @row-click="onRowClick"
        >
          <el-table-column type="selection" width="44" :selectable="isSelectable" />
          <el-table-column label="分析时间" min-width="150">
            <template #default="{ row }">{{ formatSessionTime(row.created_at) }}</template>
          </el-table-column>
          <el-table-column label="股票" min-width="130">
            <template #default="{ row }">
              <div class="stock-cell">
                <span class="stock-name">{{ row.stock_name }}</span>
                <span class="stock-code">{{ row.stock_code }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="rating" label="评级" width="72" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.rating" size="small" effect="dark" type="danger">{{ row.rating }}</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column prop="recommended_plan" label="推荐方案" width="88" />
          <el-table-column label="置信度" width="72" align="right">
            <template #default="{ row }">{{ row.confidence_score ?? '—' }}</template>
          </el-table-column>
          <el-table-column prop="risk_profile_label" label="风险偏好" width="80" />
          <el-table-column label="建议仓位" width="88" align="right">
            <template #default="{ row }">{{ row.position_pct || '—' }}</template>
          </el-table-column>
          <el-table-column label="共振" width="64" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.has_resonance" size="small" type="warning" effect="plain">S级</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click.stop="viewDetail(row)">查看详情</el-button>
              <el-button link type="primary" @click.stop="$emit('apply', row)">载入分析</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && !filteredSessions.length" description="暂无分析历史记录" />
      </div>

      <div class="detail-card glass-card" v-loading="detailLoading">
        <div class="detail-head">
          <h3 class="section-title">
            <template v-if="activeSession">
              {{ activeSession.stock_name }}（{{ activeSession.stock_code }}）· {{ formatSessionTime(activeSession.created_at) }}
            </template>
            <template v-else>分析详情</template>
          </h3>
          <el-button v-if="activeSession" link type="primary" @click="$emit('apply', activeSession)">
            载入到铸金台
          </el-button>
        </div>
        <GoldForgeResultPanel
          :result="detailResult"
          :loading="detailLoading"
          empty-text="在左侧选择一条记录查看完整分析"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { getGoldForgeSession, getGoldForgeSessions, getStockSuggest } from '../api'
import GoldForgeResultPanel from './GoldForgeResultPanel.vue'
import { formatSessionTime, sessionToResult } from '../utils/goldForgeSession'

const props = defineProps({
  initialCode: { type: String, default: '' },
})

defineEmits(['back', 'apply'])

const loading = ref(false)
const detailLoading = ref(false)
const sessions = ref([])
const filterCode = ref('')
const filterDateRange = ref(null)
const onlyCurrentStock = ref(Boolean(props.initialCode))
const selectedRows = ref([])
const activeSession = ref(null)
const detailResult = ref(null)
const tableRef = ref(null)

const MAX_COMPARE = 4

const filteredSessions = computed(() => {
  let list = sessions.value
  const code = filterCode.value.trim().toLowerCase()
  if (code) {
    list = list.filter((item) => (
      item.stock_code?.toLowerCase().includes(code)
      || item.stock_name?.toLowerCase().includes(code)
    ))
  }
  const range = filterDateRange.value
  if (range?.length === 2) {
    const [start, end] = range
    list = list.filter((item) => {
      const day = (item.created_at || '').slice(0, 10)
      return day >= start && day <= end
    })
  }
  return list
})

const compareRows = computed(() => {
  const rows = selectedRows.value
  if (rows.length < 2) return []
  return [...rows].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
})

const compareMetrics = [
  { key: 'rating', label: '综合评级', value: (row) => row.rating || '—' },
  { key: 'plan', label: '推荐方案', value: (row) => row.recommended_plan || '—' },
  { key: 'confidence', label: '置信度', value: (row) => row.confidence_score ?? '—' },
  { key: 'risk', label: '风险偏好', value: (row) => row.risk_profile_label || '—' },
  { key: 'position', label: '建议仓位', value: (row) => row.position_pct || '—' },
  { key: 'ratio', label: '仓位占比', value: (row) => (row.position_ratio != null ? `${row.position_ratio}%` : '—') },
  { key: 'cost', label: '持仓成本', value: (row) => (row.cost_price != null ? row.cost_price : '—') },
  { key: 'quantity', label: '持仓股数', value: (row) => (row.quantity != null ? row.quantity : '—') },
  {
    key: 'resonance',
    label: '时空共振',
    value: (row) => (row.has_resonance ? 'S级' : '—'),
    classFn: (row) => (row.has_resonance ? 'highlight-warn' : ''),
  },
]

async function querySuggest(query, cb) {
  const q = (query || '').trim()
  if (!q) {
    cb([])
    return
  }
  try {
    const { data } = await getStockSuggest(q)
    cb((data || []).map((item) => ({ ...item, label: `${item.name} (${item.code})` })))
  } catch {
    cb([])
  }
}

function onSelectStock(item) {
  filterCode.value = item.code
  loadSessions()
}

function isSelectable(row) {
  if (selectedRows.value.some((item) => item.id === row.id)) return true
  return selectedRows.value.length < MAX_COMPARE
}

function onSelectionChange(rows) {
  if (rows.length > MAX_COMPARE) {
    ElMessage.warning(`最多同时对比 ${MAX_COMPARE} 条记录`)
    const trimmed = rows.slice(0, MAX_COMPARE)
    selectedRows.value = trimmed
    nextTick(() => {
      tableRef.value?.clearSelection()
      trimmed.forEach((row) => tableRef.value?.toggleRowSelection(row, true))
    })
    return
  }
  selectedRows.value = rows
}

function clearSelection() {
  selectedRows.value = []
  tableRef.value?.clearSelection()
}

async function loadSessions() {
  loading.value = true
  try {
    const params = { limit: 200 }
    if (onlyCurrentStock.value && (filterCode.value.trim() || props.initialCode)) {
      params.code = filterCode.value.trim() || props.initialCode
    }
    const { data } = await getGoldForgeSessions(params)
    sessions.value = (data?.list || []).filter((item) => item.status === 'completed')
    if (activeSession.value && !sessions.value.some((item) => item.id === activeSession.value.id)) {
      activeSession.value = null
      detailResult.value = null
    }
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '加载分析历史失败')
  } finally {
    loading.value = false
  }
}

async function viewDetail(row) {
  if (!row?.id) return
  activeSession.value = row
  detailLoading.value = true
  detailResult.value = null
  try {
    const { data } = await getGoldForgeSession(row.id)
    detailResult.value = sessionToResult(data)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '加载详情失败')
  } finally {
    detailLoading.value = false
  }
}

function onRowClick(row) {
  viewDetail(row)
}

watch(onlyCurrentStock, (checked) => {
  if (checked && props.initialCode && !filterCode.value) {
    filterCode.value = props.initialCode
  }
})

onMounted(async () => {
  if (props.initialCode) {
    filterCode.value = props.initialCode
  }
  await loadSessions()
  if (filteredSessions.value.length === 1) {
    await viewDetail(filteredSessions.value[0])
  }
})
</script>

<style scoped>
.gold-forge-history {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-bottom: 16px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.history-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.history-title {
  margin: 0;
  font-size: 18px;
}

.history-sub {
  font-size: 13px;
  color: var(--muted);
}

.history-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
}

.history-count {
  margin-left: auto;
  font-size: 13px;
  color: var(--muted);
}

.compare-card {
  padding: 14px 16px;
}

.compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  margin: 0;
  font-size: 16px;
}

.compare-table-wrap {
  overflow-x: auto;
}

.compare-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.compare-table th,
.compare-table td {
  border: 1px solid rgba(0, 0, 0, 0.06);
  padding: 10px 12px;
  text-align: center;
  vertical-align: middle;
}

.compare-table .metric-col {
  min-width: 96px;
  text-align: left;
  font-weight: 600;
  background: rgba(64, 158, 255, 0.05);
  position: sticky;
  left: 0;
  z-index: 1;
}

.compare-table .value-col {
  min-width: 140px;
}

.compare-col-head {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.compare-stock {
  font-weight: 700;
}

.compare-code,
.compare-time {
  font-size: 12px;
  color: var(--muted);
}

.highlight-warn {
  color: #e67e22;
  font-weight: 700;
}

.history-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

.list-card,
.detail-card {
  padding: 12px 14px;
  min-height: 420px;
}

.detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.stock-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stock-name {
  font-weight: 600;
}

.stock-code {
  font-size: 12px;
  color: var(--muted);
}

.suggest-name {
  margin-right: 8px;
}

.suggest-code {
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 1100px) {
  .history-layout {
    grid-template-columns: 1fr;
  }
}
</style>
