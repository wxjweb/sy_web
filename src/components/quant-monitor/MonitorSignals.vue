<template>
  <div class="monitor-signals">
    <SignalStatsPanel ref="statsRef" />

    <div class="toolbar glass-card">
      <el-input
        v-model="filters.q"
        clearable
        placeholder="股票名称或代码"
        style="width: 180px"
        @keyup.enter="search"
      />
      <el-select v-model="filters.signal_type" clearable placeholder="信号类型" style="width: 120px">
        <el-option label="买入" value="buy" />
        <el-option label="卖出" value="sell" />
      </el-select>
      <el-select v-model="filters.strategy_id" clearable placeholder="策略" style="width: 180px" filterable>
        <el-option v-for="s in strategies" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始"
        end-placeholder="结束"
        style="width: 260px"
      />
      <div class="conf-filter">
        <span>强度 ≥</span>
        <el-slider v-model="filters.min_confidence" :min="0" :max="100" style="width: 140px" />
        <span>{{ filters.min_confidence }}</span>
      </div>
      <el-select v-model="filters.order" style="width: 120px">
        <el-option label="时间倒序" value="desc" />
        <el-option label="时间正序" value="asc" />
        <el-option label="强度倒序" value="confidence" />
      </el-select>
      <el-checkbox v-model="filters.favorited">仅收藏</el-checkbox>
      <el-checkbox v-model="filters.hide_ghost">隐藏幽灵</el-checkbox>
      <el-radio-group v-model="viewMode" size="small">
        <el-radio-button label="table">列表</el-radio-button>
        <el-radio-button label="card">卡片</el-radio-button>
      </el-radio-group>
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="exportCsv">导出 CSV</el-button>
    </div>

    <div class="stats glass-card">
      共 <strong>{{ total }}</strong> 条 ·
      买入 <strong class="buy">{{ buyCount }}</strong> ·
      卖出 <strong class="sell">{{ sellCount }}</strong>
      <span v-if="total">（买入占比 {{ buyRatio }}%）</span>
    </div>

    <div v-if="viewMode === 'table'" class="glass-card table-card">
      <el-table v-loading="loading" :data="list" stripe @row-click="openDetail">
        <el-table-column type="index" width="50" label="#" />
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ formatTime(row.triggered_at) }}</template>
        </el-table-column>
        <el-table-column label="信号" width="80">
          <template #default="{ row }">
            <span :class="row.signal_type">{{ row.signal_label }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="stock_name" label="名称" min-width="100" />
        <el-table-column prop="stock_code" label="代码" width="90" />
        <el-table-column prop="strategy_name" label="策略" min-width="120" />
        <el-table-column label="价格" width="90">
          <template #default="{ row }">¥{{ row.price }}</template>
        </el-table-column>
        <el-table-column label="涨跌" width="80">
          <template #default="{ row }">{{ row.change_pct }}%</template>
        </el-table-column>
        <el-table-column label="强度" width="80">
          <template #default="{ row }">
            <span :class="confClass(row.confidence)">{{ row.confidence }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标记" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.is_ghost" size="small" type="info">幽灵</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click.stop="toggleFav(row)">
              {{ row.favorited ? '取消收藏' : '收藏' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>

    <div v-else v-loading="loading" class="card-grid">
      <div
        v-for="row in list"
        :key="row.id"
        class="glass-card sig-card"
        :class="row.signal_type"
        @click="openDetail(row)"
      >
        <div class="sig-card-top">
          <strong>{{ row.stock_name }} {{ row.stock_code }}</strong>
          <span :class="row.signal_type">{{ row.signal_label }}</span>
        </div>
        <div class="sig-card-meta">
          ¥{{ row.price }} · 强度 {{ row.confidence }} · {{ formatTime(row.triggered_at) }}
        </div>
        <div class="sig-card-meta muted">{{ row.strategy_name }}</div>
      </div>
      <el-empty v-if="!loading && !list.length" description="暂无信号" />
      <div class="pager" style="grid-column: 1 / -1">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="total, prev, pager, next"
          :total="total"
          @current-change="load"
        />
      </div>
    </div>

    <el-drawer v-model="detailVisible" title="信号详情" size="460px">
      <template v-if="detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="股票">{{ detail.stock_name }} {{ detail.stock_code }}</el-descriptions-item>
          <el-descriptions-item label="信号">{{ detail.signal_label }}</el-descriptions-item>
          <el-descriptions-item label="策略">{{ detail.strategy_name }}</el-descriptions-item>
          <el-descriptions-item label="时间">{{ formatTime(detail.triggered_at) }}</el-descriptions-item>
          <el-descriptions-item label="价格">¥{{ detail.price }}</el-descriptions-item>
          <el-descriptions-item label="涨跌幅">{{ detail.change_pct }}%</el-descriptions-item>
          <el-descriptions-item label="强度">{{ detail.confidence }}%</el-descriptions-item>
          <el-descriptions-item label="幽灵信号">{{ detail.is_ghost ? '是' : '否' }}</el-descriptions-item>
          <el-descriptions-item label="推送">{{ detail.push_status }} · {{ (detail.push_channels || []).join(',') || '—' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.note || '—' }}</el-descriptions-item>
        </el-descriptions>
        <h4 class="ind-title">条件明细</h4>
        <pre class="ind-pre">{{ JSON.stringify(detail.conditions_met || [], null, 2) }}</pre>
        <h4 class="ind-title">指标快照</h4>
        <pre class="ind-pre">{{ JSON.stringify(detail.indicators || {}, null, 2) }}</pre>
        <h4 v-if="(timeline || []).length" class="ind-title">同股时间线</h4>
        <div v-for="t in timeline" :key="t.id" class="tl-row" :class="t.signal_type">
          {{ formatTime(t.triggered_at) }} · {{ t.signal_label }} · ¥{{ t.price }} · {{ t.confidence }}%
        </div>
        <el-input
          v-model="tagInput"
          placeholder="添加标签后回车"
          style="margin-top: 12px"
          @keyup.enter="addTag"
        />
        <div class="tags">
          <el-tag
            v-for="t in detail.tags || []"
            :key="t"
            closable
            @close="removeTag(t)"
          >{{ t }}</el-tag>
        </div>
        <el-button style="margin-top: 12px" @click="copyDetail">复制关键信息</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  exportQuantMonitorSignalsUrl,
  getQuantMonitorSignal,
  getQuantMonitorSignals,
  getQuantMonitorStrategies,
  updateQuantMonitorSignal,
} from '../../api'
import SignalStatsPanel from './SignalStatsPanel.vue'
import { formatMonitorTime } from '../../utils/monitorTime'

defineProps({ fishMode: Boolean })

const list = ref([])
const strategies = ref([])
const loading = ref(false)
const total = ref(0)
const buyCount = ref(0)
const sellCount = ref(0)
const page = ref(1)
const pageSize = ref(20)
const dateRange = ref(null)
const detailVisible = ref(false)
const detail = ref(null)
const timeline = ref([])
const tagInput = ref('')
const viewMode = ref('table')
const statsRef = ref(null)

const filters = reactive({
  q: '',
  signal_type: '',
  strategy_id: null,
  order: 'desc',
  favorited: false,
  hide_ghost: false,
  min_confidence: 0,
})

const buyRatio = computed(() => {
  if (!total.value) return 0
  return Math.round((buyCount.value / total.value) * 100)
})

function formatTime(iso) {
  return formatMonitorTime(iso)
}

function confClass(c) {
  if (c >= 80) return 'buy'
  if (c >= 60) return ''
  return 'muted'
}

function buildParams() {
  const params = {
    page: page.value,
    page_size: pageSize.value,
    order: filters.order,
  }
  if (filters.q) params.q = filters.q
  if (filters.signal_type) params.signal_type = filters.signal_type
  if (filters.strategy_id) params.strategy_id = filters.strategy_id
  if (filters.favorited) params.favorited = '1'
  if (filters.hide_ghost) params.hide_ghost = '1'
  if (filters.min_confidence > 0) params.min_confidence = filters.min_confidence
  if (dateRange.value?.length === 2) {
    params.start_date = dateRange.value[0]
    params.end_date = dateRange.value[1]
  }
  return params
}

async function load() {
  loading.value = true
  try {
    const { data } = await getQuantMonitorSignals(buildParams())
    list.value = data.list || []
    total.value = data.total || 0
    buyCount.value = data.buy_count || 0
    sellCount.value = data.sell_count || 0
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function search() {
  page.value = 1
  load()
  statsRef.value?.refresh?.()
}

function exportCsv() {
  window.open(exportQuantMonitorSignalsUrl(buildParams()), '_blank')
}

async function openDetail(row) {
  try {
    const { data } = await getQuantMonitorSignal(row.id)
    detail.value = data
    timeline.value = data.stock_timeline || data.timeline || []
  } catch {
    detail.value = { ...row }
    timeline.value = []
  }
  detailVisible.value = true
}

async function toggleFav(row) {
  const { data } = await updateQuantMonitorSignal(row.id, { favorited: !row.favorited })
  row.favorited = data.favorited
  if (detail.value?.id === row.id) detail.value.favorited = data.favorited
}

async function addTag() {
  const t = tagInput.value.trim()
  if (!t || !detail.value) return
  const tags = [...(detail.value.tags || [])]
  if (!tags.includes(t)) tags.push(t)
  const { data } = await updateQuantMonitorSignal(detail.value.id, { tags })
  detail.value = data
  tagInput.value = ''
  await load()
}

async function removeTag(t) {
  const tags = (detail.value.tags || []).filter((x) => x !== t)
  const { data } = await updateQuantMonitorSignal(detail.value.id, { tags })
  detail.value = data
  await load()
}

async function copyDetail() {
  if (!detail.value) return
  const text = [
    detail.value.stock_name,
    detail.value.stock_code,
    detail.value.signal_label,
    `¥${detail.value.price}`,
    detail.value.strategy_name,
    formatTime(detail.value.triggered_at),
  ].join(' ')
  await navigator.clipboard.writeText(text)
  ElMessage.success('已复制')
}

onMounted(async () => {
  try {
    const { data } = await getQuantMonitorStrategies()
    strategies.value = data.list || []
  } catch {
    /* ignore */
  }
  await load()
})

defineExpose({ refresh: load })
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  padding: 12px 16px;
  margin-bottom: 12px;
  align-items: center;
}

.conf-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
}

.stats {
  padding: 10px 16px;
  margin-bottom: 12px;
  font-size: 13px;
}

.buy { color: #c45656; }
.sell { color: #389e0d; }
.muted { color: var(--muted); }

.table-card { padding: 8px 12px 16px; }

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.sig-card {
  padding: 14px;
  cursor: pointer;
}

.sig-card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.sig-card-meta {
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
}

.ind-title { margin: 16px 0 8px; font-size: 14px; }
.ind-pre {
  background: rgba(0, 0, 0, 0.04);
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  overflow: auto;
  max-height: 180px;
}

.tl-row {
  font-size: 12px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.tags {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
