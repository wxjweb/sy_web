<template>
  <el-dialog
    :model-value="visible"
    :title="editingId ? '编辑策略' : '新建策略向导'"
    width="720px"
    destroy-on-close
    @close="$emit('update:visible', false)"
  >
    <el-steps :active="step" finish-status="success" align-center style="margin-bottom: 16px">
      <el-step title="模板/条件" />
      <el-step title="参数" />
      <el-step title="标的" />
      <el-step title="确认" />
    </el-steps>

    <div class="summary-bar">
      <span class="summary-label">条件摘要</span>
      <span>{{ conditionSummary }}</span>
    </div>

    <div v-show="step === 0">
      <el-radio-group v-model="form.build_mode" style="margin-bottom: 12px">
        <el-radio-button label="template">模板 / 预置策略</el-radio-button>
        <el-radio-button label="conditions">条件拼接</el-radio-button>
      </el-radio-group>

      <template v-if="form.build_mode === 'template'">
        <el-form label-width="100px">
          <el-form-item label="选择模板">
            <el-select
              v-model="form.template_id"
              clearable
              filterable
              placeholder="可选，一键套用"
              style="width: 100%"
              @change="onTemplatePick"
            >
              <el-option-group
                v-for="cat in templateGroups"
                :key="cat.name"
                :label="cat.name"
              >
                <el-option
                  v-for="t in cat.items"
                  :key="t.id"
                  :label="t.name"
                  :value="t.id"
                />
              </el-option-group>
            </el-select>
          </el-form-item>
          <el-form-item label="策略类型" required>
            <el-select v-model="form.strategy_type" style="width: 100%" filterable @change="onTypeChange">
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
          </el-form-item>
        </el-form>
      </template>

      <template v-else>
        <ConditionBuilder v-model="form.condition_tree" :node-types="conditionNodes" />
        <el-form label-width="100px" style="margin-top: 12px">
          <el-form-item label="映射策略类型">
            <el-select v-model="form.strategy_type" clearable filterable style="width: 100%" placeholder="回测需要">
              <el-option
                v-for="s in strategyTypes"
                :key="s.id"
                :label="s.name"
                :value="s.id"
              />
            </el-select>
          </el-form-item>
        </el-form>
      </template>
    </div>

    <div v-show="step === 1">
      <el-form label-width="110px">
        <el-form-item label="策略名称" required>
          <el-input v-model="form.name" placeholder="例如：MACD金叉盯盘" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" clearable style="width: 100%">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="paramPresetOptions.length" label="常用参数">
          <el-select
            placeholder="一键填充常用参数组合"
            clearable
            style="width: 100%"
            @change="applyParamPreset"
          >
            <el-option
              v-for="opt in paramPresetOptions"
              :key="opt.label"
              :label="opt.label"
              :value="opt.label"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-for="p in currentParamDefs"
          :key="p.key"
          :label="p.label"
        >
          <el-input-number
            v-model="form.params[p.key]"
            :min="p.min"
            :max="p.max"
            :step="p.step || 1"
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="数据周期">
          <el-select v-model="form.data_period" style="width: 100%">
            <el-option
              v-for="opt in dataPeriods"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="最低置信度">
          <el-slider v-model="form.min_confidence" :min="0" :max="100" show-input />
        </el-form-item>
        <el-form-item label="扫描频率">
          <el-select v-model="form.scan_interval_sec" style="width: 100%">
            <el-option
              v-for="opt in scanIntervals"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="冷却(分钟)">
          <el-input-number v-model="form.cooldown_minutes" :min="0" :max="1440" />
        </el-form-item>
        <el-form-item label="每日上限">
          <el-input-number v-model="form.daily_signal_limit" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="生效时段">
          <div class="time-row">
            <el-input v-model="form.active_start" placeholder="09:30" style="width: 120px" />
            <span>—</span>
            <el-input v-model="form.active_end" placeholder="15:00" style="width: 120px" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div v-show="step === 2">
      <el-form label-width="110px">
        <el-form-item label="标的来源">
          <el-radio-group v-model="form.target_mode">
            <el-radio label="manual">手动绑定</el-radio>
            <el-radio label="watchlist">自选股</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.target_mode === 'manual'" label="绑定标的" required>
          <el-autocomplete
            v-model="stockQuery"
            :fetch-suggestions="querySuggest"
            clearable
            placeholder="输入股票名称或代码后回车添加"
            style="width: 100%"
            value-key="label"
            @select="onSelectStock"
            @keyup.enter="addStockByQuery"
          />
          <div class="target-tags">
            <el-tag
              v-for="t in form.targets"
              :key="t.code"
              closable
              @close="removeTarget(t.code)"
            >
              {{ t.name }} {{ t.code }}
            </el-tag>
          </div>
        </el-form-item>
        <el-alert
          v-else
          type="info"
          :closable="false"
          title="将使用当前自选股列表作为监控标的"
        />
      </el-form>
    </div>

    <div v-show="step === 3">
      <el-descriptions :column="1" border>
        <el-descriptions-item label="名称">{{ form.name || '—' }}</el-descriptions-item>
        <el-descriptions-item label="条件摘要">{{ conditionSummary }}</el-descriptions-item>
        <el-descriptions-item label="模式">
          {{ form.build_mode === 'conditions' ? '条件拼接' : '模板/预置' }}
        </el-descriptions-item>
        <el-descriptions-item label="类型">{{ form.strategy_type || '—' }}</el-descriptions-item>
        <el-descriptions-item label="周期">{{ form.data_period }}</el-descriptions-item>
        <el-descriptions-item label="最低置信度">{{ form.min_confidence }}%</el-descriptions-item>
        <el-descriptions-item label="标的">
          {{ form.target_mode === 'watchlist' ? '自选股' : `${form.targets.length} 只` }}
        </el-descriptions-item>
      </el-descriptions>
      <el-form-item label="创建后启动" style="margin-top: 16px">
        <el-switch v-model="form.start_now" />
      </el-form-item>
    </div>

    <template #footer>
      <el-button v-if="step > 0" @click="step -= 1">上一步</el-button>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button v-if="step < 3" type="primary" @click="nextStep">下一步</el-button>
      <el-button v-else type="primary" :loading="saving" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createQuantMonitorStrategy,
  getStockSuggest,
  updateQuantMonitorStrategy,
} from '../../api'
import { summarizeConditionTree } from '../../utils/conditionSummary'
import ConditionBuilder from './ConditionBuilder.vue'

const PARAM_PRESETS = {
  macd: [
    { label: '经典 (12,26,9)', params: { fast: 12, slow: 26, signal: 9 } },
    { label: '灵敏 (5,35,5)', params: { fast: 5, slow: 35, signal: 5 } },
    { label: '稳健 (19,39,9)', params: { fast: 19, slow: 39, signal: 9 } },
  ],
  dual_ma: [
    { label: '短线 MA5/MA20', params: { fast: 5, slow: 20 } },
    { label: '中线 MA10/MA60', params: { fast: 10, slow: 60 } },
  ],
  rsi: [
    { label: '经典周期 14', params: { period: 14 } },
    { label: '短线周期 6', params: { period: 6 } },
  ],
  kdj: [{ label: '经典 (9,3,3)', params: { n: 9, m1: 3, m2: 3 } }],
  boll: [{ label: '经典 (20,2)', params: { period: 20, std: 2 } }],
}

const props = defineProps({
  visible: Boolean,
  editingId: { type: [Number, null], default: null },
  initial: { type: Object, default: null },
  templates: { type: Array, default: () => [] },
  strategyTypes: { type: Array, default: () => [] },
  scanIntervals: { type: Array, default: () => [] },
  dataPeriods: { type: Array, default: () => [] },
  conditionNodes: { type: Array, default: () => [] },
  categories: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:visible', 'saved'])

const step = ref(0)
const saving = ref(false)
const stockQuery = ref('')

const form = reactive({
  name: '',
  strategy_type: 'macd',
  build_mode: 'template',
  template_id: '',
  category: '',
  condition_tree: { op: 'AND', children: [] },
  params: {},
  targets: [],
  target_mode: 'manual',
  data_period: 'day',
  min_confidence: 60,
  scan_interval_sec: 60,
  active_start: '09:30',
  active_end: '15:00',
  cooldown_minutes: 30,
  daily_signal_limit: 10,
  start_now: true,
})

const strategyGroups = computed(() => {
  const map = {}
  for (const s of props.strategyTypes) {
    const cat = s.category || '其他'
    if (!map[cat]) map[cat] = []
    map[cat].push(s)
  }
  return Object.entries(map).map(([category, items]) => ({ category, items }))
})

const templateGroups = computed(() => {
  const map = {}
  for (const t of props.templates) {
    const cat = t.category || '其他'
    if (!map[cat]) map[cat] = []
    map[cat].push(t)
  }
  return Object.entries(map).map(([name, items]) => ({ name, items }))
})

const currentParamDefs = computed(() => {
  const found = props.strategyTypes.find((s) => s.id === form.strategy_type)
  return found?.params || []
})

const conditionSummary = computed(() => summarizeConditionTree(form.condition_tree))

const paramPresetOptions = computed(() => {
  const key = String(form.strategy_type || '')
  return PARAM_PRESETS[key] || []
})

function applyParamPreset(label) {
  const opt = paramPresetOptions.value.find((x) => x.label === label)
  if (!opt) return
  form.params = { ...form.params, ...opt.params }
  ElMessage.success(`已填充：${opt.label}`)
}

function resetForm() {
  Object.assign(form, {
    name: '',
    strategy_type: 'macd',
    build_mode: 'template',
    template_id: '',
    category: '',
    condition_tree: { op: 'AND', children: [] },
    params: {},
    targets: [],
    target_mode: 'manual',
    data_period: 'day',
    min_confidence: 60,
    scan_interval_sec: 60,
    active_start: '09:30',
    active_end: '15:00',
    cooldown_minutes: 30,
    daily_signal_limit: 10,
    start_now: true,
  })
  onTypeChange('macd')
  step.value = 0
}

function onTypeChange(id) {
  const found = props.strategyTypes.find((s) => s.id === id)
  const params = {}
  for (const p of found?.params || []) {
    params[p.key] = p.default
  }
  form.params = params
}

function onTemplatePick(id) {
  const tpl = props.templates.find((t) => t.id === id)
  if (!tpl) return
  form.name = tpl.name
  form.category = tpl.category || ''
  form.strategy_type = tpl.strategy_type || form.strategy_type
  form.build_mode = tpl.build_mode || 'template'
  form.params = { ...(tpl.params || {}) }
  if (tpl.condition_tree) form.condition_tree = JSON.parse(JSON.stringify(tpl.condition_tree))
  if (tpl.data_period) form.data_period = tpl.data_period
  if (tpl.min_confidence != null) form.min_confidence = tpl.min_confidence
}

watch(
  () => props.visible,
  (v) => {
    if (!v) return
    if (props.initial) {
      resetForm()
      Object.assign(form, {
        name: props.initial.name || '',
        strategy_type: props.initial.strategy_type || 'macd',
        build_mode: props.initial.build_mode || 'template',
        template_id: props.initial.template_id || '',
        category: props.initial.category || '',
        condition_tree: props.initial.condition_tree?.op
          ? JSON.parse(JSON.stringify(props.initial.condition_tree))
          : { op: 'AND', children: [] },
        params: { ...(props.initial.params || {}) },
        targets: [...(props.initial.targets || [])],
        target_mode: props.initial.target_mode || 'manual',
        data_period: props.initial.data_period || 'day',
        min_confidence: props.initial.min_confidence ?? 60,
        scan_interval_sec: props.initial.scan_interval_sec || 60,
        active_start: props.initial.active_start || '09:30',
        active_end: props.initial.active_end || '15:00',
        cooldown_minutes: props.initial.cooldown_minutes ?? 30,
        daily_signal_limit: props.initial.daily_signal_limit ?? 10,
        start_now: props.initial.status === 'running',
      })
      step.value = 0
    } else {
      resetForm()
    }
  },
)

function nextStep() {
  if (step.value === 0) {
    if (form.build_mode === 'template' && !form.strategy_type) {
      return ElMessage.warning('请选择策略类型')
    }
    if (form.build_mode === 'conditions' && !(form.condition_tree?.children || []).length) {
      return ElMessage.warning('请添加至少一个条件')
    }
  }
  if (step.value === 1 && !form.name.trim()) {
    return ElMessage.warning('请输入策略名称')
  }
  if (step.value === 2 && form.target_mode === 'manual' && !form.targets.length) {
    return ElMessage.warning('请绑定至少一只股票')
  }
  step.value += 1
}

async function querySuggest(query, cb) {
  const q = String(query || '').trim()
  if (!q) return cb([])
  try {
    const { data } = await getStockSuggest(q)
    const items = Array.isArray(data) ? data : (data.list || [])
    cb(items.map((i) => ({ ...i, label: `${i.name} ${i.code}` })))
  } catch {
    cb([])
  }
}

function onSelectStock(item) {
  addTarget({ code: item.code, name: item.name, market: item.market })
  stockQuery.value = ''
}

function addStockByQuery() {
  const q = stockQuery.value.trim()
  if (!q) return
  addTarget({ code: q, name: q })
  stockQuery.value = ''
}

function addTarget(t) {
  if (!t.code) return
  if (form.targets.some((x) => x.code === t.code)) return
  form.targets.push(t)
}

function removeTarget(code) {
  form.targets = form.targets.filter((t) => t.code !== code)
}

async function submit() {
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      strategy_type: form.strategy_type || '',
      build_mode: form.build_mode,
      template_id: form.template_id || '',
      category: form.category || '',
      condition_tree: form.build_mode === 'conditions' ? form.condition_tree : {},
      params: form.params,
      targets: form.target_mode === 'manual' ? form.targets : [],
      target_mode: form.target_mode,
      data_period: form.data_period,
      min_confidence: form.min_confidence,
      scan_interval_sec: form.scan_interval_sec,
      active_start: form.active_start,
      active_end: form.active_end,
      cooldown_minutes: form.cooldown_minutes,
      daily_signal_limit: form.daily_signal_limit,
      status: form.start_now ? 'running' : 'draft',
    }
    if (props.editingId) {
      await updateQuantMonitorStrategy(props.editingId, payload)
      ElMessage.success('已更新')
    } else {
      await createQuantMonitorStrategy(payload)
      ElMessage.success('已创建')
    }
    emit('update:visible', false)
    emit('saved')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.summary-bar {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(91, 143, 249, 0.08);
  border: 1px solid rgba(91, 143, 249, 0.2);
  font-size: 13px;
  line-height: 1.5;
  color: var(--text, #334155);
}
.summary-label {
  font-weight: 600;
  margin-right: 8px;
  color: #3b6fd9;
}
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.target-tags {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
