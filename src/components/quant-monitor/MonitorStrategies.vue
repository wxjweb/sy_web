<template>
  <div class="monitor-strategies">
    <div class="toolbar glass-card">
      <div class="toolbar-left">
        <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 120px" @change="refresh">
          <el-option v-for="s in statuses" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="categoryFilter" clearable placeholder="分类" style="width: 140px" @change="refresh">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
        <el-button :loading="scanning" @click="scanAll">扫描全部</el-button>
      </div>
      <div class="toolbar-right">
        <el-button :disabled="!selectedIds.length" @click="batchStatus('running')">批量启动</el-button>
        <el-button :disabled="!selectedIds.length" @click="batchStatus('paused')">批量暂停</el-button>
        <el-button type="primary" @click="openCreate">新建策略</el-button>
      </div>
    </div>

    <div v-if="!hideTemplates && templates.length" class="templates glass-card">
      <div class="section-title">模板库（{{ templates.length }}）</div>
      <el-tabs v-model="tplTab">
        <el-tab-pane
          v-for="cat in templateCategories"
          :key="cat"
          :label="cat"
          :name="cat"
        >
          <div class="tpl-row">
            <button
              v-for="tpl in templatesByCat(cat)"
              :key="tpl.id"
              type="button"
              class="tpl-card"
              @click="applyTemplate(tpl)"
            >
              <div class="tpl-name">{{ tpl.name }}</div>
              <div class="tpl-desc">{{ tpl.description }}</div>
            </button>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <div v-loading="loading" class="strategy-grid">
      <div v-for="item in list" :key="item.id" class="glass-card strategy-card">
        <div class="card-top">
          <el-checkbox
            :model-value="selectedIds.includes(item.id)"
            @change="(v) => toggleSelect(item.id, v)"
          />
          <div class="card-title">
            <strong>{{ item.name }}</strong>
            <el-tag size="small" :type="statusType(item.status)">{{ statusLabel(item.status) }}</el-tag>
            <el-tag v-if="item.category" size="small" effect="plain">{{ item.category }}</el-tag>
          </div>
        </div>
        <div class="meta">
          <span>{{ item.build_mode === 'conditions' ? '条件' : '模板' }}</span>
          <span>{{ item.data_period }}</span>
          <span>标的 {{ item.target_mode === 'watchlist' ? '自选' : item.target_count }}</span>
          <span>今日 {{ item.today_signal_count }}</span>
          <span>运行 {{ item.run_days || 0 }} 天</span>
        </div>
        <div class="meta muted">
          最后触发：{{ item.last_triggered_at ? formatTime(item.last_triggered_at) : '—' }}
        </div>
        <div class="targets">
          <el-tag v-for="t in (item.targets || []).slice(0, 4)" :key="t.code" size="small" effect="plain">
            {{ t.name || t.code }}
          </el-tag>
          <span v-if="(item.targets || []).length > 4" class="more">+{{ item.targets.length - 4 }}</span>
        </div>
        <div class="actions">
          <el-button v-if="item.status !== 'running'" size="small" type="success" @click="doAction(item.id, 'start')">启动</el-button>
          <el-button v-if="item.status === 'running'" size="small" type="warning" @click="doAction(item.id, 'pause')">暂停</el-button>
          <el-button size="small" @click="doAction(item.id, 'scan')">扫描</el-button>
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" @click="openLogs(item)">日志</el-button>
          <el-button size="small" @click="doAction(item.id, 'copy')">复制</el-button>
          <el-button size="small" @click="doAction(item.id, 'archive')">归档</el-button>
          <el-button size="small" type="danger" text @click="onDelete(item)">删除</el-button>
        </div>
      </div>
      <el-empty v-if="!loading && !list.length" description="暂无策略，可从模板一键创建" />
    </div>

    <StrategyWizard
      v-model:visible="wizardVisible"
      :editing-id="editingId"
      :initial="editingInitial"
      :templates="templates"
      :strategy-types="strategyTypes"
      :scan-intervals="scanIntervals"
      :data-periods="dataPeriods"
      :condition-nodes="conditionNodes"
      :categories="categories"
      @saved="refresh"
    />

    <el-drawer v-model="logsVisible" :title="`运行日志 · ${logsTitle}`" size="480px">
      <el-button size="small" :loading="logsLoading" @click="loadLogs" style="margin-bottom: 10px">刷新</el-button>
      <div v-loading="logsLoading" class="logs">
        <div v-for="log in logs" :key="log.id" class="log-row" :class="log.level">
          <div class="log-meta">
            <el-tag size="small" :type="logLevelType(log.level)">{{ log.level }}</el-tag>
            <span>{{ log.event }}</span>
            <span class="muted">{{ formatTime(log.created_at) }}</span>
          </div>
          <div class="log-msg">{{ log.message }}</div>
        </div>
        <el-empty v-if="!logsLoading && !logs.length" description="暂无日志" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  actionQuantMonitorStrategy,
  batchQuantMonitorStrategies,
  deleteQuantMonitorStrategy,
  getQuantMonitorMeta,
  getQuantMonitorStrategies,
  getQuantMonitorStrategyLogs,
  scanQuantMonitor,
} from '../../api'
import StrategyWizard from './StrategyWizard.vue'
import { formatMonitorTime } from '../../utils/monitorTime'

defineProps({
  fishMode: Boolean,
  hideTemplates: { type: Boolean, default: false },
})

const list = ref([])
const loading = ref(false)
const scanning = ref(false)
const statusFilter = ref('')
const categoryFilter = ref('')
const selectedIds = ref([])
const templates = ref([])
const strategyTypes = ref([])
const scanIntervals = ref([])
const dataPeriods = ref([])
const conditionNodes = ref([])
const statuses = ref([])
const categories = ref([])
const wizardVisible = ref(false)
const editingId = ref(null)
const editingInitial = ref(null)
const tplTab = ref('')
const logsVisible = ref(false)
const logsLoading = ref(false)
const logs = ref([])
const logsStrategyId = ref(null)
const logsTitle = ref('')

const templateCategories = computed(() => {
  const set = new Set(templates.value.map((t) => t.category || '其他'))
  return [...set]
})

function templatesByCat(cat) {
  return templates.value.filter((t) => (t.category || '其他') === cat)
}

function statusLabel(s) {
  return statuses.value.find((i) => i.value === s)?.label || s
}

function statusType(s) {
  if (s === 'running') return 'success'
  if (s === 'paused') return 'warning'
  if (s === 'archived') return 'info'
  if (s === 'stopped') return 'info'
  return ''
}

function logLevelType(level) {
  if (level === 'error') return 'danger'
  if (level === 'warn') return 'warning'
  return 'info'
}

function formatTime(iso) {
  return formatMonitorTime(iso)
}

function openCreate() {
  editingId.value = null
  editingInitial.value = null
  wizardVisible.value = true
}

function applyTemplate(tpl) {
  editingId.value = null
  editingInitial.value = {
    name: tpl.name,
    strategy_type: tpl.strategy_type,
    build_mode: tpl.build_mode || 'template',
    template_id: tpl.id,
    category: tpl.category,
    condition_tree: tpl.condition_tree,
    params: { ...(tpl.params || {}) },
    data_period: tpl.data_period || 'day',
    min_confidence: tpl.min_confidence ?? 60,
    targets: [],
    target_mode: 'manual',
  }
  wizardVisible.value = true
}

function openEdit(item) {
  editingId.value = item.id
  editingInitial.value = { ...item }
  wizardVisible.value = true
}

function toggleSelect(id, checked) {
  if (checked) {
    if (!selectedIds.value.includes(id)) selectedIds.value.push(id)
  } else {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  }
}

async function refresh() {
  loading.value = true
  try {
    const params = {}
    if (statusFilter.value) params.status = statusFilter.value
    if (categoryFilter.value) params.category = categoryFilter.value
    const { data } = await getQuantMonitorStrategies(params)
    list.value = data.list || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  const { data } = await getQuantMonitorMeta()
  templates.value = data.templates || []
  strategyTypes.value = data.strategy_types || []
  scanIntervals.value = data.scan_intervals || []
  dataPeriods.value = data.data_periods || []
  conditionNodes.value = data.condition_nodes || []
  statuses.value = data.statuses || []
  categories.value = data.categories || []
  if (templateCategories.value.length) tplTab.value = templateCategories.value[0]
}

async function openLogs(item) {
  logsStrategyId.value = item.id
  logsTitle.value = item.name
  logsVisible.value = true
  await loadLogs()
}

async function loadLogs() {
  if (!logsStrategyId.value) return
  logsLoading.value = true
  try {
    const { data } = await getQuantMonitorStrategyLogs(logsStrategyId.value, { limit: 100 })
    logs.value = data.list || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载日志失败')
  } finally {
    logsLoading.value = false
  }
}

async function doAction(id, action) {
  try {
    const { data } = await actionQuantMonitorStrategy(id, action)
    if (action === 'scan') {
      ElMessage.success(`扫描完成，新信号 ${(data.signals || []).length} 条`)
    } else {
      ElMessage.success('操作成功')
    }
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '操作失败')
  }
}

async function batchStatus(status) {
  try {
    await batchQuantMonitorStrategies({ ids: selectedIds.value, status })
    ElMessage.success('批量操作完成')
    selectedIds.value = []
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '批量操作失败')
  }
}

async function onDelete(item) {
  await ElMessageBox.confirm(`确认删除策略「${item.name}」？相关信号也会删除。`, '删除确认', {
    type: 'warning',
  })
  await deleteQuantMonitorStrategy(item.id)
  ElMessage.success('已删除')
  await refresh()
}

async function scanAll() {
  scanning.value = true
  try {
    const { data } = await scanQuantMonitor()
    ElMessage.success(`扫描完成：新信号 ${data.new_signals || 0}`)
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

onMounted(async () => {
  await loadMeta()
  await refresh()
})

defineExpose({ refresh })
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.toolbar-left, .toolbar-right {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.templates {
  padding: 14px 16px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 6px;
}

.tpl-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding-top: 8px;
}

.tpl-card {
  text-align: left;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.5);
  cursor: pointer;
}

.tpl-card:hover { border-color: #5b8ff9; }
.tpl-name { font-weight: 600; font-size: 13px; }
.tpl-desc { margin-top: 6px; font-size: 12px; color: var(--muted); line-height: 1.4; }

.strategy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 120px;
}

.strategy-card { padding: 14px 16px; }

.card-top {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.card-title {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.meta {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
}

.meta.muted { margin-top: 4px; }

.targets {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.more { font-size: 12px; color: var(--muted); }

.actions {
  margin-top: 12px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.log-row {
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.log-meta {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  margin-bottom: 4px;
}

.log-msg { font-size: 13px; }
.muted { color: var(--muted); }

@media (max-width: 960px) {
  .tpl-row { grid-template-columns: 1fr 1fr; }
}
</style>
