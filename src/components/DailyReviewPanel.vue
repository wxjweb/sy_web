<template>
  <div class="review-panel">
    <p class="intro-quote">
      “观”是深入观察，“复”指循环往复，“观复”的核心含义是：在虚静的心境下摒除主观杂念，观察万物循环往复、终归本原的运动规律，以此认知事物的本质。
    </p>
    <div class="glass-card filter-bar">
      <el-date-picker
        v-model="filters.date"
        type="date"
        placeholder="选择日期"
        value-format="YYYY-MM-DD"
        style="width: 160px"
        @change="loadArticles"
      />
      <el-input
        v-model="filters.title"
        clearable
        placeholder="标题模糊搜索"
        style="width: 220px"
        @keyup.enter="loadArticles"
        @clear="loadArticles"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select
        v-model="filters.slot"
        clearable
        placeholder="时段"
        style="width: 140px"
        @change="loadArticles"
      >
        <el-option v-for="s in slots" :key="s.id" :label="`${s.id} ${s.label}`" :value="s.id" />
      </el-select>
      <el-button type="primary" round :loading="loading" @click="loadArticles">
        查询
      </el-button>
      <el-dropdown trigger="click" @command="onTrigger">
        <el-button round :loading="triggering">
          手动生成
          <el-icon class="el-icon--right"><ArrowDown /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item v-for="s in slots" :key="s.id" :command="s.id">
              {{ s.id }} {{ s.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div v-loading="loading" class="article-list">
      <el-empty v-if="!loading && !articles.length" description="暂无文章，等待定时任务生成或手动触发" />

      <el-collapse v-else v-model="expandedIds" class="article-collapse">
        <el-collapse-item
          v-for="item in articles"
          :key="item.id"
          :name="item.id"
        >
          <template #title>
            <div class="article-head">
              <div class="article-head-main">
                <span class="slot-tag">{{ item.slot }}</span>
                <span class="article-title">{{ item.title }}</span>
                <span v-if="item.summary" class="article-summary">{{ item.summary }}</span>
              </div>
              <el-button
                type="primary"
                size="small"
                round
                class="copy-btn"
                @click.stop="copyArticle(item)"
              >
                <el-icon><CopyDocument /></el-icon>
                复制 {{ item.slot }}
              </el-button>
            </div>
          </template>

          <div class="article-meta">
            <span>{{ item.slot_label }}</span>
            <span>{{ item.trade_date }}</span>
            <span v-if="item.data_sources">来源：{{ item.data_sources }}</span>
            <el-button type="primary" link class="copy-link" @click="copyArticle(item)">
              <el-icon><CopyDocument /></el-icon>
              一键复制 {{ item.slot }} 文章
            </el-button>
          </div>

          <div class="article-body" v-html="item.content_html" />
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMarketArticles, getMarketArticleSlots, triggerMarketArticle } from '../api'

const loading = ref(false)
const triggering = ref(false)
const articles = ref([])
const slots = ref([])
const expandedIds = ref([])

const today = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const filters = reactive({
  date: today(),
  title: '',
  slot: '',
})

const defaultSlots = [
  { id: '06:00', label: '言环球 · 隔夜全球市场纵览' },
  { id: '08:30', label: '言晨策 · 盘前最终定盘与集合竞价前瞻' },
  { id: '09:30', label: '言开盘 · A股竞价与开盘速递' },
  { id: '10:30', label: '言盘中 · A股整点复盘' },
  { id: '11:50', label: '言午评 · A股半日盘点' },
  { id: '14:00', label: '言尾盘 · A股午后关键一小时' },
  { id: '15:10', label: '言收市 · A股收盘综述' },
  { id: '17:30', label: '言复盘 · 今日A股深度复盘与明日展望' },
]

function normalizeSlots(list) {
  return (list || [])
    .map((s) => ({
      id: s.id || s.ID,
      label: s.label || s.Label,
    }))
    .filter((s) => s.id)
}

async function loadSlots() {
  try {
    const { data } = await getMarketArticleSlots()
    const normalized = normalizeSlots(data.slots)
    slots.value = normalized.length ? normalized : defaultSlots
  } catch {
    slots.value = defaultSlots
  }
}

function defaultExpandedIds(list) {
  if (!list?.length) return []
  return [list[list.length - 1].id]
}

async function loadArticles() {
  loading.value = true
  try {
    const params = { date: filters.date }
    if (filters.title) params.title = filters.title
    if (filters.slot) params.slot = filters.slot
    const { data } = await getMarketArticles(params)
    articles.value = data.list || []
    expandedIds.value = defaultExpandedIds(articles.value)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

async function onTrigger(slot) {
  triggering.value = true
  try {
    await triggerMarketArticle(slot)
    ElMessage.success(`${slot} 文章生成任务已触发，请稍后刷新`)
    setTimeout(loadArticles, 8000)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '触发失败')
  } finally {
    triggering.value = false
  }
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function htmlToPlainText(html) {
  const div = document.createElement('div')
  div.innerHTML = html || ''
  return (div.innerText || div.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

function buildArticlePlainText(item) {
  const lines = [
    item.title,
    `${item.slot} ${item.slot_label || ''} · ${item.trade_date}`,
  ]
  if (item.summary) lines.push('', item.summary)
  lines.push('', htmlToPlainText(item.content_html))
  if (item.data_sources) lines.push('', `数据来源：${item.data_sources}`)
  return lines.join('\n').trim()
}

function buildArticleHtml(item) {
  const parts = [
    `<h1 style="font-size:18px;font-weight:bold;margin:0 0 8px;line-height:1.4;">${escapeHtml(item.title)}</h1>`,
    `<p style="color:#666;font-size:13px;margin:0 0 12px;">${escapeHtml(item.slot)} ${escapeHtml(item.slot_label || '')} · ${escapeHtml(item.trade_date)}</p>`,
  ]
  if (item.summary) {
    parts.push(`<p style="color:#666;margin:0 0 12px;"><em>${escapeHtml(item.summary)}</em></p>`)
  }
  parts.push(item.content_html || '')
  if (item.data_sources) {
    parts.push(`<p style="color:#999;font-size:12px;margin-top:16px;">数据来源：${escapeHtml(item.data_sources)}</p>`)
  }
  return parts.join('\n')
}

async function copyArticle(item) {
  const plain = buildArticlePlainText(item)
  const html = buildArticleHtml(item)
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plain)
    } else {
      throw new Error('clipboard unavailable')
    }
    ElMessage.success(`已复制 ${item.slot} 文章，可粘贴至 Word / 微信公众号`)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = plain
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      ElMessage.success(`已复制 ${item.slot} 文章（纯文本）`)
    } catch {
      ElMessage.warning('复制失败，请手动选择正文复制')
    } finally {
      document.body.removeChild(ta)
    }
  }
}

onMounted(async () => {
  await loadSlots()
  await loadArticles()
})
</script>

<style scoped>
.intro-quote {
  margin: 0 0 16px;
  padding: 12px 16px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--muted);
  border-left: 3px solid var(--accent);
  border-radius: 0 8px 8px 0;
  background: rgba(78, 205, 196, 0.06);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.article-list {
  min-height: 200px;
}

.article-collapse {
  border: none;
}

.article-collapse :deep(.el-collapse-item) {
  margin-bottom: 12px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 107, 107, 0.12);
}

.article-collapse :deep(.el-collapse-item__header) {
  height: auto;
  min-height: 52px;
  padding: 12px 16px;
  line-height: 1.5;
  background: transparent;
}

.article-collapse :deep(.el-collapse-item__wrap) {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.article-collapse :deep(.el-collapse-item__content) {
  padding: 16px 20px 20px;
}

.article-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  padding-right: 12px;
}

.article-head-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.copy-btn {
  flex-shrink: 0;
}

.slot-tag {
  flex-shrink: 0;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--accent));
}

.article-title {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
}

.article-summary {
  flex: 1 1 100%;
  font-size: 13px;
  color: var(--muted);
}

.article-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--muted);
}

.copy-link {
  margin-left: auto;
  font-size: 13px;
}

.article-body :deep(h3) {
  margin: 1.75em 0 0.75em;
  font-size: 20px;
  line-height: 1.5;
  letter-spacing: 1px;
  color: var(--primary);
}

.article-body :deep(p) {
  margin: 1.75em 0;
  font-size: 19px;
  line-height: 1.5;
  letter-spacing: 1px;
  color: var(--text);
}

.article-body :deep(.key-data),
.article-body :deep(strong.key-data) {
  font-weight: 800;
  color: #e74c3c;
  background: rgba(231, 76, 60, 0.08);
  padding: 0 4px;
  border-radius: 3px;
}

.article-body :deep(.highlight) {
  font-weight: 700;
  color: #0984e3;
}

.article-body :deep(.tag-warn) {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 17px;
  color: #d35400;
  background: rgba(243, 156, 18, 0.15);
}

.article-body :deep(.disclaimer) {
  margin-top: 1.75em;
  padding-top: 12px;
  border-top: 1px dashed rgba(0, 0, 0, 0.06);
}

.article-body :deep(ul) {
  padding-left: 20px;
  margin: 1.75em 0;
}

.article-body :deep(li) {
  margin: 0.5em 0;
  font-size: 19px;
  line-height: 1.5;
  letter-spacing: 1px;
}
</style>
