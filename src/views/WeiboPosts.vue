<template>
  <div class="page">
    <h1 class="page-title">微博列表</h1>
    <div class="glass-card toolbar">
      <el-select v-model="source" placeholder="来源筛选" clearable style="width: 140px" @change="load">
        <el-option v-for="s in sources" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="category" placeholder="分类筛选" clearable style="width: 140px" @change="load">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-model="status" placeholder="发布状态" clearable style="width: 140px" @change="load">
        <el-option label="草稿" value="draft" />
        <el-option label="已发布" value="published" />
      </el-select>
      <el-button round @click="load"><el-icon><Refresh /></el-icon> 刷新</el-button>
    </div>

    <el-row :gutter="20" v-loading="loading">
      <el-col :xs="24" :md="12" :lg="8" v-for="post in list" :key="post.id">
        <div class="glass-card post-card">
          <div class="post-head">
            <div class="tags">
              <el-tag size="small" :type="categoryTagType(post.category)" effect="plain" round>
                {{ labelCategory(post.category) }}
              </el-tag>
              <el-tag size="small" :type="sourceTagType(post.source)" effect="light" round>
                {{ labelSource(post.source) }}
              </el-tag>
              <el-tag size="small" :type="statusTagType(post.status)" effect="plain" round>
                {{ statusLabel(post.status) }}
              </el-tag>
            </div>
            <span class="word-count">{{ post.word_count }} 字</span>
          </div>
          <h4>{{ post.title }}</h4>
          <p class="weibo-content">{{ post.content }}</p>
          <p v-if="post.hashtags" class="hashtags hashtag">{{ post.hashtags }}</p>
          <div class="post-foot">
            <span>{{ formatTime(post.published_at || post.created_at) }}</span>
            <div class="actions">
              <el-button type="primary" link @click="copyPost(post)">
                <el-icon><CopyDocument /></el-icon> 复制
              </el-button>
              <el-button
                v-if="post.status !== 'published'"
                type="primary"
                link
                :loading="publishingId === post.id"
                @click="onPublish(post)"
              >
                <el-icon><Promotion /></el-icon> 发布
              </el-button>
              <el-link
                v-else-if="post.weibo_mid"
                type="success"
                :href="weiboLink(post.weibo_mid)"
                target="_blank"
              >
                查看微博
              </el-link>
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-empty v-if="!loading && !list.length" description="还没有生成的微博" />

    <div class="pager" v-if="total > size">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="size"
        :total="total"
        layout="total, prev, pager, next"
        background
        @current-change="load"
      />
    </div>

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
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getCategories, getSources, getWeiboPosts, markWeiboPostPublished, publishWeiboPost } from '../api'
import { categoryLabel, categoryTagType, fallbackCategories } from '../utils/categories'
import { fallbackSources, sourceLabel, sourceTagType } from '../utils/sources'

const sources = ref([...fallbackSources])
const categories = ref([...fallbackCategories])

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(12)
const source = ref('')
const category = ref('')
const status = ref('')
const publishingId = ref(null)
const showBackTop = ref(false)

const BACKTOP_VISIBLE = 300
let scrollContainer = null

function getScrollContainer() {
  return document.querySelector('.layout .el-main.main') || document.querySelector('.layout .el-main')
}

function getScrollTop() {
  if (scrollContainer) return scrollContainer.scrollTop
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
  scrollContainer = getScrollContainer()
  const target = scrollContainer || window
  target.addEventListener('scroll', updateBackTopVisible, { passive: true })
  return target
}

let scrollTarget = null

function formatTime(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}

function statusLabel(s) {
  return { draft: '草稿', published: '已发布', rejected: '已拒绝' }[s] || s
}

function statusTagType(s) {
  return { draft: 'info', published: 'success', rejected: 'danger' }[s] || ''
}

function labelSource(id) {
  return sourceLabel(id, sources.value)
}

function labelCategory(id) {
  return categoryLabel(id, categories.value)
}

function weiboLink(mid) {
  return `https://weibo.com/${mid}`
}

async function load() {
  loading.value = true
  try {
    const { data } = await getWeiboPosts({
      page: page.value,
      size: size.value,
      source: source.value || undefined,
      category: category.value || undefined,
      status: status.value || undefined,
    })
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

async function copyPost(post) {
  const text = [post.content, post.hashtags].filter(Boolean).join('\n\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    ElMessage.warning('复制失败，请手动选择文本')
    return
  }

  if (post.status === 'published') {
    ElMessage.success('已复制到剪贴板')
    return
  }

  try {
    const { data } = await markWeiboPostPublished(post.id)
    const idx = list.value.findIndex((p) => p.id === post.id)
    if (idx >= 0 && data.post) {
      list.value[idx] = data.post
    }
    ElMessage.success('已复制到剪贴板，状态已更新为已发布')
  } catch (e) {
    ElMessage.warning(e.response?.data?.error || '已复制，但状态更新失败')
  }
}

async function onPublish(post) {
  try {
    await ElMessageBox.confirm(
      '确认将该微博发布到你的微博账号？（超长内容将按平台 140 字限制自动截断）',
      '发布确认',
      { type: 'warning', confirmButtonText: '发布', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  publishingId.value = post.id
  try {
    const { data } = await publishWeiboPost(post.id)
    const idx = list.value.findIndex((p) => p.id === post.id)
    if (idx >= 0 && data.post) {
      list.value[idx] = data.post
    }
    ElMessage.success(data.message || '发布成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '发布失败')
  } finally {
    publishingId.value = null
  }
}

onMounted(async () => {
  scrollTarget = bindScrollListener()
  updateBackTopVisible()
  try {
    const [srcRes, catRes] = await Promise.all([getSources(), getCategories()])
    if (Array.isArray(srcRes.data) && srcRes.data.length) sources.value = srcRes.data
    if (Array.isArray(catRes.data) && catRes.data.length) categories.value = catRes.data
  } catch {
    /* use fallback */
  }
  await load()
  updateBackTopVisible()
})

onBeforeUnmount(() => {
  scrollTarget?.removeEventListener('scroll', updateBackTopVisible)
})
</script>

<style scoped>
.page {
  padding: 8px 4px 32px;
}

.toolbar {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.post-card {
  padding: 20px;
  margin-bottom: 20px;
  min-height: 220px;
  display: flex;
  flex-direction: column;
}

.post-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.post-card h4 {
  margin: 12px 0 8px;
  font-size: 15px;
}

.hashtags {
  margin: 8px 0;
  font-size: 14px;
}

.post-foot {
  margin-top: auto;
  padding-top: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--muted);
  flex-wrap: wrap;
  gap: 8px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.word-count {
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
  white-space: nowrap;
}

.pager {
  display: flex;
  justify-content: center;
  margin-top: 8px;
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
