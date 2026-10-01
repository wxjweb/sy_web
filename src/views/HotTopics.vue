<template>
  <div class="page" @paste="onPaste">
    <h1 class="page-title">热搜榜单</h1>

    <div
      class="glass-card ocr-zone"
      :class="{ 'is-dragover': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div class="ocr-inner">
        <el-icon :size="36" color="#ff6b6b"><Picture /></el-icon>
        <p class="ocr-tip">上传或粘贴热搜榜单截图，自动识别排名与标题</p>
        <p class="ocr-sub">支持 JPG / PNG / WebP，可 Ctrl+V 粘贴截图</p>
        <div class="ocr-actions">
          <el-upload
            :show-file-list="false"
            accept="image/jpeg,image/png,image/webp,image/gif"
            :before-upload="onBeforeUpload"
          >
            <el-button type="primary" round :loading="ocrLoading">
              <el-icon><Upload /></el-icon>
              选择图片
            </el-button>
          </el-upload>
          <el-select v-model="ocrSource" style="width: 130px">
            <el-option v-for="s in importSources" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </div>
        <img v-if="previewUrl" :src="previewUrl" class="ocr-preview" alt="预览" />
      </div>
    </div>

    <div class="glass-card toolbar">
      <el-input
        v-model="filters.keyword"
        placeholder="搜索热搜标题"
        clearable
        style="width: 220px"
        @keyup.enter="onSearch"
        @clear="onSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select v-model="filters.source" placeholder="来源" clearable style="width: 140px">
        <el-option v-for="s in sources" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="filters.category" placeholder="分类" clearable style="width: 140px">
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-model="filters.status" placeholder="状态" clearable style="width: 140px">
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
      <el-table :data="list" stripe style="width: 100%">
        <el-table-column prop="rank" label="排名" width="70" />
        <el-table-column prop="title" label="热搜标题" min-width="200">
          <template #default="{ row }">
            <el-button type="primary" link class="title-link" @click="openPostDialog(row)">
              {{ row.title }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="110">
          <template #default="{ row }">
            <el-tag :type="categoryTagType(row.category)" effect="plain" round size="small">
              {{ labelCategory(row.category) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="来源" width="110">
          <template #default="{ row }">
            <el-tag :type="sourceTagType(row.source)" effect="light" round>
              {{ labelSource(row.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="heat" label="热度" width="100" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" effect="plain" round>{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="抓取时间" width="170">
          <template #default="{ row }">{{ formatTime(row.fetched_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              link
              :loading="generatingId === row.id"
              @click="onGenerate(row.id)"
            >
              调研并生成
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="size"
          :total="total"
          layout="total, prev, pager, next"
          background
          @current-change="load"
        />
      </div>
    </div>

    <el-dialog v-model="manualDialogVisible" title="手动添加热搜" width="480px" destroy-on-close @closed="resetManualForm">
      <el-form ref="manualFormRef" :model="manualForm" :rules="manualRules" label-width="80px">
        <el-form-item label="热搜标题" prop="title">
          <el-input
            v-model="manualForm.title"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请输入热搜标题"
          />
        </el-form-item>
        <el-form-item label="来源" prop="source">
          <el-select v-model="manualForm.source" style="width: 100%">
            <el-option label="手动添加" value="manual" />
            <el-option v-for="s in crawlSources" :key="s.id" :label="s.name" :value="s.id" />
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
      <p class="dialog-hint">共识别 {{ ocrItems.length }} 条，确认后将导入榜单（重复标题同日会跳过）</p>
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

    <HotTopicWeiboDialog ref="weiboDialogRef" @refreshed="load" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import HotTopicWeiboDialog from '../components/HotTopicWeiboDialog.vue'
import {
  createHotTopic,
  generateForTopic,
  getCategories,
  getHotTopics,
  getSources,
  importHotTopics,
  ocrHotTopicsImage,
} from '../api'
import {
  fallbackSources,
  hotTopicsPageSources,
  sourceLabel,
  sourceTagType,
} from '../utils/sources'
import { categoryLabel, categoryTagType, fallbackCategories } from '../utils/categories'

const sources = ref(hotTopicsPageSources(fallbackSources))
const categories = ref([...fallbackCategories])
const crawlSources = computed(() =>
  sources.value.filter((s) => ['baidu', 'weibo', 'toutiao', 'douyin', 'kuaishou'].includes(s.id))
)
const importSources = computed(() =>
  sources.value.filter((s) => ['baidu', 'weibo', 'toutiao', 'douyin', 'kuaishou'].includes(s.id))
)

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const size = ref(20)
const generatingId = ref(null)
const weiboDialogRef = ref(null)
const filters = reactive({ source: '', status: '', keyword: '', category: '' })

const ocrLoading = ref(false)
const importLoading = ref(false)
const ocrSource = ref('weibo')
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

function openPostDialog(row) {
  weiboDialogRef.value?.open(row)
}

function formatTime(t) {
  return t ? new Date(t).toLocaleString('zh-CN') : ''
}

function labelSource(id) {
  return sourceLabel(id, fallbackSources)
}

function labelCategory(id) {
  return categoryLabel(id, categories.value)
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
    const { data } = await createHotTopic({
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

function statusLabel(s) {
  return { pending: '待处理', processed: '已处理', skipped: '已跳过' }[s] || s
}

function statusType(s) {
  return { pending: 'warning', processed: 'success', skipped: 'info' }[s] || ''
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
    const { data } = await ocrHotTopicsImage(file)
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
    const { data } = await importHotTopics({
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
    const { data } = await getHotTopics({
      page: page.value,
      size: size.value,
      source: filters.source || undefined,
      status: filters.status || undefined,
      keyword: filters.keyword.trim() || undefined,
      category: filters.category || undefined,
    })
    list.value = data.list || []
    total.value = data.total || 0
  } finally {
    loading.value = false
  }
}

async function onGenerate(id) {
  generatingId.value = id
  try {
    await generateForTopic(id)
    ElMessage.success('调研完成，微博已生成')
    load()
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '生成失败')
  } finally {
    generatingId.value = null
  }
}

onMounted(async () => {
  try {
    const [srcRes, catRes] = await Promise.all([getSources(), getCategories()])
    if (Array.isArray(srcRes.data) && srcRes.data.length) sources.value = hotTopicsPageSources(srcRes.data)
    if (Array.isArray(catRes.data) && catRes.data.length) categories.value = catRes.data
  } catch {
    /* use fallback */
  }
  load()
})
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
</script>

<style scoped>
.page {
  padding: 8px 4px 32px;
}

.ocr-zone {
  margin: 16px 0;
  padding: 24px;
  border: 2px dashed rgba(255, 107, 107, 0.35);
  transition: border-color 0.2s, background 0.2s;
}

.ocr-zone.is-dragover {
  border-color: #4ecdc4;
  background: rgba(78, 205, 196, 0.08);
}

.ocr-inner {
  text-align: center;
}

.ocr-tip {
  margin: 12px 0 4px;
  font-weight: 600;
  color: #444;
}

.ocr-sub {
  margin: 0 0 16px;
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
  margin-top: 16px;
  max-height: 200px;
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.toolbar {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  margin: 20px 0;
  flex-wrap: wrap;
}

.table-wrap {
  padding: 16px;
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.dialog-hint {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: 13px;
}

.form-hint {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
}

.title-link {
  font-weight: 600;
  text-align: left;
  white-space: normal;
  line-height: 1.4;
  height: auto;
  padding: 0;
}
</style>
