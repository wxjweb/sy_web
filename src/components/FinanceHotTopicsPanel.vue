<template>
  <div class="finance-hot-panel" @paste="onPaste">
    <div class="glass-card intro-bar">
      <p class="intro-text">
        汇聚当日财经、股票相关热搜，支持截图识别与手动录入，可一键调研并解读。
      </p>
      <el-button type="primary" round :loading="crawling" @click="onCrawl">
        <el-icon><Refresh /></el-icon>
        抓取财经热搜
      </el-button>
    </div>

    <div
      class="glass-card ocr-zone"
      :class="{ 'is-dragover': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="ocr-inner">
        <el-icon :size="32" color="#e6a23c"><Picture /></el-icon>
        <p class="ocr-tip">上传财经热搜截图，自动识别排名与标题</p>
        <p class="ocr-sub">支持 JPG / PNG / WebP，可 Ctrl+V 粘贴截图</p>
        <div class="ocr-actions">
          <el-upload
            :show-file-list="false"
            accept="image/jpeg,image/png,image/webp,image/gif"
            :before-upload="onBeforeUpload"
          >
            <el-button type="warning" round plain :loading="ocrLoading">
              <el-icon><Upload /></el-icon>
              选择图片
            </el-button>
          </el-upload>
          <el-select v-model="ocrSource" style="width: 140px">
            <el-option v-for="s in financeImportSources" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </div>
        <img v-if="previewUrl" :src="previewUrl" class="ocr-preview" alt="预览" />
      </div>
    </div>

    <div class="glass-card toolbar">
      <el-radio-group v-model="scope" @change="onSearch">
        <el-radio-button value="today">今日</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
      <el-input
        v-model="filters.keyword"
        placeholder="搜索财经热搜标题"
        clearable
        style="width: 220px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filters.source" placeholder="财经来源" clearable style="width: 150px">
        <el-option v-for="s in financeSources" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 130px">
        <el-option label="待处理" value="pending" />
        <el-option label="已处理" value="processed" />
        <el-option label="已跳过" value="skipped" />
      </el-select>
      <el-button type="primary" round @click="onSearch">
        <el-icon><Search /></el-icon>
        查询
      </el-button>
      <el-button type="success" round @click="openManualDialog">
        <el-icon><Plus /></el-icon>
        手动添加
      </el-button>
    </div>

    <div class="glass-card table-wrap" v-loading="loading">
      <div v-if="displayList.length" class="hot-split">
        <div v-for="(colItems, colIndex) in splitColumns" :key="colIndex" class="hot-column">
          <div class="hot-thead">
            <span class="col-rank">序号</span>
            <span class="col-title">热搜标题</span>
          </div>
          <div
            v-for="(item, rowIndex) in colItems"
            :key="item.row.id"
            class="hot-row"
            :class="{ stripe: rowIndex % 2 === 1 }"
          >
            <span class="col-rank rank-num">{{ item.seq }}</span>
            <div class="col-title title-cell">
              <button type="button" class="title-btn" @click="openPostDialog(item.row)">
                {{ item.row.title }}
              </button>
              <el-tag :type="sourceTagType(item.row.source)" effect="light" round size="small" class="source-tag">
                {{ labelSource(item.row.source) }}
              </el-tag>
              <el-tooltip content="调研并解读" placement="top">
                <el-button
                  type="primary"
                  circle
                  size="small"
                  class="gen-btn"
                  @click.stop="onInterpretClick(item.row)"
                >
                  <el-icon><MagicStick /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
      <el-empty v-else-if="!loading" description="暂无财经热搜数据" />
      <div class="pager">
        <el-pagination
          v-if="scope === 'all'"
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="load"
        />
        <span v-else class="today-count">今日共 {{ displayList.length }} 条财经热搜</span>
      </div>
    </div>

    <el-dialog v-model="manualDialogVisible" title="手动添加财经热搜" width="480px" destroy-on-close @closed="resetManualForm">
      <el-form ref="manualFormRef" :model="manualForm" :rules="manualRules" label-width="80px">
        <el-form-item label="热搜标题" prop="title">
          <el-input
            v-model="manualForm.title"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入财经热搜标题"
          />
        </el-form-item>
        <el-form-item label="来源" prop="source">
          <el-select v-model="manualForm.source" style="width: 100%">
            <el-option label="手动添加" value="manual" />
            <el-option v-for="s in financeCrawlSources" :key="s.id" :label="s.name" :value="s.id" />
            <el-option label="截图识别" value="screenshot" />
          </el-select>
        </el-form-item>
        <el-form-item label="排名" prop="rank">
          <el-input-number v-model="manualForm.rank" :min="1" :max="9999" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="热度" prop="heat">
          <el-input v-model="manualForm.heat" placeholder="选填，如 105万" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="manualDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="manualSubmitting" @click="onManualSubmit">确定添加</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="ocrDialogVisible" title="识别结果" width="640px" destroy-on-close>
      <p class="dialog-hint">共识别 {{ ocrItems.length }} 条，确认后将导入财经热搜榜单</p>
      <el-table :data="ocrItems" max-height="360" size="small" stripe>
        <el-table-column prop="rank" label="排名" width="70" />
        <el-table-column prop="title" label="热搜标题" show-overflow-tooltip />
        <el-table-column prop="heat" label="热度" width="110" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button @click="ocrDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="importLoading" @click="onImport">导入榜单</el-button>
      </template>
    </el-dialog>

    <HotTopicWeiboDialog ref="weiboDialogRef" finance @refreshed="load" />

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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import HotTopicWeiboDialog from './HotTopicWeiboDialog.vue'
import {
  createFinanceHotTopic,
  getFinanceHotTopics,
  getSources,
  importFinanceHotTopics,
  ocrFinanceHotTopicsImage,
  triggerFinanceTask,
} from '../api'
import {
  crawlableSources,
  fallbackSources,
  importableSources,
  sourceLabel,
  sourceTagType,
} from '../utils/sources'

const FINANCE_SOURCE_IDS = new Set([
  'zqrb', 'ths', 'wallstreetcn', 'gelonghui', 'eastmoney', 'cls',
  'xueqiu', 'taoguba', 'sina_finance', 'cnfol', 'lixinger', 'ttjj',
  'sina', 'netease', 'tencent',
])

const loading = ref(false)
const crawling = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(50)
const scope = ref('today')
const weiboDialogRef = ref(null)
const showBackTop = ref(false)
const sources = ref([...fallbackSources])

const BACKTOP_VISIBLE = 300
let scrollContainer = null
let scrollTarget = null

const filters = reactive({ source: '', status: '', keyword: '' })

const financeSources = computed(() =>
  sources.value.filter((s) => FINANCE_SOURCE_IDS.has(s.id))
)
const financeCrawlSources = computed(() => crawlableSources(financeSources.value))
const financeImportSources = computed(() =>
  importableSources(financeSources.value).filter((s) => FINANCE_SOURCE_IDS.has(s.id))
)

const displayList = computed(() => list.value)

const splitColumns = computed(() => {
  const items = displayList.value
  const base = scope.value === 'all' ? (page.value - 1) * size.value : 0
  const mid = Math.ceil(items.length / 2)
  return [
    items.slice(0, mid).map((row, i) => ({ row, seq: base + i + 1 })),
    items.slice(mid).map((row, i) => ({ row, seq: base + mid + i + 1 })),
  ]
})

const ocrLoading = ref(false)
const importLoading = ref(false)
const ocrSource = ref('eastmoney')
const ocrItems = ref([])
const ocrDialogVisible = ref(false)
const previewUrl = ref('')
const dragOver = ref(false)

const manualDialogVisible = ref(false)
const manualSubmitting = ref(false)
const manualFormRef = ref(null)
const manualForm = reactive({
  title: '',
  source: 'manual',
  rank: 1,
  heat: '',
})
const manualRules = {
  title: [
    { required: true, message: '请输入热搜标题', trigger: 'blur' },
    { min: 2, max: 200, message: '标题长度 2~200 字', trigger: 'blur' },
  ],
  source: [{ required: true, message: '请选择来源', trigger: 'change' }],
}

function todayIso() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function labelSource(id) {
  return sourceLabel(id, sources.value)
}

function openManualDialog() {
  manualDialogVisible.value = true
}

function resetManualForm() {
  manualForm.title = ''
  manualForm.source = 'manual'
  manualForm.rank = 1
  manualForm.heat = ''
  manualFormRef.value?.clearValidate()
}

async function onManualSubmit() {
  const valid = await manualFormRef.value?.validate().catch(() => false)
  if (!valid) return
  manualSubmitting.value = true
  try {
    const { data } = await createFinanceHotTopic({
      title: manualForm.title.trim(),
      source: manualForm.source,
      rank: manualForm.rank,
      heat: manualForm.heat.trim(),
    })
    ElMessage.success(data.message || '添加成功')
    manualDialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '添加失败')
  } finally {
    manualSubmitting.value = false
  }
}

function openPostDialog(row) {
  weiboDialogRef.value?.open(row)
}

function onInterpretClick(row) {
  weiboDialogRef.value?.open(row, { autoGenerate: row.status === 'pending' })
}

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

function setPreview(file) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(file)
}

async function recognizeFile(file) {
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件')
    return
  }
  setPreview(file)
  ocrLoading.value = true
  try {
    const { data } = await ocrFinanceHotTopicsImage(file)
    ocrItems.value = data.items || []
    if (!ocrItems.value.length) {
      ElMessage.warning('未识别到热搜条目')
      return
    }
    ocrDialogVisible.value = true
    ElMessage.success(`识别到 ${ocrItems.value.length} 条热搜`)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '识别失败')
  } finally {
    ocrLoading.value = false
  }
}

function onBeforeUpload(file) {
  recognizeFile(file)
  return false
}

function onDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) recognizeFile(file)
}

function onPaste(e) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) recognizeFile(file)
      return
    }
  }
}

async function onImport() {
  importLoading.value = true
  try {
    const { data } = await importFinanceHotTopics({
      source: ocrSource.value,
      items: ocrItems.value,
    })
    ElMessage.success(data.message || '导入成功')
    ocrDialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '导入失败')
  } finally {
    importLoading.value = false
  }
}

function onSearch() {
  page.value = 1
  load()
}

async function load() {
  loading.value = true
  try {
    const { data } = await getFinanceHotTopics({
      page: page.value,
      size: scope.value === 'today' ? 100 : size.value,
      source: filters.source || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword.trim() || undefined,
      date_from: scope.value === 'today' ? todayIso() : undefined,
      date_to: scope.value === 'today' ? todayIso() : undefined,
    })
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

async function onCrawl() {
  crawling.value = true
  try {
    await triggerFinanceTask()
    ElMessage.success('财经热搜抓取任务已触发，请稍后刷新')
    setTimeout(load, 5000)
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '抓取失败')
  } finally {
    crawling.value = false
  }
}

onMounted(async () => {
  scrollTarget = bindScrollListener()
  updateBackTopVisible()
  try {
    const { data } = await getSources()
    if (Array.isArray(data) && data.length) sources.value = data
  } catch {
    /* use fallback */
  }
  await load()
  updateBackTopVisible()
})

onBeforeUnmount(() => {
  scrollTarget?.removeEventListener('scroll', updateBackTopVisible)
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.intro-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.intro-text {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.6;
  flex: 1;
}

.ocr-zone {
  margin-bottom: 12px;
  padding: 20px;
  border: 2px dashed rgba(230, 162, 60, 0.45);
  transition: border-color 0.2s, background 0.2s;
}

.ocr-zone.is-dragover {
  border-color: #e6a23c;
  background: rgba(230, 162, 60, 0.08);
}

.ocr-inner {
  text-align: center;
}

.ocr-tip {
  margin: 10px 0 4px;
  font-weight: 600;
  color: #444;
}

.ocr-sub {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--muted);
}

.ocr-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.ocr-preview {
  margin-top: 14px;
  max-height: 180px;
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.toolbar {
  display: flex;
  gap: 12px;
  padding: 14px 20px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.table-wrap {
  padding: 16px;
}

.hot-split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 900px) {
  .hot-split {
    grid-template-columns: 1fr;
  }
}

.hot-column {
  min-width: 0;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 10px;
  overflow: hidden;
}

.hot-thead,
.hot-row {
  display: grid;
  grid-template-columns: 56px 1fr;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
}

.hot-thead {
  background: rgba(0, 0, 0, 0.03);
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.hot-row {
  font-size: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.hot-row:last-child {
  border-bottom: none;
}

.hot-row.stripe {
  background: rgba(0, 0, 0, 0.02);
}

.rank-num {
  text-align: center;
  font-weight: 600;
  color: var(--muted);
}

.title-cell {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.title-btn {
  border: none;
  background: none;
  padding: 0;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary);
  text-align: left;
  line-height: 1.45;
  cursor: pointer;
}

.title-btn:hover {
  text-decoration: underline;
}

.source-tag {
  flex-shrink: 0;
}

.gen-btn {
  flex-shrink: 0;
  margin-left: auto;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.today-count {
  font-size: 13px;
  color: var(--muted);
}

.dialog-hint {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 13px;
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
