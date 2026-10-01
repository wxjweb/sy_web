<template>
  <div class="strategy-manage">
    <div class="toolbar glass-card">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索策略名称"
          style="width: 200px"
          @clear="refresh"
          @keyup.enter="refresh"
        />
        <el-select v-model="statusFilter" clearable placeholder="状态" style="width: 120px" @change="refresh">
          <el-option v-for="s in statuses" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="sourceFilter" clearable placeholder="来源" style="width: 120px" @change="refresh">
          <el-option label="来自模板" value="template" />
          <el-option label="自定义" value="custom" />
        </el-select>
        <el-select v-model="orderFilter" placeholder="排序" style="width: 130px" @change="refresh">
          <el-option v-for="o in strategyOrders" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button @click="advVisible = true">高级筛选</el-button>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
        <el-radio-group v-model="viewMode" size="small" class="view-mode">
          <el-radio-button label="table">表格</el-radio-button>
          <el-radio-button label="card">卡片</el-radio-button>
        </el-radio-group>
      </div>
      <div class="toolbar-right">
        <el-button :disabled="!selectedIds.length" @click="batchStatus('running')">批量启动</el-button>
        <el-button :disabled="!selectedIds.length" @click="batchStatus('paused')">批量暂停</el-button>
        <el-button :disabled="!selectedIds.length" @click="batchStatus('stopped')">批量停止</el-button>
        <el-button :disabled="!selectedIds.length" type="danger" plain @click="batchDelete">批量删除</el-button>
        <el-dropdown trigger="click" @command="onCreateCommand">
          <el-button type="primary">新建策略</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="blank">空白创建</el-dropdown-item>
              <el-dropdown-item command="template">从模板创建</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <div v-if="viewMode === 'table'" class="glass-card table-wrap" v-loading="loading">
      <el-table
        :data="list"
        row-key="id"
        style="width: 100%"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="44" />
        <el-table-column prop="name" label="策略名称" min-width="160">
          <template #default="{ row }">
            <div class="name-cell">
              <strong>{{ row.name }}</strong>
              <span class="muted source">{{ row.source_label || '自定义' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="条件摘要" min-width="180">
          <template #default="{ row }">
            <span class="summary">{{ row.summary || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="标的" width="120">
          <template #default="{ row }">
            {{ row.target_mode === 'watchlist' ? '自选股' : `${row.target_count || 0} 只` }}
          </template>
        </el-table-column>
        <el-table-column label="今日信号" width="90" align="center">
          <template #default="{ row }">
            <el-button v-if="row.today_signal_count" link type="primary" @click="goSignals(row)">
              {{ row.today_signal_count }}
            </el-button>
            <span v-else>0</span>
          </template>
        </el-table-column>
        <el-table-column label="最后触发" width="150">
          <template #default="{ row }">
            {{ row.last_triggered_at ? formatTime(row.last_triggered_at) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status !== 'running'"
              size="small"
              type="success"
              link
              @click="doAction(row.id, 'start')"
            >
              启动
            </el-button>
            <el-button
              v-if="row.status === 'running'"
              size="small"
              type="warning"
              link
              @click="doAction(row.id, 'pause')"
            >
              暂停
            </el-button>
            <el-button size="small" link @click="openEdit(row)">编辑</el-button>
            <el-button size="small" link @click="doAction(row.id, 'copy')">复制</el-button>
            <el-button size="small" link @click="openSaveAsTemplate(row)">另存模板</el-button>
            <el-dropdown trigger="click" @command="(cmd) => onMore(row, cmd)">
              <el-button size="small" link>更多</el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="scan">立即扫描</el-dropdown-item>
                  <el-dropdown-item command="signals">查看信号</el-dropdown-item>
                  <el-dropdown-item command="stop">停止</el-dropdown-item>
                  <el-dropdown-item command="archive">归档</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" description="暂无策略，可从模板一键创建" />
    </div>

    <div v-else v-loading="loading" class="strategy-grid">
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
        <div class="muted source-line">{{ item.source_label || '自定义' }}</div>
        <div class="card-summary">{{ item.summary || '未配置条件' }}</div>
        <div class="meta">
          <span>{{ item.data_period || 'day' }}</span>
          <span>标的 {{ item.target_mode === 'watchlist' ? '自选' : item.target_count || 0 }}</span>
          <span>
            今日
            <el-button v-if="item.today_signal_count" link type="primary" @click="goSignals(item)">
              {{ item.today_signal_count }}
            </el-button>
            <template v-else> 0</template>
          </span>
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
          <el-button
            v-if="item.status !== 'running'"
            size="small"
            type="success"
            @click="doAction(item.id, 'start')"
          >
            启动
          </el-button>
          <el-button
            v-if="item.status === 'running'"
            size="small"
            type="warning"
            @click="doAction(item.id, 'pause')"
          >
            暂停
          </el-button>
          <el-button size="small" @click="openEdit(item)">编辑</el-button>
          <el-button size="small" @click="doAction(item.id, 'copy')">复制</el-button>
          <el-button size="small" @click="openSaveAsTemplate(item)">另存模板</el-button>
          <el-dropdown trigger="click" @command="(cmd) => onMore(item, cmd)">
            <el-button size="small">更多</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="scan">立即扫描</el-dropdown-item>
                <el-dropdown-item command="signals">查看信号</el-dropdown-item>
                <el-dropdown-item command="stop">停止</el-dropdown-item>
                <el-dropdown-item command="archive">归档</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
      <el-empty v-if="!loading && !list.length" description="暂无策略，可从模板一键创建" />
    </div>

    <StrategyWizard
      v-model:visible="wizardVisible"
      :editing-id="editingId"
      :initial="editingInitial"
      :templates="wizardTemplates"
      :strategy-types="strategyTypes"
      :scan-intervals="scanIntervals"
      :data-periods="dataPeriods"
      :condition-nodes="conditionNodes"
      :categories="wizardCategories"
      @saved="refresh"
    />

    <el-dialog v-model="fromTplVisible" title="从模板创建策略" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="选择模板" required>
          <el-select v-model="fromTplId" filterable style="width: 100%" placeholder="官方或自定义模板">
            <el-option-group v-if="presetOptions.length" label="官方预置">
              <el-option v-for="t in presetOptions" :key="t.id" :label="t.name" :value="t.id" />
            </el-option-group>
            <el-option-group v-if="customOptions.length" label="我的模板">
              <el-option v-for="t in customOptions" :key="t.id" :label="t.name" :value="t.id" />
            </el-option-group>
          </el-select>
        </el-form-item>
        <el-form-item label="策略名称">
          <el-input v-model="fromTplName" placeholder="留空则自动生成" />
        </el-form-item>
        <el-form-item label="标的模式">
          <el-radio-group v-model="fromTplTargetMode">
            <el-radio-button label="manual">手动选择</el-radio-button>
            <el-radio-button label="watchlist">自选股</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="fromTplTargetMode === 'manual'" label="绑定股票">
          <el-autocomplete
            v-model="suggestQ"
            :fetch-suggestions="querySuggest"
            placeholder="输入代码或名称"
            style="width: 100%"
            value-key="label"
            @select="addTarget"
          />
          <div>
            <el-tag
              v-for="t in fromTplTargets"
              :key="t.code"
              closable
              style="margin: 6px 6px 0 0"
              @close="fromTplTargets = fromTplTargets.filter((x) => x.code !== t.code)"
            >
              {{ t.name || t.code }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="fromTplVisible = false">取消</el-button>
        <el-button type="primary" :loading="fromTplSubmitting" @click="submitFromTemplate">创建</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="advVisible" title="高级筛选" size="380px">
      <el-form label-width="100px">
        <el-form-item label="分类">
          <el-select v-model="categoryFilter" clearable style="width: 100%" placeholder="全部">
            <el-option v-for="c in qsCategories" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="今日信号">
          <el-select v-model="hasSignals" clearable style="width: 100%" placeholder="全部">
            <el-option label="有信号" value="true" />
            <el-option label="无信号" value="false" />
          </el-select>
        </el-form-item>
        <el-form-item label="创建起">
          <el-date-picker v-model="dateFrom" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="创建止">
          <el-date-picker v-model="dateTo" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="orderFilter" style="width: 100%">
            <el-option v-for="o in strategyOrders" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="adv-actions">
        <el-button @click="resetAdvanced">重置</el-button>
        <el-button type="primary" @click="applyAdvanced">应用</el-button>
      </div>
    </el-drawer>

    <el-dialog v-model="saveTplVisible" title="另存为模板" width="480px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="模板名称" required>
          <el-input v-model="saveTplForm.name" maxlength="20" show-word-limit />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="saveTplForm.category" style="width: 100%">
            <el-option v-for="c in qsCategories" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="saveTplForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="覆盖同名">
          <el-switch v-model="saveTplForm.overwrite" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="saveTplVisible = false">取消</el-button>
        <el-button type="primary" :loading="saveTplSubmitting" @click="submitSaveAsTemplate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  actionQuantStrategy,
  batchQuantStrategies,
  deleteQuantStrategy,
  getQuantMonitorMeta,
  getQuantStrategyList,
  getQuantStrategyMeta,
  getQuantStrategyTemplates,
  getStockSuggest,
  saveQuantStrategyAsTemplate,
  useQuantStrategyTemplate,
} from '../../api'
import StrategyWizard from '../quant-monitor/StrategyWizard.vue'
import { formatMonitorTime } from '../../utils/monitorTime'

const VIEW_KEY = 'quant-strategy-manage-view'
const router = useRouter()

function readViewMode() {
  const v = localStorage.getItem(VIEW_KEY)
  return v === 'card' || v === 'table' ? v : 'table'
}

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const sourceFilter = ref('')
const orderFilter = ref('updated_desc')
const categoryFilter = ref('')
const hasSignals = ref('')
const dateFrom = ref('')
const dateTo = ref('')
const advVisible = ref(false)
const viewMode = ref(readViewMode())
const selectedIds = ref([])

watch(viewMode, (v) => {
  localStorage.setItem(VIEW_KEY, v)
  selectedIds.value = []
})
const statuses = ref([])
const strategyTypes = ref([])
const scanIntervals = ref([])
const dataPeriods = ref([])
const conditionNodes = ref([])
const wizardCategories = ref([])
const wizardTemplates = ref([])
const qsCategories = ref([])
const strategyOrders = ref([
  { value: 'updated_desc', label: '最近更新' },
  { value: 'created_desc', label: '最近创建' },
  { value: 'created_asc', label: '最早创建' },
  { value: 'trigger_desc', label: '最近触发' },
  { value: 'trigger_asc', label: '最早触发' },
  { value: 'signals_desc', label: '今日信号多' },
])

const wizardVisible = ref(false)
const editingId = ref(null)
const editingInitial = ref(null)

const fromTplVisible = ref(false)
const fromTplSubmitting = ref(false)
const fromTplId = ref(null)
const fromTplName = ref('')
const fromTplTargetMode = ref('manual')
const fromTplTargets = ref([])
const suggestQ = ref('')
const presetOptions = ref([])
const customOptions = ref([])

const saveTplVisible = ref(false)
const saveTplSubmitting = ref(false)
const saveTplStrategyId = ref(null)
const saveTplForm = reactive({
  name: '',
  category: '趋势跟踪',
  description: '',
  overwrite: false,
})

function statusLabel(s) {
  return statuses.value.find((i) => i.value === s)?.label || s
}

function statusType(s) {
  if (s === 'running') return 'success'
  if (s === 'paused') return 'warning'
  if (s === 'archived' || s === 'stopped') return 'info'
  return ''
}

function formatTime(iso) {
  return formatMonitorTime(iso)
}

function onSelectionChange(rows) {
  selectedIds.value = rows.map((r) => r.id)
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
    const params = { order: orderFilter.value || 'updated_desc' }
    if (keyword.value) params.q = keyword.value
    if (statusFilter.value) params.status = statusFilter.value
    if (sourceFilter.value) params.source = sourceFilter.value
    if (categoryFilter.value) params.category = categoryFilter.value
    if (hasSignals.value !== '' && hasSignals.value != null) params.has_signals = hasSignals.value
    if (dateFrom.value) params.date_from = dateFrom.value
    if (dateTo.value) params.date_to = dateTo.value
    const { data } = await getQuantStrategyList(params)
    list.value = data.list || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function resetAdvanced() {
  categoryFilter.value = ''
  hasSignals.value = ''
  dateFrom.value = ''
  dateTo.value = ''
  orderFilter.value = 'updated_desc'
  refresh()
}

function applyAdvanced() {
  advVisible.value = false
  refresh()
}

async function loadMeta() {
  const [monitorRes, qsRes] = await Promise.all([getQuantMonitorMeta(), getQuantStrategyMeta()])
  const data = monitorRes.data || {}
  statuses.value = data.statuses || [
    { value: 'draft', label: '草稿' },
    { value: 'running', label: '运行中' },
    { value: 'paused', label: '已暂停' },
    { value: 'stopped', label: '已停止' },
    { value: 'archived', label: '已归档' },
  ]
  strategyTypes.value = data.strategy_types || []
  scanIntervals.value = data.scan_intervals || []
  dataPeriods.value = data.data_periods || []
  conditionNodes.value = data.condition_nodes || []
  wizardCategories.value = data.categories || []
  wizardTemplates.value = data.templates || []
  qsCategories.value = qsRes.data?.categories || []
  if (qsRes.data?.strategy_orders?.length) strategyOrders.value = qsRes.data.strategy_orders
}

function openCreate() {
  editingId.value = null
  editingInitial.value = null
  wizardVisible.value = true
}

function openEdit(item) {
  editingId.value = item.id
  editingInitial.value = { ...item }
  wizardVisible.value = true
}

async function openFromTemplate() {
  const { data } = await getQuantStrategyTemplates()
  presetOptions.value = data.presets || []
  customOptions.value = data.customs || []
  fromTplId.value = null
  fromTplName.value = ''
  fromTplTargetMode.value = 'manual'
  fromTplTargets.value = []
  suggestQ.value = ''
  fromTplVisible.value = true
}

function onCreateCommand(cmd) {
  if (cmd === 'template') openFromTemplate()
  else openCreate()
}

async function querySuggest(q, cb) {
  if (!q) return cb([])
  try {
    const { data } = await getStockSuggest(q)
    cb(
      (data.list || data || []).map((x) => ({
        ...x,
        label: `${x.code} ${x.name || ''}`.trim(),
        value: x.code,
      })),
    )
  } catch {
    cb([])
  }
}

function addTarget(item) {
  if (fromTplTargets.value.some((t) => t.code === item.code)) return
  fromTplTargets.value.push({ code: item.code, name: item.name || item.code })
  suggestQ.value = ''
}

async function submitFromTemplate() {
  if (!fromTplId.value) {
    ElMessage.warning('请选择模板')
    return
  }
  fromTplSubmitting.value = true
  try {
    await useQuantStrategyTemplate(fromTplId.value, {
      name: fromTplName.value.trim() || undefined,
      target_mode: fromTplTargetMode.value,
      targets: fromTplTargetMode.value === 'manual' ? fromTplTargets.value : [],
      start_now: false,
    })
    ElMessage.success('策略已创建')
    fromTplVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '创建失败')
  } finally {
    fromTplSubmitting.value = false
  }
}

function openSaveAsTemplate(row) {
  saveTplStrategyId.value = row.id
  const base = `${row.name}_模板`.slice(0, 20)
  saveTplForm.name = base
  saveTplForm.category = row.category || qsCategories.value[0]?.value || '趋势跟踪'
  saveTplForm.description = row.note || ''
  saveTplForm.overwrite = false
  saveTplVisible.value = true
}

async function submitSaveAsTemplate() {
  if (!saveTplForm.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  saveTplSubmitting.value = true
  try {
    await saveQuantStrategyAsTemplate(saveTplStrategyId.value, {
      name: saveTplForm.name.trim(),
      category: saveTplForm.category,
      description: saveTplForm.description,
      overwrite: saveTplForm.overwrite,
    })
    ElMessage.success('已另存为模板')
    saveTplVisible.value = false
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '保存失败')
  } finally {
    saveTplSubmitting.value = false
  }
}

async function doAction(id, action) {
  try {
    const { data } = await actionQuantStrategy(id, action)
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
    await batchQuantStrategies({ ids: selectedIds.value, status })
    ElMessage.success('批量操作完成')
    selectedIds.value = []
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '批量操作失败')
  }
}

async function batchDelete() {
  await ElMessageBox.confirm(
    `确认删除选中的 ${selectedIds.value.length} 个策略？该操作不可恢复。`,
    '批量删除',
    { type: 'warning' },
  )
  try {
    await batchQuantStrategies({ ids: selectedIds.value, action: 'delete' })
    ElMessage.success('已批量删除')
    selectedIds.value = []
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '批量删除失败')
  }
}

function goSignals(row) {
  router.push({ path: '/stocks/quant/monitor', query: { tab: 'signals', strategy_id: String(row.id) } })
}

async function onMore(row, cmd) {
  if (cmd === 'signals') {
    goSignals(row)
    return
  }
  if (cmd === 'delete') {
    await ElMessageBox.confirm(`确认删除策略「${row.name}」？相关信号也会删除。`, '删除确认', {
      type: 'warning',
    })
    await deleteQuantStrategy(row.id)
    ElMessage.success('已删除')
    await refresh()
    return
  }
  await doAction(row.id, cmd)
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
  flex-wrap: wrap;
  padding: 12px 16px;
  margin-bottom: 14px;
}
.toolbar-left,
.toolbar-right {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.view-mode {
  margin-left: 4px;
}
.table-wrap {
  padding: 8px 12px 16px;
}
.name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.source {
  font-size: 12px;
}
.summary {
  font-size: 12px;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.muted {
  color: var(--muted);
}
.strategy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  min-height: 120px;
}
.strategy-card {
  padding: 14px 16px;
}
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
.source-line {
  margin-top: 6px;
  font-size: 12px;
  padding-left: 28px;
}
.card-summary {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.45;
  color: var(--text, #334155);
  padding-left: 28px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.meta {
  margin-top: 10px;
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
  padding-left: 28px;
}
.meta.muted {
  margin-top: 4px;
}
.targets {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-left: 28px;
}
.more {
  font-size: 12px;
  color: var(--muted);
  align-self: center;
}
.actions {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-left: 28px;
}
.adv-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
</style>
