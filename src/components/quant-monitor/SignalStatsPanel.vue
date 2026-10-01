<template>
  <div class="signal-stats glass-card" v-loading="loading">
    <div class="card-head">
      <h3>信号分析</h3>
      <el-button text type="primary" @click="load">刷新</el-button>
    </div>
    <div class="cols">
      <div>
        <div class="sub">策略 TOP</div>
        <div v-for="item in data.strategy_top || []" :key="item.strategy_id" class="row">
          <span>{{ item.name || `#${item.strategy_id}` }}</span>
          <span class="muted">{{ item.count }} · 均强 {{ item.avg_confidence }}</span>
        </div>
        <el-empty v-if="!(data.strategy_top || []).length" :image-size="48" description="暂无" />
      </div>
      <div>
        <div class="sub">股票 TOP</div>
        <div v-for="item in data.stock_top || []" :key="item.stock_code" class="row">
          <span>{{ item.stock_name }} {{ item.stock_code }}</span>
          <span class="muted">{{ item.count }}（买{{ item.buy }}/卖{{ item.sell }}）</span>
        </div>
        <el-empty v-if="!(data.stock_top || []).length" :image-size="48" description="暂无" />
      </div>
      <div>
        <div class="sub">时段分布</div>
        <div class="hours">
          <div
            v-for="h in data.hour_distribution || []"
            :key="h.hour"
            class="hour"
            :title="`${h.hour}时: ${h.count}`"
          >
            <div class="bar" :style="{ height: hourH(h.count) }" />
            <span>{{ h.hour }}</span>
          </div>
        </div>
        <el-empty v-if="!(data.hour_distribution || []).length" :image-size="48" description="暂无" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { getQuantMonitorAnalytics } from '../../api'

const loading = ref(false)
const data = reactive({
  strategy_top: [],
  stock_top: [],
  hour_distribution: [],
})
const maxHour = ref(1)

async function load() {
  loading.value = true
  try {
    const { data: res } = await getQuantMonitorAnalytics()
    Object.assign(data, res)
    maxHour.value = Math.max(1, ...(res.hour_distribution || []).map((i) => i.count || 0))
  } finally {
    loading.value = false
  }
}

function hourH(c) {
  return `${Math.max(4, Math.round(((c || 0) / maxHour.value) * 48))}px`
}

onMounted(load)
defineExpose({ refresh: load })
</script>

<style scoped>
.signal-stats {
  padding: 14px 16px;
  margin-bottom: 12px;
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

.cols {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.sub {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--muted);
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  padding: 4px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.muted { color: var(--muted); font-size: 12px; }

.hours {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  min-height: 64px;
  flex-wrap: wrap;
}

.hour {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--muted);
}

.hour .bar {
  width: 10px;
  background: #5b8ff9;
  border-radius: 2px 2px 0 0;
}

@media (max-width: 960px) {
  .cols { grid-template-columns: 1fr; }
}
</style>
