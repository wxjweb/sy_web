<template>
  <div class="monitor-dashboard">
    <div class="stat-row">
      <div class="glass-card stat-card">
        <div class="stat-label">{{ fishMode ? '今日入项' : '今日买入' }}</div>
        <div class="stat-value buy">{{ data.today_buy || 0 }}</div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-label">{{ fishMode ? '今日出项' : '今日卖出' }}</div>
        <div class="stat-value sell">{{ data.today_sell || 0 }}</div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-label">{{ fishMode ? '活跃规则' : '活跃策略' }}</div>
        <div class="stat-value">{{ data.active_strategies || 0 }}</div>
      </div>
      <div class="glass-card stat-card">
        <div class="stat-label">{{ fishMode ? '今日合计' : '今日合计' }}</div>
        <div class="stat-value">{{ data.today_total || 0 }}</div>
      </div>
    </div>

    <div v-if="(data.indices || []).length" class="indices glass-card">
      <div v-for="idx in data.indices" :key="idx.code" class="idx-item" :class="idx.change_pct >= 0 ? 'up' : 'down'">
        <span class="idx-name">{{ fishMode ? idx.name.replace('指数', '') : idx.name }}</span>
        <span class="idx-price">{{ idx.price }}</span>
        <span class="idx-chg">{{ formatPct(idx.change_pct) }}</span>
      </div>
    </div>

    <div class="grid-2">
      <div class="glass-card">
        <div class="card-head">
          <h3>{{ fishMode ? '近 7 日趋势' : '近 7 日信号趋势' }}</h3>
          <el-button text type="primary" @click="refresh">刷新</el-button>
        </div>
        <div class="trend-bars">
          <div v-for="item in data.trend_7d || []" :key="item.date" class="trend-item">
            <div class="bar-wrap">
              <div class="bar" :style="{ height: barHeight(item.count) }" />
            </div>
            <div class="trend-count">{{ item.count }}</div>
            <div class="trend-date">{{ item.date.slice(5) }}</div>
          </div>
        </div>
      </div>

      <div class="glass-card">
        <div class="card-head">
          <h3>{{ fishMode ? '最新动态' : '最新信号' }}</h3>
          <el-button text type="primary" @click="$emit('goto', 'signals')">全部记录</el-button>
        </div>
        <div v-if="(data.latest_signals || []).length" class="signal-list">
          <div
            v-for="sig in data.latest_signals"
            :key="sig.id"
            class="signal-row"
            :class="sig.signal_type"
          >
            <span class="sig-type">{{ sigLabel(sig) }}</span>
            <span class="sig-stock">{{ sig.stock_name }} {{ sig.stock_code }}</span>
            <span class="sig-price">¥{{ sig.price }}</span>
            <span class="sig-conf">{{ sig.confidence }}%</span>
            <span class="sig-time">{{ formatTime(sig.triggered_at) }}</span>
          </div>
        </div>
        <el-empty v-else :description="fishMode ? '暂无动态' : '暂无信号，创建并启动策略后开始盯盘'" :image-size="72" />
      </div>
    </div>

    <div class="grid-2" style="margin-top: 12px">
      <div class="glass-card">
        <div class="card-head"><h3>{{ fishMode ? '规则 TOP' : '策略 TOP' }}</h3></div>
        <div v-for="item in data.strategy_top || []" :key="item.strategy_id" class="top-row">
          <span>{{ item.name }}</span>
          <span class="muted">{{ item.count }} · 均强 {{ item.avg_confidence }}</span>
        </div>
        <el-empty v-if="!(data.strategy_top || []).length" :image-size="48" description="暂无" />
      </div>
      <div class="glass-card">
        <div class="card-head"><h3>{{ fishMode ? '运行中规则' : '运行中策略' }}</h3></div>
        <div v-for="s in data.running_strategies || []" :key="s.id" class="top-row">
          <span>{{ s.name }}</span>
          <span class="muted">{{ s.target_count }} 标的 · {{ s.data_period }}</span>
        </div>
        <el-empty v-if="!(data.running_strategies || []).length" :image-size="48" description="暂无运行中" />
      </div>
    </div>

    <div class="glass-card quick-card">
      <el-button type="primary" @click="$emit('goto', 'strategies')">{{ fishMode ? '管理规则' : '管理策略' }}</el-button>
      <el-button @click="$emit('goto', 'live')">{{ fishMode ? '查看动态' : '实时监控' }}</el-button>
      <el-button @click="$emit('goto', 'backtest')">{{ fishMode ? '验证' : '策略回测' }}</el-button>
      <el-button :loading="scanning" @click="onScan">立即扫描</el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getQuantMonitorDashboard, scanQuantMonitor } from '../../api'
import { formatMonitorTime } from '../../utils/monitorTime'

defineProps({ fishMode: Boolean })
defineEmits(['goto'])

const data = reactive({
  today_buy: 0,
  today_sell: 0,
  today_total: 0,
  active_strategies: 0,
  latest_signals: [],
  trend_7d: [],
  strategy_top: [],
  running_strategies: [],
  indices: [],
})
const scanning = ref(false)
const maxTrend = ref(1)

async function refresh() {
  try {
    const { data: res } = await getQuantMonitorDashboard()
    Object.assign(data, res)
    maxTrend.value = Math.max(1, ...(res.trend_7d || []).map((i) => i.count || 0))
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  }
}

function barHeight(count) {
  return `${Math.max(8, Math.round(((count || 0) / maxTrend.value) * 100))}px`
}

function formatTime(iso) {
  return formatMonitorTime(iso)
}

function formatPct(v) {
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

function sigLabel(sig) {
  return sig.signal_type === 'buy' ? '买入' : '卖出'
}

async function onScan() {
  scanning.value = true
  try {
    const { data: res } = await scanQuantMonitor()
    ElMessage.success(`扫描完成：新信号 ${res.new_signals || 0}`)
    await refresh()
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

onMounted(refresh)
defineExpose({ refresh })
</script>

<style scoped>
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}

.stat-card {
  padding: 14px 16px;
}

.stat-label {
  font-size: 12px;
  color: var(--muted);
}

.stat-value {
  margin-top: 6px;
  font-size: 28px;
  font-weight: 700;
}

.stat-value.buy { color: #cf1322; }
.stat-value.sell { color: #389e0d; }

.indices {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.idx-item {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 13px;
}

.idx-name { color: var(--muted); }
.idx-item.up .idx-chg, .idx-item.up .idx-price { color: #cf1322; }
.idx-item.down .idx-chg, .idx-item.down .idx-price { color: #389e0d; }

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.glass-card {
  padding: 14px 16px;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.card-head h3 {
  margin: 0;
  font-size: 14px;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  min-height: 120px;
  padding-top: 8px;
}

.trend-item {
  flex: 1;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
}

.bar-wrap {
  height: 100px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 70%;
  max-width: 28px;
  background: linear-gradient(180deg, #5b8ff9, #85a5ff);
  border-radius: 4px 4px 0 0;
}

.trend-count { margin-top: 4px; font-weight: 600; color: inherit; }

.signal-list { display: flex; flex-direction: column; gap: 8px; }

.signal-row {
  display: grid;
  grid-template-columns: 48px 1fr 70px 48px 140px;
  gap: 8px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.signal-row.buy .sig-type { color: #cf1322; }
.signal-row.sell .sig-type { color: #389e0d; }

.top-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.muted { color: var(--muted); font-size: 12px; }

.quick-card {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .stat-row, .grid-2 { grid-template-columns: 1fr 1fr; }
  .signal-row { grid-template-columns: 48px 1fr 70px; }
  .sig-conf, .sig-time { display: none; }
}
</style>
