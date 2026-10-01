<template>
  <div class="strategy-templates" v-loading="loading">
    <div class="toolbar glass-card">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          clearable
          placeholder="搜索模板名称或说明"
          style="width: 240px"
          @clear="refresh"
          @keyup.enter="refresh"
        />
        <el-select v-model="categoryFilter" clearable placeholder="分类" style="width: 140px" @change="refresh">
          <el-option v-for="c in categories" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <el-select v-model="sourceFilter" clearable placeholder="来源" style="width: 120px" @change="refresh">
          <el-option label="官方预置" value="preset" />
          <el-option label="我的模板" value="custom" />
        </el-select>
        <el-select v-model="orderFilter" placeholder="排序" style="width: 130px" @change="refresh">
          <el-option v-for="o in orders" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button @click="advVisible = true">高级筛选</el-button>
        <el-button :loading="loading" @click="refresh">刷新</el-button>
      </div>
      <div class="toolbar-right">
        <el-button @click="triggerImport">导入模板</el-button>
        <input ref="importInput" type="file" accept="application/json,.json" class="hidden-file" @change="onImportFile" />
        <el-button type="primary" @click="openCreateCustom">新建自定义模板</el-button>
      </div>
    </div>

    <div v-if="showCustoms" class="glass-card section">
      <div class="section-title">
        我的模板
        <span class="muted">（{{ customs.length }}）</span>
      </div>
      <div v-if="customs.length" class="tpl-grid">
        <div v-for="tpl in customs" :key="tpl.id" class="tpl-card custom">
          <div class="tpl-top">
            <strong @click="openDetail(tpl)">{{ tpl.name }}</strong>
            <el-tag size="small" type="success" effect="plain">自定义</el-tag>
          </div>
          <div class="tpl-desc" @click="openDetail(tpl)">{{ tpl.description || '暂无说明' }}</div>
          <div class="tpl-meta">
            <span>{{ tpl.category }}</span>
            <span>使用 {{ tpl.usage_count || 0 }} 次</span>
            <span v-if="tpl.version_count">版本 {{ tpl.version_count }}</span>
          </div>
          <div class="tpl-summary">{{ tpl.summary }}</div>
          <div class="tpl-actions">
            <el-button size="small" type="primary" @click="openUse(tpl)">使用此模板</el-button>
            <el-button size="small" @click="openEditCustom(tpl)">编辑</el-button>
            <el-button size="small" @click="onExport(tpl)">导出</el-button>
            <el-button size="small" type="danger" text @click="onDelete(tpl)">删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无自定义模板，可将策略另存为模板" :image-size="64" />
    </div>

    <div v-if="showPresets" class="glass-card section">
      <div class="section-title">
        官方预置模板
        <span class="muted">（{{ presets.length }}）</span>
      </div>
      <el-tabs v-if="presetCats.length" v-model="presetTab">
        <el-tab-pane v-for="cat in presetCats" :key="cat" :label="cat" :name="cat">
          <div class="tpl-grid">
            <div v-for="tpl in presetsByCat(cat)" :key="tpl.id" class="tpl-card">
              <div class="tpl-top">
                <strong @click="openDetail(tpl)">{{ tpl.name }}</strong>
                <el-tag size="small" type="warning" effect="dark">官方</el-tag>
              </div>
              <div class="tpl-desc" @click="openDetail(tpl)">{{ tpl.description || '暂无说明' }}</div>
              <div class="tpl-meta">
                <span>{{ tpl.preset_icon || tpl.category }}</span>
                <span>使用 {{ tpl.usage_count || 0 }} 次</span>
              </div>
              <div class="tpl-summary">{{ tpl.summary }}</div>
              <div class="tpl-actions">
                <el-button size="small" type="primary" @click="openUse(tpl)">使用此模板</el-button>
                <el-button size="small" @click="openDetail(tpl)">查看</el-button>
                <el-button size="small" @click="onExport(tpl)">导出</el-button>
              </div>
            </div>
          </div>
          <el-empty v-if="!presetsByCat(cat).length" description="该分类下暂无模板" :image-size="64" />
        </el-tab-pane>
      </el-tabs>
      <el-empty v-else description="暂无预置模板" :image-size="72" />
    </div>

    <el-drawer v-model="detailVisible" :title="detail?.name || '模板详情'" size="460px">
      <template v-if="detail">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="分类">{{ detail.category }}</el-descriptions-item>
          <el-descriptions-item label="来源">
            {{ detail.is_preset ? '官方预置' : '自定义' }}
          </el-descriptions-item>
          <el-descriptions-item label="说明">{{ detail.description || '—' }}</el-descriptions-item>
          <el-descriptions-item label="条件摘要">{{ detail.summary }}</el-descriptions-item>
          <el-descriptions-item label="使用次数">{{ detail.usage_count || 0 }}</el-descriptions-item>
          <el-descriptions-item label="关联策略">{{ detail.related_strategy_count || 0 }}</el-descriptions-item>
        </el-descriptions>
        <div class="drawer-actions">
          <el-button type="primary" @click="openUse(detail)">使用此模板</el-button>
          <el-button @click="onExport(detail)">导出分享</el-button>
        </div>
        <div v-if="detail.related_strategies?.length" class="related">
          <div class="section-title" style="margin-top: 16px">关联策略</div>
          <div v-for="s in detail.related_strategies" :key="s.id" class="related-row">
            <span>{{ s.name }}</span>
            <el-tag size="small">{{ s.status }}</el-tag>
          </div>
        </div>
        <div v-if="!detail.is_preset" class="versions">
          <div class="section-title" style="margin-top: 16px">
            历史版本
            <span class="muted">（编辑时自动快照）</span>
          </div>
          <div v-if="detail.versions?.length">
            <div v-for="v in detail.versions" :key="v.id" class="version-row">
              <div>
                <strong>v{{ v.version }}</strong>
                <span class="muted"> · {{ formatShort(v.created_at) }}</span>
                <div class="version-note">{{ v.note || v.summary }}</div>
              </div>
              <el-button size="small" :loading="rollbackingId === v.id" @click="onRollback(v)">回滚</el-button>
            </div>
          </div>
          <el-empty v-else description="暂无历史版本" :image-size="48" />
        </div>
      </template>
    </el-drawer>

    <el-drawer v-model="advVisible" title="高级筛选" size="360px">
      <el-form label-width="100px">
        <el-form-item label="最少使用">
          <el-input-number v-model="minUsage" :min="0" :max="9999" controls-position="right" />
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="orderFilter" style="width: 100%">
            <el-option v-for="o in orders" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <div class="drawer-actions">
        <el-button @click="resetAdvanced">重置</el-button>
        <el-button type="primary" @click="applyAdvanced">应用</el-button>
      </div>
    </el-drawer>

    <el-dialog v-model="useVisible" title="使用模板创建策略" width="520px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="策略名称" required>
          <el-input v-model="useForm.name" maxlength="50" show-word-limit />
        </el-form-item>
        <el-form-item label="标的模式">
          <el-radio-group v-model="useForm.target_mode">
            <el-radio-button label="manual">手动选择</el-radio-button>
            <el-radio-button label="watchlist">自选股</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="useForm.target_mode === 'manual'" label="绑定股票">
          <el-autocomplete
            v-model="suggestQ"
            :fetch-suggestions="querySuggest"
            placeholder="输入代码或名称"
            style="width: 100%"
            value-key="label"
            @select="addTarget"
          />
          <div class="target-tags">
            <el-tag
              v-for="t in useForm.targets"
              :key="t.code"
              closable
              style="margin: 6px 6px 0 0"
              @close="removeTarget(t.code)"
            >
              {{ t.name || t.code }}
            </el-tag>
          </div>
        </el-form-item>
        <el-form-item label="创建后启动">
          <el-switch v-model="useForm.start_now" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="useVisible = false">取消</el-button>
        <el-button type="primary" :loading="useSubmitting" @click="submitUse">创建策略</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="customVisible"
      :title="customEditingId ? '编辑自定义模板' : '新建自定义模板'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item label="名称" required>
          <el-input v-model="customForm.name" maxlength="20" show-word-limit placeholder="不超过 20 字" />
        </el-form-item>
        <el-form-item label="分类" required>
          <el-select v-model="customForm.category" style="width: 100%">
            <el-option v-for="c in categories" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="customForm.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="策略类型">
          <el-input v-model="customForm.strategy_type" placeholder="如 macd / dual_ma / rsi" />
        </el-form-item>
        <el-form-item label="条件树 JSON">
          <el-input
            v-model="customForm.condition_tree_json"
            type="textarea"
            :rows="6"
            placeholder='{"op":"OR","children":[...]}'
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="customVisible = false">取消</el-button>
        <el-button type="primary" :loading="customSubmitting" @click="submitCustom">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createQuantStrategyTemplate,
  deleteQuantStrategyTemplate,
  exportQuantStrategyTemplate,
  getQuantStrategyMeta,
  getQuantStrategyTemplate,
  getQuantStrategyTemplates,
  getStockSuggest,
  importQuantStrategyTemplate,
  rollbackQuantStrategyTemplateVersion,
  updateQuantStrategyTemplate,
  useQuantStrategyTemplate,
} from '../../api'
import { formatMonitorTime } from '../../utils/monitorTime'

const emit = defineEmits(['applied'])

const loading = ref(false)
const keyword = ref('')
const categoryFilter = ref('')
const sourceFilter = ref('')
const orderFilter = ref('updated_desc')
const minUsage = ref(null)
const orders = ref([
  { value: 'updated_desc', label: '最近更新' },
  { value: 'usage_desc', label: '使用最多' },
  { value: 'name_asc', label: '名称 A-Z' },
  { value: 'created_desc', label: '最近创建' },
])
const categories = ref([])
const presets = ref([])
const customs = ref([])
const presetTab = ref('')
const advVisible = ref(false)
const importInput = ref(null)
const rollbackingId = ref(null)

const detailVisible = ref(false)
const detail = ref(null)

const useVisible = ref(false)
const useSubmitting = ref(false)
const useTpl = ref(null)
const suggestQ = ref('')
const useForm = reactive({
  name: '',
  target_mode: 'manual',
  targets: [],
  start_now: false,
})

const customVisible = ref(false)
const customSubmitting = ref(false)
const customEditingId = ref(null)
const customForm = reactive({
  name: '',
  category: '趋势跟踪',
  description: '',
  strategy_type: '',
  condition_tree_json: '{\n  "op": "OR",\n  "children": []\n}',
})

const showPresets = computed(() => sourceFilter.value !== 'custom')
const showCustoms = computed(() => sourceFilter.value !== 'preset')
const presetCats = computed(() => {
  const set = new Set(presets.value.map((t) => t.category || '其他'))
  return [...set]
})

function presetsByCat(cat) {
  return presets.value.filter((t) => (t.category || '其他') === cat)
}

function formatShort(iso) {
  return formatMonitorTime(iso)
}

async function refresh() {
  loading.value = true
  try {
    const params = { order: orderFilter.value || 'updated_desc' }
    if (keyword.value) params.q = keyword.value
    if (categoryFilter.value) params.category = categoryFilter.value
    if (sourceFilter.value) params.source = sourceFilter.value
    if (minUsage.value != null && minUsage.value !== '') params.min_usage = minUsage.value
    const { data } = await getQuantStrategyTemplates(params)
    presets.value = data.presets || []
    customs.value = data.customs || []
    if (presetCats.value.length && !presetCats.value.includes(presetTab.value)) {
      presetTab.value = presetCats.value[0]
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function loadMeta() {
  const { data } = await getQuantStrategyMeta()
  categories.value = data.categories || []
  if (data.orders?.length) orders.value = data.orders
}

function resetAdvanced() {
  minUsage.value = null
  orderFilter.value = 'updated_desc'
  refresh()
}

function applyAdvanced() {
  advVisible.value = false
  refresh()
}

async function onExport(tpl) {
  try {
    const { data } = await exportQuantStrategyTemplate(tpl.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `strategy-template-${tpl.name || tpl.id}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已导出分享文件')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '导出失败')
  }
}

function triggerImport() {
  importInput.value?.click()
}

async function onImportFile(ev) {
  const file = ev.target?.files?.[0]
  ev.target.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const json = JSON.parse(text)
    await importQuantStrategyTemplate(json)
    ElMessage.success('模板已导入到「我的模板」')
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '导入失败')
  }
}

async function onRollback(v) {
  if (!detail.value) return
  await ElMessageBox.confirm(
    `确认回滚到 v${v.version}？当前配置会先自动快照。`,
    '回滚确认',
    { type: 'warning' },
  )
  rollbackingId.value = v.id
  try {
    await rollbackQuantStrategyTemplateVersion(detail.value.id, v.id)
    ElMessage.success('已回滚')
    const { data } = await getQuantStrategyTemplate(detail.value.id)
    detail.value = data
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '回滚失败')
  } finally {
    rollbackingId.value = null
  }
}

async function openDetail(tpl) {
  try {
    const { data } = await getQuantStrategyTemplate(tpl.id)
    detail.value = data
    detailVisible.value = true
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载详情失败')
  }
}

function openUse(tpl) {
  useTpl.value = tpl
  const today = new Date()
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  useForm.name = `${tpl.name}_我的策略_${md}`
  useForm.target_mode = 'manual'
  useForm.targets = []
  useForm.start_now = false
  suggestQ.value = ''
  useVisible.value = true
}

async function querySuggest(q, cb) {
  if (!q || q.length < 1) return cb([])
  try {
    const { data } = await getStockSuggest(q)
    const list = (data.list || data || []).map((x) => ({
      ...x,
      label: `${x.code} ${x.name || ''}`.trim(),
      value: x.code,
    }))
    cb(list)
  } catch {
    cb([])
  }
}

function addTarget(item) {
  if (useForm.targets.some((t) => t.code === item.code)) return
  useForm.targets.push({ code: item.code, name: item.name || item.code })
  suggestQ.value = ''
}

function removeTarget(code) {
  useForm.targets = useForm.targets.filter((t) => t.code !== code)
}

async function submitUse() {
  if (!useTpl.value) return
  if (!useForm.name.trim()) {
    ElMessage.warning('请输入策略名称')
    return
  }
  if (useForm.start_now && useForm.target_mode === 'manual' && !useForm.targets.length) {
    ElMessage.warning('启动前请至少绑定一只股票')
    return
  }
  useSubmitting.value = true
  try {
    await useQuantStrategyTemplate(useTpl.value.id, {
      name: useForm.name.trim(),
      target_mode: useForm.target_mode,
      targets: useForm.target_mode === 'manual' ? useForm.targets : [],
      start_now: useForm.start_now,
    })
    ElMessage.success(useForm.start_now ? '策略已创建并启动' : '策略已创建（草稿）')
    useVisible.value = false
    detailVisible.value = false
    emit('applied')
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '创建失败')
  } finally {
    useSubmitting.value = false
  }
}

function openCreateCustom() {
  customEditingId.value = null
  customForm.name = ''
  customForm.category = categories.value[0]?.value || '趋势跟踪'
  customForm.description = ''
  customForm.strategy_type = ''
  customForm.condition_tree_json = '{\n  "op": "OR",\n  "children": []\n}'
  customVisible.value = true
}

function openEditCustom(tpl) {
  customEditingId.value = tpl.id
  customForm.name = tpl.name
  customForm.category = tpl.category
  customForm.description = tpl.description || ''
  customForm.strategy_type = tpl.config?.strategy_type || ''
  customForm.condition_tree_json = JSON.stringify(tpl.config?.condition_tree || {}, null, 2)
  customVisible.value = true
}

async function submitCustom() {
  if (!customForm.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  let tree
  try {
    tree = JSON.parse(customForm.condition_tree_json || '{}')
  } catch {
    ElMessage.warning('条件树 JSON 格式不正确')
    return
  }
  customSubmitting.value = true
  try {
    const payload = {
      name: customForm.name.trim(),
      category: customForm.category,
      description: customForm.description,
      strategy_type: customForm.strategy_type,
      build_mode: 'conditions',
      condition_tree: tree,
    }
    if (customEditingId.value) {
      await updateQuantStrategyTemplate(customEditingId.value, payload)
      ElMessage.success('模板已更新（不影响已创建策略）')
    } else {
      await createQuantStrategyTemplate(payload)
      ElMessage.success('自定义模板已创建')
    }
    customVisible.value = false
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '保存失败')
  } finally {
    customSubmitting.value = false
  }
}

async function onDelete(tpl) {
  await ElMessageBox.confirm(
    `确认删除自定义模板「${tpl.name}」？已从该模板创建的策略不受影响。`,
    '删除确认',
    { type: 'warning' },
  )
  try {
    await deleteQuantStrategyTemplate(tpl.id)
    ElMessage.success('已删除')
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '删除失败')
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
.section {
  padding: 14px 16px 18px;
  margin-bottom: 14px;
}
.section-title {
  font-weight: 600;
  margin-bottom: 12px;
}
.muted {
  color: var(--muted);
  font-weight: 400;
  font-size: 13px;
}
.tpl-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.tpl-card {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--card-bg, rgba(255, 255, 255, 0.55));
  text-align: left;
}
.tpl-card.custom {
  border-color: rgba(34, 197, 94, 0.35);
}
.tpl-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}
.tpl-top strong {
  cursor: pointer;
}
.tpl-desc {
  font-size: 13px;
  color: var(--muted);
  min-height: 36px;
  cursor: pointer;
  margin-bottom: 8px;
}
.tpl-meta {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}
.tpl-summary {
  font-size: 12px;
  line-height: 1.4;
  margin-bottom: 10px;
  color: var(--text, #334155);
}
.tpl-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.related-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border, #eee);
  font-size: 13px;
}
.target-tags {
  width: 100%;
}
.drawer-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  flex-wrap: wrap;
}
.version-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  padding: 10px 0;
  border-bottom: 1px solid var(--border, #eee);
  font-size: 13px;
}
.version-note {
  margin-top: 4px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
}
.hidden-file {
  display: none;
}
</style>
