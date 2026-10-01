<template>
  <div class="monitor-live">
    <div class="toolbar glass-card">
      <div>
        <span class="muted">监控标的来自运行中策略</span>
        <span v-if="updatedAt" class="muted"> · 更新于 {{ formatTime(updatedAt) }}</span>
      </div>
      <div class="toolbar-right">
        <el-select v-model="sortBy" style="width: 150px">
          <el-option label="按涨跌幅" value="change" />
          <el-option label="按最新信号" value="signal" />
          <el-option label="按名称" value="name" />
        </el-select>
        <el-switch v-model="autoRefresh" active-text="自动刷新" />
        <el-button :loading="loading" type="primary" @click="refresh">刷新</el-button>
      </div>
    </div>

    <div v-loading="loading" class="live-grid">
      <div
        v-for="item in sortedList"
        :key="item.code"
        class="glass-card live-card"
        :class="{ flash: flashCodes.has(item.code) }"
      >
        <div class="live-head">
          <div>
            <div class="name">{{ item.name }}</div>
            <div class="code">{{ item.code }}</div>
          </div>
          <div class="price-box" :class="item.change_pct >= 0 ? 'up' : 'down'">
            <div class="price">{{ item.price?.toFixed?.(2) ?? item.price }}</div>
            <div class="chg">{{ formatPct(item.change_pct) }}</div>
          </div>
        </div>
        <div class="strategies">
          <el-tag v-for="s in item.strategies" :key="s.id" size="small" effect="plain">{{ s.name }}</el-tag>
        </div>
        <div v-if="item.last_signal" class="last-sig" :class="item.last_signal.signal_type">
          最近信号：{{ item.last_signal.signal_label }}
          · ¥{{ item.last_signal.price }}
          · {{ formatTime(item.last_signal.triggered_at) }}
        </div>
        <div v-else class="last-sig muted">暂无信号</div>
      </div>
      <el-empty v-if="!loading && !list.length" description="暂无运行中的策略标的" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import { getQuantMonitorLive, getQuantMonitorSettings } from '../../api'
import { formatMonitorTime } from '../../utils/monitorTime'

const list = ref([])
const loading = ref(false)
const updatedAt = ref('')
const sortBy = ref('change')
const autoRefresh = ref(true)
const flashCodes = ref(new Set())
const notifyDesktop = ref(true)
let timer = null
let lastSignalIds = new Set()

const sortedList = computed(() => {
  const arr = [...list.value]
  if (sortBy.value === 'name') {
    arr.sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh'))
  } else if (sortBy.value === 'signal') {
    arr.sort((a, b) => {
      const ta = a.last_signal?.triggered_at || ''
      const tb = b.last_signal?.triggered_at || ''
      return tb.localeCompare(ta)
    })
  } else {
    arr.sort((a, b) => Math.abs(b.change_pct || 0) - Math.abs(a.change_pct || 0))
  }
  return arr
})

function formatTime(iso) {
  return formatMonitorTime(iso)
}

function formatPct(v) {
  const n = Number(v || 0)
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

async function refresh() {
  loading.value = true
  try {
    const { data } = await getQuantMonitorLive()
    const next = data.list || []
    const newFlash = new Set()
    const currentIds = new Set()
    for (const item of next) {
      const sig = item.last_signal
      if (sig?.id) {
        currentIds.add(sig.id)
        if (!lastSignalIds.has(sig.id) && lastSignalIds.size > 0) {
          newFlash.add(item.code)
          ElNotification({
            title: `${sig.signal_label} · ${item.name}`,
            message: `${item.code} ¥${sig.price} · ${sig.strategy_name || ''}`,
            type: sig.signal_type === 'buy' ? 'warning' : 'success',
            duration: 6000,
          })
          if (notifyDesktop.value && typeof Notification !== 'undefined') {
            if (Notification.permission === 'granted') {
              new Notification(`${sig.signal_label} ${item.name}`, {
                body: `${item.code} ¥${sig.price}`,
              })
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission()
            }
          }
        }
      }
    }
    lastSignalIds = currentIds.size ? currentIds : lastSignalIds
    if (!lastSignalIds.size) {
      lastSignalIds = currentIds
    }
    list.value = next
    updatedAt.value = data.updated_at || ''
    flashCodes.value = newFlash
    if (newFlash.size) {
      setTimeout(() => { flashCodes.value = new Set() }, 2500)
    }
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function setupTimer() {
  if (timer) clearInterval(timer)
  timer = null
  if (autoRefresh.value) {
    timer = setInterval(refresh, 30000)
  }
}

watch(autoRefresh, setupTimer)

onMounted(async () => {
  try {
    const { data } = await getQuantMonitorSettings()
    notifyDesktop.value = !!data.notify_desktop
  } catch {
    /* ignore */
  }
  await refresh()
  setupTimer()
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
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
  align-items: center;
}

.toolbar-right {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.muted { color: var(--muted); font-size: 13px; }

.live-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  min-height: 120px;
}

.live-card {
  padding: 14px 16px;
  transition: box-shadow 0.3s, transform 0.3s;
}

.live-card.flash {
  box-shadow: 0 0 0 2px #f5a623;
  transform: translateY(-2px);
}

.live-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.name { font-weight: 600; }
.code { font-size: 12px; color: var(--muted); margin-top: 2px; }

.price-box { text-align: right; }
.price { font-size: 20px; font-weight: 700; }
.chg { font-size: 13px; }
.up { color: #c45656; }
.down { color: #389e0d; }

.strategies {
  margin-top: 10px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.last-sig {
  margin-top: 10px;
  font-size: 12px;
}

.last-sig.buy { color: #c45656; }
.last-sig.sell { color: #389e0d; }
</style>
