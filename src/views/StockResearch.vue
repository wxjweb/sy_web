<template>
  <div class="page">
    <h1 class="page-title">个股研究</h1>

    <el-tabs v-model="pageTab" class="page-tabs">
      <el-tab-pane label="个股数据" name="data">
    <div class="glass-card search-bar">
      <div class="search-row">
        <el-autocomplete
          v-model="keyword"
          :fetch-suggestions="querySuggest"
          clearable
          placeholder="输入股票名称或代码，如 贵州茅台 / 600519"
          style="width: 360px"
          value-key="label"
          @select="onSelect"
          @keyup.enter="onSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
          <template #default="{ item }">
            <span class="suggest-name">{{ item.name }}</span>
            <span class="suggest-code">{{ item.code }}</span>
            <span class="suggest-market">{{ item.market }}</span>
          </template>
        </el-autocomplete>
        <el-button type="primary" round :loading="loading" @click="() => onSearch()">
          <el-icon><Search /></el-icon>
          查询研究
        </el-button>
      </div>

      <div v-if="searchHistory.length" class="history-section">
        <div class="history-head">
          <span class="history-title">搜索历史</span>
          <el-button text type="danger" size="small" @click="clearHistory">清空</el-button>
        </div>
        <div class="history-list">
          <button
            v-for="item in searchHistory"
            :key="`${item.query}-${item.searchedAt}`"
            type="button"
            class="history-item"
            :title="`搜索 ${item.query}`"
            @click="searchFromHistory(item)"
          >
            {{ formatHistoryLabel(item) }}
          </button>
        </div>
      </div>
      <p v-if="researchFromCache" class="cache-hint">研究数据来自缓存（24 小时内有效），行情仍实时更新</p>
    </div>

    <template v-if="report">
      <StockRealtimePanel
        :code="report.quote.code"
        :initial-quote="report.quote"
        @quote-update="onQuoteUpdate"
      />

      <div class="glass-card content-card" v-loading="loading">
        <el-tabs v-model="activeTab" class="research-tabs">
          <el-tab-pane label="个股资料" name="profile">
            <div v-if="report.data_sources?.length" class="source-bar">
              <span class="source-label">数据来源</span>
              <el-tag v-for="s in report.data_sources" :key="s" size="small" effect="plain">{{ s }}</el-tag>
            </div>
            <el-descriptions
              v-if="report.profile?.length"
              :column="2"
              border
              class="profile-descriptions"
              label-width="150px"
            >
              <el-descriptions-item
                v-for="(item, idx) in report.profile"
                :key="idx"
                :label="item.label"
              >
                <div class="profile-value">
                  <span class="profile-text">{{ item.value }}</span>
                  <el-tag
                    v-if="item.source"
                    size="small"
                    type="info"
                    effect="plain"
                    class="profile-source-tag"
                  >
                    {{ item.source }}
                  </el-tag>
                </div>
              </el-descriptions-item>
            </el-descriptions>
            <el-empty v-else description="暂无个股资料" />
          </el-tab-pane>

          <el-tab-pane label="新闻资讯" name="news">
            <div v-if="report.news?.length" class="list">
              <div v-for="(item, idx) in report.news" :key="idx" class="list-item">
                <div class="list-head">
                  <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="title link">
                    {{ item.title }}
                  </a>
                  <strong v-else class="title">{{ item.title }}</strong>
                  <span class="time">{{ item.time }}</span>
                </div>
                <p v-if="item.summary" class="summary">{{ item.summary }}</p>
                <el-tag v-if="item.source" size="small" effect="plain">{{ item.source }}</el-tag>
              </div>
            </div>
            <el-empty v-else description="暂无新闻资讯" />
          </el-tab-pane>

          <el-tab-pane label="官方公告" name="ann">
            <div v-if="report.announcements?.length" class="list">
              <div v-for="(item, idx) in report.announcements" :key="idx" class="list-item">
                <div class="list-head">
                  <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="title link">
                    {{ item.title }}
                  </a>
                  <strong v-else class="title">{{ item.title }}</strong>
                  <span class="time">{{ item.time }}</span>
                </div>
                <el-tag v-if="item.source" size="small" effect="plain">{{ item.source }}</el-tag>
              </div>
            </div>
            <el-empty v-else description="暂无官方公告" />
          </el-tab-pane>

          <el-tab-pane label="投顾研报" name="report">
            <div v-if="report.research_reports?.length" class="list">
              <div v-for="(item, idx) in report.research_reports" :key="idx" class="list-item">
                <div class="list-head">
                  <strong class="title">{{ item.title }}</strong>
                  <span class="time">{{ item.time }}</span>
                </div>
                <div class="tags">
                  <el-tag v-if="item.org" size="small" effect="plain">{{ item.org }}</el-tag>
                  <el-tag v-if="item.rating" size="small" type="warning" effect="plain">{{ item.rating }}</el-tag>
                  <el-tag size="small" type="info" effect="plain">东方财富研报</el-tag>
                  <span v-if="item.author" class="author">{{ item.author }}</span>
                </div>
                <p v-if="item.summary" class="summary">{{ item.summary }}</p>
              </div>
            </div>
            <el-empty v-else description="暂无投顾研报" />
          </el-tab-pane>

          <el-tab-pane label="股吧股评" name="forum">
            <div v-if="report.forum_posts?.length" class="forum-panel">
              <div class="forum-toolbar">
                <el-select v-model="forumSource" clearable placeholder="按来源筛选" style="width: 180px">
                  <el-option v-for="s in forumSources" :key="s" :label="s" :value="s" />
                </el-select>
                <span class="forum-count">共 {{ filteredForumPosts.length }} 条</span>
              </div>
              <div class="list">
                <div v-for="(item, idx) in filteredForumPosts" :key="idx" class="list-item">
                  <div class="list-head">
                    <div class="title-wrap">
                      <el-tag size="small" effect="plain" class="source-tag">{{ item.source }}</el-tag>
                      <a v-if="item.url" :href="item.url" target="_blank" rel="noopener" class="title link">
                        {{ item.title }}
                      </a>
                      <strong v-else class="title">{{ item.title }}</strong>
                    </div>
                    <span class="time">{{ item.time }}</span>
                  </div>
                  <p v-if="item.summary" class="summary">{{ item.summary }}</p>
                  <div class="forum-meta">
                    <span v-if="item.author">{{ item.author }}</span>
                    <span v-if="item.read_num">阅读 {{ item.read_num }}</span>
                    <span v-if="item.reply_num">回复 {{ item.reply_num }}</span>
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-else description="暂无股吧股评" />
          </el-tab-pane>

          <el-tab-pane label="投资研判" name="advice">
            <el-alert
              title="以下内容由 AI 基于公开信息生成，仅供参考，不构成投资建议。"
              type="warning"
              :closable="false"
              show-icon
              class="risk-tip"
            />
            <el-row :gutter="16">
              <el-col :xs="24" :md="12" v-for="card in adviceCards" :key="card.key">
                <div class="advice-card">
                  <h4>{{ card.label }}</h4>
                  <p>{{ report.advice?.[card.key] || '暂无分析' }}</p>
                </div>
              </el-col>
            </el-row>
          </el-tab-pane>

          <el-tab-pane label="持仓分析" name="position">
            <el-alert
              title="请输入您的持仓信息，AI 将结合实时行情与公开资料生成持仓分析，仅供参考，不构成投资建议。"
              type="warning"
              :closable="false"
              show-icon
              class="risk-tip"
            />

            <el-form :model="positionForm" label-width="88px" class="position-form" @submit.prevent>
              <div class="position-form-row">
                <el-form-item label="持仓成本" required class="position-field">
                  <el-input-number
                    v-model="positionForm.cost_price"
                    :min="0.01"
                    :precision="2"
                    :step="0.01"
                    placeholder="必填，元/股"
                    controls-position="right"
                    class="position-input"
                  />
                </el-form-item>
                <el-form-item label="持仓数量" class="position-field">
                  <el-input-number
                    v-model="positionForm.quantity"
                    :min="1"
                    :precision="0"
                    :step="100"
                    placeholder="选填，股"
                    controls-position="right"
                    class="position-input"
                  />
                </el-form-item>
                <el-form-item label="个股仓位" class="position-field">
                  <el-input-number
                    v-model="positionForm.position_ratio"
                    :min="0.01"
                    :max="100"
                    :precision="2"
                    :step="1"
                    placeholder="选填，%"
                    controls-position="right"
                    class="position-input"
                  />
                </el-form-item>
                <el-form-item label-width="0" class="position-action">
                  <el-button type="primary" round :loading="positionLoading" @click="onPositionAnalyze">
                    分析
                  </el-button>
                </el-form-item>
              </div>
            </el-form>

            <template v-if="positionResult">
              <div class="metrics-bar glass-card">
                <div class="metric-item">
                  <span class="label">最新价</span>
                  <span class="value">{{ formatPrice(positionResult.metrics.current_price) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">持仓成本</span>
                  <span class="value">{{ formatPrice(positionResult.metrics.cost_price) }}</span>
                </div>
                <div class="metric-item">
                  <span class="label">盈亏比例</span>
                  <span class="value" :class="plClass(positionResult.metrics.profit_loss_pct)">
                    {{ signed(positionResult.metrics.profit_loss_pct) }}%
                  </span>
                </div>
                <div v-if="positionResult.metrics.profit_loss_amt != null" class="metric-item">
                  <span class="label">浮动盈亏</span>
                  <span class="value" :class="plClass(positionResult.metrics.profit_loss_amt)">
                    {{ signed(positionResult.metrics.profit_loss_amt) }} 元
                  </span>
                </div>
                <div v-if="positionResult.metrics.market_value != null" class="metric-item">
                  <span class="label">持仓市值</span>
                  <span class="value">{{ formatNum(positionResult.metrics.market_value) }}</span>
                </div>
                <div v-if="positionResult.metrics.position_ratio != null" class="metric-item">
                  <span class="label">个股仓位</span>
                  <span class="value">{{ positionResult.metrics.position_ratio }}%</span>
                </div>
              </div>

              <div class="summary-card">
                <h4>综合结论</h4>
                <p>{{ positionResult.summary }}</p>
              </div>

              <el-row :gutter="16">
                <el-col :xs="24" :md="12" v-for="card in positionCards" :key="card.key">
                  <div class="advice-card">
                    <h4>{{ card.label }}</h4>
                    <p>{{ positionResult[card.key] || '暂无分析' }}</p>
                  </div>
                </el-col>
              </el-row>
            </template>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <div v-else-if="!loading" class="glass-card empty-guide">
      <el-empty description="输入股票名称或代码，开始个股研究" />
    </div>
      </el-tab-pane>

      <el-tab-pane label="自选股" name="watchlist" class="watchlist-tab-pane">
        <StockWatchlistPanel @select-stock="onStockSelect" />
      </el-tab-pane>

      <el-tab-pane label="模拟交易" name="sim-trade" class="sim-trade-tab-pane">
        <StockSimTradePanel @select-stock="onStockSelect" />
      </el-tab-pane>

      <el-tab-pane label="个股推荐" name="recommend" class="recommend-tab-pane">
        <StockRecommendPanel @select-stock="onStockSelect" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="stockActionVisible"
      title="选择操作"
      width="420px"
      align-center
      :close-on-click-modal="true"
    >
      <p v-if="pendingStock" class="stock-action-tip">
        已选择：<strong>{{ pendingStock.name }}</strong>（{{ pendingStock.code }}）
      </p>
      <p class="stock-action-desc">请选择要进行的操作</p>
      <div class="stock-action-btns">
        <el-button type="primary" round size="large" @click="goStockResearch">
          <el-icon><Search /></el-icon>
          个股研究
        </el-button>
        <el-button type="success" round size="large" @click="goQuantBacktest">
          <el-icon><VideoPlay /></el-icon>
          量化回测
        </el-button>
      </div>
    </el-dialog>

    <Teleport to="body">
      <Transition name="fade">
        <button
          v-show="showBackTop"
          type="button"
          class="back-top-btn"
          aria-label="回到顶部"
          @click="scrollToTop"
        >
          <el-icon :size="18"><Top /></el-icon>
          <span>回到顶部</span>
        </button>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Top, VideoPlay } from '@element-plus/icons-vue'
import { getStockResearch, getStockSuggest, analyzeStockPosition } from '../api'
import StockRecommendPanel from '../components/StockRecommendPanel.vue'
import StockRealtimePanel from '../components/StockRealtimePanel.vue'
import StockWatchlistPanel from '../components/StockWatchlistPanel.vue'
import StockSimTradePanel from '../components/StockSimTradePanel.vue'
import {
  clearStockSearchHistory,
  formatHistoryLabel,
  loadStockSearchHistory,
  saveStockSearchHistory,
} from '../utils/stockSearchHistory'
import {
  loadStockResearchCache,
  saveStockResearchCache,
} from '../utils/stockResearchCache'

const route = useRoute()
const router = useRouter()
const keyword = ref('')
const pageTab = ref('data')
const loading = ref(false)
const report = ref(null)
const activeTab = ref('profile')
const forumSource = ref('')
const searchHistory = ref([])
const researchFromCache = ref(false)
const stockActionVisible = ref(false)
const pendingStock = ref(null)
const positionLoading = ref(false)
const positionResult = ref(null)
const positionForm = ref({
  cost_price: null,
  quantity: null,
  position_ratio: null,
})

const showBackTop = ref(false)
const BACKTOP_VISIBLE = 300
let scrollTarget = null

function getScrollContainer() {
  return document.querySelector('.layout .el-main.main') || document.querySelector('.layout .el-main')
}

function getScrollTop() {
  const el = getScrollContainer()
  if (el) return el.scrollTop
  return window.scrollY || document.documentElement.scrollTop
}

function updateBackTopVisible() {
  showBackTop.value = getScrollTop() >= BACKTOP_VISIBLE
}

function scrollToTop() {
  const el = getScrollContainer()
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function bindScrollListener() {
  const container = getScrollContainer()
  scrollTarget = container || window
  scrollTarget.addEventListener('scroll', updateBackTopVisible, { passive: true })
}

const positionCards = [
  { key: 'profit_loss_analysis', label: '盈亏分析' },
  { key: 'position_risk', label: '持仓风险' },
  { key: 'cost_analysis', label: '成本分析' },
  { key: 'operation_advice', label: '操作建议' },
  { key: 'add_reduce_advice', label: '加减仓建议' },
  { key: 'stop_loss_take_profit', label: '止损止盈' },
  { key: 'position_evaluation', label: '仓位评估' },
  { key: 'fundamental_impact', label: '基本面影响' },
  { key: 'technical_view', label: '技术面观点' },
  { key: 'sentiment_view', label: '市场情绪' },
  { key: 'key_risks', label: '主要风险' },
  { key: 'action_plan', label: '行动方案' },
  { key: 'watch_points', label: '关注要点' },
]

const forumSources = computed(() => {
  const set = new Set((report.value?.forum_posts || []).map((p) => p.source).filter(Boolean))
  return Array.from(set)
})

const filteredForumPosts = computed(() => {
  const list = report.value?.forum_posts || []
  if (!forumSource.value) return list
  return list.filter((p) => p.source === forumSource.value)
})

const adviceCards = [
  { key: 'investment_advice', label: '投资建议' },
  { key: 'open_position', label: '建仓' },
  { key: 'close_position', label: '清仓' },
  { key: 'increase_position', label: '加仓' },
  { key: 'decrease_position', label: '减仓' },
  { key: 'take_profit', label: '止盈' },
  { key: 'stop_loss', label: '止损' },
  { key: 'short_term_prediction', label: '短期预测' },
  { key: 'medium_term_prediction', label: '中期预测' },
  { key: 'long_term_prediction', label: '长期预测' },
]

function onQuoteUpdate(q) {
  if (report.value?.quote) {
    report.value.quote = { ...report.value.quote, ...q }
  }
}

function formatPrice(v) {
  if (v == null || Number.isNaN(v)) return '-'
  return Number(v).toFixed(2)
}

function formatNum(v) {
  if (!v) return '-'
  if (v >= 1e8) return `${(v / 1e8).toFixed(2)}亿`
  if (v >= 1e4) return `${(v / 1e4).toFixed(2)}万`
  return String(v)
}

function signed(v) {
  if (v == null) return '-'
  const n = Number(v)
  return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2)
}

async function querySuggest(query, cb) {
  const q = (query || '').trim()
  if (!q) {
    cb([])
    return
  }
  try {
    const { data } = await getStockSuggest(q)
    cb(
      (data || []).map((item) => ({
        ...item,
        label: `${item.name} (${item.code})`,
        value: item.code,
      })),
    )
  } catch {
    cb([])
  }
}

function onSelect(item) {
  keyword.value = item.code
  onSearch(item.code)
}

function searchFromHistory(item) {
  keyword.value = item.query
  onSearch(item.query)
}

async function clearHistory() {
  try {
    await ElMessageBox.confirm('确定清空全部搜索历史吗？', '清空历史', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  searchHistory.value = clearStockSearchHistory()
  ElMessage.success('搜索历史已清空')
}

function plClass(v) {
  if (v == null) return ''
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}

async function onPositionAnalyze() {
  if (!report.value?.quote?.code) {
    ElMessage.warning('请先查询股票')
    return
  }
  if (!positionForm.value.cost_price || positionForm.value.cost_price <= 0) {
    ElMessage.warning('请输入有效的持仓成本')
    return
  }
  positionLoading.value = true
  try {
    const payload = {
      query: report.value.quote.code,
      cost_price: positionForm.value.cost_price,
    }
    if (positionForm.value.quantity) payload.quantity = positionForm.value.quantity
    if (positionForm.value.position_ratio) payload.position_ratio = positionForm.value.position_ratio
    const { data } = await analyzeStockPosition(payload)
    positionResult.value = data
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '持仓分析失败')
  } finally {
    positionLoading.value = false
  }
}

async function onSearch(queryInput) {
  const q = (typeof queryInput === 'string' ? queryInput : keyword.value).trim()
  if (!q) {
    ElMessage.warning('请输入股票名称或代码')
    return
  }
  keyword.value = q
  researchFromCache.value = false

  const cached = loadStockResearchCache(q)
  if (cached?.quote?.code) {
    report.value = cached
    researchFromCache.value = true
    activeTab.value = 'profile'
    forumSource.value = ''
    positionResult.value = null
    searchHistory.value = saveStockSearchHistory({
      query: q,
      name: cached.quote.name,
      code: cached.quote.code,
    })
    return
  }

  loading.value = true
  activeTab.value = 'profile'
  forumSource.value = ''
  positionResult.value = null
  try {
    const { data } = await getStockResearch(q)
    report.value = data
    saveStockResearchCache(data, q)
    searchHistory.value = saveStockSearchHistory({
      query: q,
      name: data?.quote?.name,
      code: data?.quote?.code,
    })
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '查询失败')
  } finally {
    loading.value = false
  }
}

function onStockSelect(stock) {
  if (!stock?.code) return
  pendingStock.value = {
    code: stock.code,
    name: stock.name || stock.code,
  }
  stockActionVisible.value = true
}

function goStockResearch() {
  const stock = pendingStock.value
  if (!stock) return
  stockActionVisible.value = false
  pageTab.value = 'data'
  keyword.value = stock.code
  onSearch(stock.code)
}

function goQuantBacktest() {
  const stock = pendingStock.value
  if (!stock) return
  stockActionVisible.value = false
  router.push({ path: '/stocks/quant/backtest', query: { code: stock.code } })
}

onMounted(() => {
  searchHistory.value = loadStockSearchHistory()
  bindScrollListener()
  updateBackTopVisible()
  const q = (route.query.q || '').toString().trim()
  if (q) {
    keyword.value = q
    onSearch(q)
  }
})

onBeforeUnmount(() => {
  scrollTarget?.removeEventListener('scroll', updateBackTopVisible)
})
</script>

<style scoped>
.page {
  padding: 8px 4px 32px;
  min-height: 100%;
  box-sizing: border-box;
}

.page-tabs {
  margin-top: 8px;
}

.page-tabs :deep(.el-tab-pane) {
  overflow: visible;
}

.recommend-tab-pane {
  min-height: calc(100vh - 160px);
}

.watchlist-tab-pane {
  overflow: visible;
}

.sim-trade-tab-pane {
  overflow: visible;
  min-height: calc(100vh - 160px);
}

.search-bar {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 20px;
  margin: 20px 0;
}

.search-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.cache-hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.stock-action-tip {
  margin: 0 0 8px;
  font-size: 15px;
  color: var(--text);
  line-height: 1.6;
}

.stock-action-desc {
  margin: 0 0 20px;
  font-size: 13px;
  color: var(--muted);
}

.stock-action-btns {
  display: flex;
  gap: 16px;
  justify-content: center;
  padding-bottom: 8px;
}

.stock-action-btns .el-button {
  min-width: 140px;
}

.history-section {
  padding-top: 4px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.history-title {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}

.history-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.history-item {
  border: 1px solid rgba(255, 107, 107, 0.2);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text);
  border-radius: 16px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}

.history-item:hover {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.12), rgba(78, 205, 196, 0.1));
  border-color: rgba(255, 107, 107, 0.35);
  color: var(--primary);
}

.suggest-name {
  font-weight: 600;
  margin-right: 8px;
}

.suggest-code {
  color: var(--primary);
  margin-right: 8px;
}

.suggest-market {
  color: var(--muted);
  font-size: 12px;
}

.source-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}

.source-label {
  font-size: 13px;
  color: var(--muted);
  font-weight: 600;
}

.profile-value {
  line-height: 1.6;
  word-break: break-word;
}

.profile-text {
  white-space: normal;
}

.profile-source-tag {
  display: inline-block;
  vertical-align: middle;
  margin-left: 6px;
  height: 18px;
  padding: 0 5px;
  border-radius: 3px;
}

.profile-source-tag :deep(.el-tag__content) {
  font-size: 10px;
  line-height: 18px;
}

.profile-descriptions {
  width: 100%;
}

.profile-descriptions :deep(.el-descriptions__table) {
  width: 100%;
  table-layout: fixed;
}

.profile-descriptions :deep(.el-descriptions__label) {
  min-width: 150px;
  width: 150px;
  white-space: nowrap;
  font-weight: 600;
  vertical-align: top;
}

.profile-descriptions :deep(.el-descriptions__content) {
  white-space: normal;
  word-break: break-word;
  vertical-align: top;
}

.profile-descriptions :deep(.el-descriptions__cell) {
  padding: 12px 16px;
}

.quote-card {
  padding: 20px 24px;
  margin-bottom: 20px;
}

.quote-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.quote-main h2 {
  margin: 0 0 6px;
  font-size: 1.5rem;
}

.code {
  color: var(--muted);
  font-size: 14px;
}

.price {
  font-size: 2rem;
  font-weight: 700;
}

.price.up {
  color: #e74c3c;
}

.price.down {
  color: #00b894;
}

.change {
  font-size: 1rem;
  margin-left: 8px;
}

.meta-item {
  padding: 8px 0;
}

.meta-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.meta-item .value {
  font-weight: 600;
}

.content-card {
  padding: 8px 16px 20px;
}

.research-tabs {
  margin-top: 8px;
}

.list-item {
  padding: 14px 0;
  border-bottom: 1px dashed rgba(0, 0, 0, 0.06);
}

.list-item:last-child {
  border-bottom: none;
}

.list-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.title {
  font-size: 15px;
  line-height: 1.5;
}

.link {
  color: var(--text);
  text-decoration: none;
}

.link:hover {
  color: var(--primary);
}

.time {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}

.summary {
  margin: 8px 0 0;
  color: #555;
  line-height: 1.7;
}

.source,
.author {
  font-size: 12px;
  color: var(--muted);
}

.tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.forum-panel {
  padding-top: 4px;
}

.forum-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.forum-count {
  font-size: 13px;
  color: var(--muted);
}

.title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.source-tag {
  flex-shrink: 0;
}

.forum-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--muted);
}

.risk-tip {
  margin-bottom: 16px;
}

.advice-card {
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  min-height: 140px;
}

.advice-card h4 {
  margin: 0 0 10px;
  color: var(--primary);
}

.advice-card p {
  margin: 0;
  line-height: 1.8;
  color: #444;
  white-space: pre-wrap;
}

.empty-guide {
  padding: 48px 24px;
  margin-top: 20px;
}

.position-form {
  margin-bottom: 20px;
  padding: 8px 0;
}

.position-form-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px 20px;
}

.position-field,
.position-action {
  margin-bottom: 0;
}

.position-input {
  width: 168px;
}

.position-action :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.metrics-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 24px;
  padding: 16px 20px;
  margin-bottom: 16px;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.metric-item .label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 4px;
}

.metric-item .value {
  font-size: 18px;
  font-weight: 700;
}

.metric-item .value.up {
  color: #e74c3c;
}

.metric-item .value.down {
  color: #00b894;
}

.summary-card {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.08), rgba(78, 205, 196, 0.08));
  border: 1px solid rgba(255, 107, 107, 0.15);
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.summary-card h4 {
  margin: 0 0 10px;
  color: var(--primary);
}

.summary-card p {
  margin: 0;
  line-height: 1.8;
  color: #444;
  white-space: pre-wrap;
}

.back-top-btn {
  position: fixed;
  right: 28px;
  bottom: 28px;
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 24px;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}

.back-top-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(255, 107, 107, 0.25);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
