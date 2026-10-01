<template>
  <div class="gold-forge-panel">
    <GoldForgeHistory
      v-if="showHistory"
      :initial-code="form.code"
      @back="showHistory = false"
      @apply="onApplyFromHistory"
    />

    <template v-else>
      <div class="panel-head">
        <p class="panel-subtitle">8 模块流水线 · 数据准备 → 分析推理 → 策略生成 · 机构级投资决策支持</p>
        <el-button round @click="showHistory = true">
          <el-icon><Clock /></el-icon>
          分析历史
        </el-button>
      </div>

      <div class="layout-grid">
        <div class="glass-card config-card">
          <h3 class="section-title">分析配置</h3>
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

            <el-form-item label="风险偏好">
              <el-radio-group v-model="form.riskProfile">
                <el-radio-button value="conservative">保守</el-radio-button>
                <el-radio-button value="moderate">稳健</el-radio-button>
                <el-radio-button value="aggressive">激进</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="总资产">
              <el-input-number v-model="form.totalAssets" :min="10000" :step="10000" controls-position="right" style="width: 100%" />
            </el-form-item>

            <el-form-item label="持仓成本">
              <el-input-number v-model="form.costPrice" :min="0" :precision="2" controls-position="right" style="width: 100%" />
            </el-form-item>

            <el-form-item label="持仓股数">
              <el-input-number v-model="form.quantity" :min="0" :step="100" controls-position="right" style="width: 100%" />
            </el-form-item>

            <el-form-item label="仓位占比">
              <el-input-number v-model="form.positionRatio" :min="0" :max="100" :precision="1" controls-position="right" style="width: 100%" />
              <span class="field-hint">%，占账户总资产</span>
            </el-form-item>

            <el-alert v-if="memorySummary" :title="memorySummary" type="info" show-icon :closable="false" class="memory-alert" />

            <el-form-item>
              <el-button type="primary" round :loading="running" @click="onAnalyze">
                <el-icon><MagicStick /></el-icon>
                启动铸金台分析
              </el-button>
            </el-form-item>
          </el-form>

          <div v-if="moduleDefs.length" class="module-steps">
            <div
              v-for="m in moduleDefs"
              :key="m.id"
              class="module-step"
              :class="{ done: moduleDone(m.id), active: running && !moduleDone(m.id) }"
            >
              <span class="step-id">{{ m.id.toUpperCase() }}</span>
              <span class="step-name">{{ m.name }}</span>
            </div>
          </div>
        </div>

        <GoldForgeResultPanel
          :result="result"
          :loading="running"
          empty-text="配置股票与持仓信息后，点击「启动铸金台分析」"
        />
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getGoldForgeMemory,
  getGoldForgeMeta,
  getGoldForgeSession,
  getStockSuggest,
  runGoldForgeAnalyze,
} from '../api'
import GoldForgeHistory from '../components/GoldForgeHistory.vue'
import GoldForgeResultPanel from '../components/GoldForgeResultPanel.vue'
import { sessionToResult } from '../utils/goldForgeSession'

const running = ref(false)
const showHistory = ref(false)
const result = ref(null)
const moduleDefs = ref([])
const memorySummary = ref('')

const form = reactive({
  code: '000001',
  riskProfile: 'moderate',
  totalAssets: 200000,
  costPrice: null,
  quantity: null,
  positionRatio: null,
})

function moduleDone(id) {
  if (!result.value?.modules) return false
  return !!result.value.modules[id]
}

async function querySuggest(query, cb) {
  const q = (query || '').trim()
  if (!q) { cb([]); return }
  try {
    const { data } = await getStockSuggest(q)
    cb((data || []).map((item) => ({ ...item, label: `${item.name} (${item.code})` })))
  } catch {
    cb([])
  }
}

function onSelectStock(item) {
  form.code = item.code
  loadMemory()
}

async function loadMemory() {
  if (!form.code.trim()) return
  try {
    const { data } = await getGoldForgeMemory(form.code.trim())
    memorySummary.value = data.summary || ''
  } catch {
    memorySummary.value = ''
  }
}

async function onAnalyze() {
  if (!form.code.trim()) {
    ElMessage.warning('请输入股票代码或名称')
    return
  }
  running.value = true
  result.value = null
  try {
    const { data } = await runGoldForgeAnalyze({
      code: form.code.trim(),
      risk_profile: form.riskProfile,
      total_assets: form.totalAssets,
      cost_price: form.costPrice || undefined,
      quantity: form.quantity || undefined,
      position_ratio: form.positionRatio || undefined,
    })
    result.value = data
    if (data.s_resonance_alert) {
      ElMessage.warning('检测到 S 级时空共振信号，请关注方案详情')
    }
    ElMessage.success('铸金台分析完成')
    await loadMemory()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '分析失败')
  } finally {
    running.value = false
  }
}

async function onApplyFromHistory(row) {
  if (!row?.id) return
  showHistory.value = false
  running.value = true
  try {
    const { data } = await getGoldForgeSession(row.id)
    form.code = data.stock_code || form.code
    form.riskProfile = data.risk_profile || form.riskProfile
    form.totalAssets = data.total_assets ?? form.totalAssets
    form.costPrice = data.cost_price ?? null
    form.quantity = data.quantity ?? null
    form.positionRatio = data.position_ratio ?? null
    result.value = sessionToResult(data)
    await loadMemory()
    ElMessage.success('已载入历史分析')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '载入失败')
  } finally {
    running.value = false
  }
}

onMounted(async () => {
  try {
    const { data } = await getGoldForgeMeta()
    moduleDefs.value = data.modules || []
  } catch { /* ignore */ }
  await loadMemory()
})
</script>

<style scoped>
.gold-forge-panel { padding: 0 0 8px; }
.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.panel-subtitle { margin: 0; font-size: 13px; color: var(--muted); flex: 1; }
.layout-grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; align-items: start; }
@media (max-width: 960px) { .layout-grid { grid-template-columns: 1fr; } }
.section-title { margin: 0 0 12px; font-size: 16px; }
.config-card { padding: 16px 20px; }
.field-hint { font-size: 12px; color: var(--muted); margin-left: 8px; }
.memory-alert { margin-bottom: 12px; }
.module-steps { margin-top: 16px; display: flex; flex-direction: column; gap: 6px; }
.module-step { display: flex; gap: 8px; font-size: 12px; padding: 6px 8px; border-radius: 6px; color: var(--muted); }
.module-step.done { color: var(--primary); background: rgba(64, 158, 255, 0.08); }
.step-id { font-weight: 700; min-width: 28px; }
.suggest-name { margin-right: 8px; }
.suggest-code { color: var(--muted); font-size: 12px; }
</style>
