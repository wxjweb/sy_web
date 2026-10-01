<template>

  <div class="dashboard">

    <h1 class="page-title">数据概览</h1>

    <p class="subtitle">实时追踪热搜，智能生成中性客观的微博文案</p>



    <el-row :gutter="20" class="stats-row">

      <el-col :xs="12" :sm="6" v-for="item in statCards" :key="item.key">

        <div class="glass-card stat-card" :style="{ borderTop: `4px solid ${item.color}` }">

          <el-icon :size="32" :color="item.color"><component :is="item.icon" /></el-icon>

          <div class="stat-value">{{ stats[item.key] ?? '-' }}</div>

          <div class="stat-label">{{ item.label }}</div>

        </div>

      </el-col>

    </el-row>



    <el-row :gutter="20" class="charts-row">

      <el-col :xs="24" :lg="12">

        <div class="glass-card chart-card" v-loading="loading">

          <h3>每日统计（近 {{ trendDays }} 天）</h3>

          <p class="chart-desc">当日抓取热搜、生成微博、待处理热搜、草稿微博、已发布微博</p>

          <div ref="dailyChartRef" class="chart-box"></div>

        </div>

      </el-col>

      <el-col :xs="24" :lg="12">

        <div class="glass-card chart-card" v-loading="loading">

          <h3>累积趋势（近 {{ trendDays }} 天）</h3>

          <p class="chart-desc">累积热搜、累积微博、待生成微博的热搜、累积草稿、累积已发布</p>

          <div ref="cumulativeChartRef" class="chart-box"></div>

        </div>

      </el-col>

    </el-row>



    <div class="glass-card recent" v-loading="loading">

      <div class="section-head">

        <h3>最新生成微博</h3>

        <el-button text type="primary" @click="$router.push('/posts')">查看全部</el-button>

      </div>

      <el-empty v-if="!recent.length" description="暂无微博，点击左侧「立即抓取」开始" />

      <div v-else class="post-list">

        <div v-for="p in recent" :key="p.id" class="post-item">

          <el-tag size="small" :type="sourceTagType(p.source)" effect="light">

            {{ labelSource(p.source) }}

          </el-tag>

          <strong>{{ p.title }}</strong>

          <p class="weibo-content">{{ p.content }}</p>

          <span class="meta">{{ p.word_count }} 字 · {{ formatTime(p.created_at) }}</span>

        </div>

      </div>

    </div>

  </div>

</template>



<script setup>

import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'

import * as echarts from 'echarts'

import { getDashboard, getSources, getWeiboPosts } from '../api'

import { fallbackSources, sourceLabel, sourceTagType } from '../utils/sources'



const sources = ref([...fallbackSources])

const trendDays = 30



const loading = ref(false)

const stats = ref({})

const recent = ref([])

const dailyChartRef = ref(null)

const cumulativeChartRef = ref(null)

const dailyChart = shallowRef(null)

const cumulativeChart = shallowRef(null)



const statCards = [

  { key: 'total_topics', label: '累计热搜', icon: 'TrendCharts', color: '#ff6b6b' },

  { key: 'total_posts', label: '已生成微博', icon: 'ChatDotRound', color: '#4ecdc4' },

  { key: 'pending_topics', label: '待处理', icon: 'Clock', color: '#ffe66d' },

  { key: 'today_posts', label: '今日生成', icon: 'Calendar', color: '#a29bfe' },

]



const dailySeriesMeta = [

  { key: 'topics', name: '抓取热搜', color: '#ff6b6b' },

  { key: 'posts', name: '生成微博', color: '#4ecdc4' },

  { key: 'pending', name: '待处理热搜', color: '#ffe66d' },

  { key: 'drafts', name: '草稿微博', color: '#74b9ff' },

  { key: 'published', name: '已发布微博', color: '#00b894' },

]



const cumulativeSeriesMeta = [

  { key: 'topics', name: '累积热搜', color: '#ff6b6b' },

  { key: 'posts', name: '累积微博', color: '#4ecdc4' },

  { key: 'pending', name: '待生成热搜', color: '#ffe66d' },

  { key: 'drafts', name: '累积草稿', color: '#74b9ff' },

  { key: 'published', name: '累积已发布', color: '#00b894' },

]



function formatTime(t) {

  if (!t) return ''

  return new Date(t).toLocaleString('zh-CN')

}



function labelSource(id) {

  return sourceLabel(id, sources.value)

}



function formatDateLabel(dateStr) {

  const parts = dateStr.split('-')

  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateStr

}



function buildChartOption(seriesMeta, points) {

  const dates = (points || []).map((p) => formatDateLabel(p.date))

  return {

    tooltip: {

      trigger: 'axis',

    },

    legend: {

      data: seriesMeta.map((s) => s.name),

      bottom: 0,

      type: 'scroll',

    },

    grid: {

      left: 48,

      right: 20,

      top: 24,

      bottom: 56,

    },

    xAxis: {

      type: 'category',

      boundaryGap: false,

      data: dates,

      axisLabel: {

        rotate: dates.length > 14 ? 45 : 0,

      },

    },

    yAxis: {

      type: 'value',

      minInterval: 1,

    },

    series: seriesMeta.map((s) => ({

      name: s.name,

      type: 'line',

      smooth: true,

      showSymbol: dates.length <= 14,

      data: (points || []).map((p) => p[s.key] ?? 0),

      itemStyle: { color: s.color },

      lineStyle: { width: 2 },

      areaStyle: { opacity: 0.06 },

    })),

  }

}



function renderCharts() {

  if (dailyChartRef.value) {

    if (!dailyChart.value) {

      dailyChart.value = echarts.init(dailyChartRef.value)

    }

    dailyChart.value.setOption(buildChartOption(dailySeriesMeta, stats.value.daily_trend), true)

  }

  if (cumulativeChartRef.value) {

    if (!cumulativeChart.value) {

      cumulativeChart.value = echarts.init(cumulativeChartRef.value)

    }

    cumulativeChart.value.setOption(buildChartOption(cumulativeSeriesMeta, stats.value.cumulative_trend), true)

  }

}



function handleResize() {

  dailyChart.value?.resize()

  cumulativeChart.value?.resize()

}



async function load() {

  loading.value = true

  try {

    const [dash, posts] = await Promise.all([

      getDashboard({ days: trendDays }),

      getWeiboPosts({ page: 1, size: 5 }),

    ])

    stats.value = dash.data

    recent.value = posts.data.list || []

    await nextTick()

    renderCharts()

  } finally {

    loading.value = false

  }

}



onMounted(async () => {

  try {

    const { data } = await getSources()

    if (Array.isArray(data) && data.length) sources.value = data

  } catch {

    /* use fallback */

  }

  window.addEventListener('resize', handleResize)

  load()

})



onBeforeUnmount(() => {

  window.removeEventListener('resize', handleResize)

  dailyChart.value?.dispose()

  cumulativeChart.value?.dispose()

})

</script>



<style scoped>

.dashboard {

  padding: 8px 4px 32px;

}



.subtitle {

  color: var(--muted);

  margin: 8px 0 28px;

}



.stats-row {

  margin-bottom: 24px;

}



.charts-row {

  margin-bottom: 24px;

}



.stat-card {

  padding: 24px;

  text-align: center;

  margin-bottom: 16px;

  transition: transform 0.2s;

}



.stat-card:hover {

  transform: translateY(-4px);

}



.stat-label {

  color: var(--muted);

  margin-top: 8px;

}



.chart-card {

  padding: 20px 20px 8px;

  margin-bottom: 16px;

}



.chart-card h3 {

  margin: 0 0 4px;

  font-size: 16px;

}



.chart-desc {

  margin: 0 0 12px;

  font-size: 12px;

  color: var(--muted);

}



.chart-box {

  width: 100%;

  height: 360px;

}



.recent {

  padding: 24px;

}



.section-head {

  display: flex;

  justify-content: space-between;

  align-items: center;

  margin-bottom: 16px;

}



.section-head h3 {

  margin: 0;

}



.post-item {

  padding: 16px 0;

  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);

}



.post-item:last-child {

  border-bottom: none;

}



.post-item strong {

  margin-left: 8px;

}



.post-item .weibo-content {

  margin: 12px 0 8px;

  color: #444;

}



.meta {

  font-size: 12px;

  color: var(--muted);

}

</style>


