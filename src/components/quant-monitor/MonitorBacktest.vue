<template>
  <div class="monitor-backtest">
    <div class="toolbar glass-card">
      <el-select
        v-model="strategyId"
        filterable
        placeholder="选择盯盘策略"
        style="width: 280px"
      >
        <el-option
          v-for="s in strategies"
          :key="s.id"
          :label="`${s.name} (${s.strategy_type || '条件'})`"
          :value="s.id"
        />
      </el-select>
      <el-input v-model="code" placeholder="股票代码（可空=策略首标的）" style="width: 200px" clearable />
      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始"
        end-placeholder="结束"
        style="width: 260px"
      />
      <el-button type="primary" :loading="running" :disabled="!strategyId" @click="run">
        运行回测
      </el-button>
      <el-button :loading="loading" @click="loadStrategies">刷新策略</el-button>
    </div>

    <div v-if="result" class="glass-card result-card">
      <div class="card-head">
        <h3>回测结果 · {{ selectedName }} · {{ usedCode }}</h3>
      </div>
      <div class="metrics-grid">
        <div class="metric">
          <span class="label">总收益</span>
          <span class="value" :class="pctClass(m.total_return)">{{ formatPct(m.total_return) }}</span>
        </div>
        <div class="metric">
          <span class="label">年化</span>
          <span class="value" :class="pctClass(m.annualized_return)">{{ formatPct(m.annualized_return) }}</span>
        </div>
        <div class="metric">
          <span class="label">最大回撤</span>
          <span class="value down">{{ formatPct(m.max_drawdown) }}</span>
        </div>
        <div class="metric">
          <span class="label">夏普</span>
          <span class="value">{{ m.sharpe_ratio ?? '—' }}</span>
        </div>
        <div class="metric">
          <span class="label">胜率</span>
          <span class="value">{{ formatPct(m.win_rate) }}</span>
        </div>
        <div class="metric">
          <span class="label">期末权益</span>
          <span class="value">¥{{ formatMoney(m.final_equity) }}</span>
        </div>
      </div>
      <el-alert
        v-if="!payloadStrategyType"
        type="warning"
        :closable="false"
        title="该策略未映射预置 strategy_type，回测可能不可用；请在策略编辑中补充映射。"
        style="margin-top: 12px"
      />
    </div>
    <el-empty v-else description="选择策略后运行回测，验证上线前表现" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { backtestQuantMonitorStrategy, getQuantMonitorStrategies } from '../../api'

const strategies = ref([])
const loading = ref(false)
const running = ref(false)
const strategyId = ref(null)
const code = ref('')
const dateRange = ref([])
const result = ref(null)
const usedCode = ref('')
const payloadStrategyType = ref('')

const selectedName = computed(() => {
  return strategies.value.find((s) => s.id === strategyId.value)?.name || ''
})

const m = computed(() => result.value?.metrics || {})

function formatPct(v) {
  if (v == null || Number.isNaN(Number(v))) return '—'
  return `${(Number(v) * (Math.abs(Number(v)) <= 1 ? 100 : 1)).toFixed(2)}%`
}

function formatMoney(v) {
  if (v == null) return '—'
  return Number(v).toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function pctClass(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return ''
  return n >= 0 ? 'up' : 'down'
}

async function loadStrategies() {
  loading.value = true
  try {
    const { data } = await getQuantMonitorStrategies()
    strategies.value = data.list || []
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function run() {
  running.value = true
  result.value = null
  try {
    const payload = {
      code: code.value.trim() || undefined,
      start_date: dateRange.value?.[0],
      end_date: dateRange.value?.[1],
    }
    const { data } = await backtestQuantMonitorStrategy(strategyId.value, payload)
    usedCode.value = data.code
    payloadStrategyType.value = data.strategy?.strategy_type || ''
    result.value = data.result || {}
    ElMessage.success('回测完成')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '回测失败')
  } finally {
    running.value = false
  }
}

onMounted(loadStrategies)
defineExpose({ refresh: loadStrategies })
</script>

<style scoped>
.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px 16px;
  margin-bottom: 12px;
  align-items: center;
}

.result-card {
  padding: 16px 18px;
}

.card-head h3 {
  margin: 0 0 14px;
  font-size: 15px;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

.metric {
  padding: 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric .label {
  font-size: 12px;
  color: var(--muted);
}

.metric .value {
  font-size: 18px;
  font-weight: 600;
}

.metric .value.up { color: #cf1322; }
.metric .value.down { color: #389e0d; }

@media (max-width: 720px) {
  .metrics-grid { grid-template-columns: 1fr 1fr; }
}
</style>
