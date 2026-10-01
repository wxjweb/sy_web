<template>

  <el-dialog

    v-model="visible"

    :title="dialogTitle"

    width="640px"

    destroy-on-close

    class="weibo-post-dialog"

    @closed="onClosed"

  >

    <div v-loading="loading || generating" :element-loading-text="generatingText">

      <el-empty v-if="!loading && !generating && !postForm.id && !topic" description="加载失败" />

      <template v-else-if="!loading && !generating && !postForm.id">
        <p class="dialog-hint">{{ emptyHint }}</p>
        <el-button type="primary" round :loading="generating" @click="onGenerate">
          {{ generateLabel }}
        </el-button>
      </template>

      <template v-else-if="postForm.id">

        <div class="post-meta">

          <el-tag size="small" :type="postStatusType(postForm.status)" effect="plain" round>

            {{ postStatusLabel(postForm.status) }}

          </el-tag>

          <span class="word-count" :class="{ 'word-count-warn': wordCountOutOfRange }">

            {{ postForm.word_count }} 字

            <template v-if="finance">（要求 50~300 字）</template>

          </span>

        </div>

        <el-form label-position="top" class="post-form">

          <el-form-item label="微博正文">

            <el-input

              v-model="postForm.content"

              type="textarea"

              :rows="8"

              :readonly="postForm.status === 'published'"

              :maxlength="finance ? 300 : undefined"

              show-word-limit

              placeholder="微博正文"

            />

          </el-form-item>

          <el-form-item label="话题标签">

            <el-input

              v-model="postForm.hashtags"

              :readonly="postForm.status === 'published'"

              placeholder="如 #话题1# #话题2#"

            />

          </el-form-item>

        </el-form>

        <div v-if="postForm.status === 'published' && postForm.weibo_mid" class="published-link">

          <el-link type="success" :href="weiboLink(postForm.weibo_mid)" target="_blank">查看已发布微博</el-link>

        </div>

      </template>

    </div>

    <template v-if="postForm.id" #footer>

      <el-button @click="visible = false">关闭</el-button>

      <el-button @click="copyPostContent">

        <el-icon><CopyDocument /></el-icon>

        复制

      </el-button>

      <el-button

        v-if="postForm.status !== 'published'"

        type="warning"

        :loading="saving"

        @click="savePostContent"

      >

        保存修改

      </el-button>

      <el-button

        v-if="postForm.status !== 'published'"

        type="primary"

        :loading="publishing"

        @click="publishPostContent"

      >

        <el-icon><Promotion /></el-icon>

        发布微博

      </el-button>

    </template>

  </el-dialog>

</template>



<script setup>

import { computed, reactive, ref } from 'vue'

import { ElMessage, ElMessageBox } from 'element-plus'

import {

  generateForFinanceTopic,

  generateForTopic,

  getFinanceTopicWeiboPost,

  getTopicWeiboPost,

  markFinanceWeiboPostPublished,

  markWeiboPostPublished,

  publishFinanceWeiboPost,

  publishWeiboPost,

  updateFinanceWeiboPost,

  updateWeiboPost,

} from '../api'



const props = defineProps({

  finance: { type: Boolean, default: false },

})



const emit = defineEmits(['refreshed'])



const visible = ref(false)

const loading = ref(false)

const generating = ref(false)

const saving = ref(false)

const publishing = ref(false)

const topic = ref(null)



const postForm = reactive({

  id: null,

  content: '',

  hashtags: '',

  status: '',

  word_count: 0,

  weibo_mid: '',

})



const dialogTitle = computed(() => {
  if (!topic.value) return props.finance ? '解读内容' : '微博内容'
  const prefix = props.finance ? '解读内容' : '微博内容'
  return `${prefix} · ${topic.value.title}`
})

const emptyHint = computed(() =>
  props.finance ? '该热搜尚未解读，可先调研并解读。' : '该热搜尚未生成微博，可先调研并生成。',
)

const generateLabel = computed(() => (props.finance ? '调研并解读' : '调研并生成'))

const generatingText = computed(() => {
  if (!generating.value) return '加载中...'
  return props.finance ? '正在调研解读，请稍候...' : '正在调研生成，请稍候...'
})



const wordCountOutOfRange = computed(() => {

  if (!props.finance) return false

  const n = postForm.word_count

  return n < 50 || n > 300

})



function postStatusLabel(s) {

  return { draft: '草稿', published: '已发布', rejected: '已拒绝' }[s] || s

}



function postStatusType(s) {

  return { draft: 'info', published: 'success', rejected: 'danger' }[s] || ''

}



function weiboLink(mid) {

  return `https://weibo.com/${mid}`

}



function resetPostForm() {

  postForm.id = null

  postForm.content = ''

  postForm.hashtags = ''

  postForm.status = ''

  postForm.word_count = 0

  postForm.weibo_mid = ''

}



function fillPostForm(post) {

  postForm.id = post.id

  postForm.content = post.content || ''

  postForm.hashtags = post.hashtags || ''

  postForm.status = post.status || ''

  postForm.word_count = post.word_count || 0

  postForm.weibo_mid = post.weibo_mid || ''

}



async function loadPost() {

  if (!topic.value?.id) return

  loading.value = true

  resetPostForm()

  try {

    const fetcher = props.finance ? getFinanceTopicWeiboPost : getTopicWeiboPost

    const { data } = await fetcher(topic.value.id)

    if (data.post) fillPostForm(data.post)

  } catch (e) {

    ElMessage.error(e.response?.data?.error || (props.finance ? '加载解读失败' : '加载微博失败'))

  } finally {

    loading.value = false

  }

}



async function open(row, options = {}) {

  topic.value = row

  visible.value = true

  await loadPost()

  if (!postForm.id && options.autoGenerate) {

    await onGenerate({ silentSuccess: true })

  }

}



function onClosed() {

  topic.value = null

  resetPostForm()

}



async function onGenerate(options = {}) {

  if (!topic.value?.id) return

  generating.value = true

  try {

    const generator = props.finance ? generateForFinanceTopic : generateForTopic

    await generator(topic.value.id)

    if (!options.silentSuccess) {

      ElMessage.success(props.finance ? '调研完成，解读已生成' : '调研完成，微博已生成')

    }

    const fetcher = props.finance ? getFinanceTopicWeiboPost : getTopicWeiboPost

    const { data } = await fetcher(topic.value.id)

    if (data.post) fillPostForm(data.post)

    emit('refreshed')

  } catch (e) {

    ElMessage.error(e.response?.data?.error || (props.finance ? '解读失败' : '生成失败'))

  } finally {

    generating.value = false

  }

}



function postCopyText() {

  return [postForm.content, postForm.hashtags].filter(Boolean).join('\n\n')

}



async function copyPostContent() {

  const text = postCopyText()

  try {

    await navigator.clipboard.writeText(text)

  } catch {

    ElMessage.warning('复制失败，请手动选择文本')

    return

  }



  if (postForm.status === 'published') {

    ElMessage.success('已复制到剪贴板')

    return

  }



  try {

    const marker = props.finance ? markFinanceWeiboPostPublished : markWeiboPostPublished

    const { data } = await marker(postForm.id)

    if (data.post) fillPostForm(data.post)

    emit('refreshed')

    ElMessage.success('已复制到剪贴板，状态已更新为已发布')

  } catch (e) {

    ElMessage.warning(e.response?.data?.error || '已复制，但状态更新失败')

  }

}



async function savePostContent() {

  saving.value = true

  try {

    const updater = props.finance ? updateFinanceWeiboPost : updateWeiboPost

    const { data } = await updater(postForm.id, {

      content: postForm.content,

      hashtags: postForm.hashtags,

    })

    if (data.post) fillPostForm(data.post)

    ElMessage.success('保存成功')

  } catch (e) {

    ElMessage.error(e.response?.data?.error || '保存失败')

  } finally {

    saving.value = false

  }

}



async function publishPostContent() {

  try {

    await ElMessageBox.confirm(

      '确认将该微博发布到你的微博账号？（超长内容将按平台 140 字限制自动截断）',

      '发布确认',

      { type: 'warning', confirmButtonText: '发布', cancelButtonText: '取消' },

    )

  } catch {

    return

  }



  publishing.value = true

  try {

    const updater = props.finance ? updateFinanceWeiboPost : updateWeiboPost

    const publisher = props.finance ? publishFinanceWeiboPost : publishWeiboPost

    if (postForm.status !== 'published') {

      await updater(postForm.id, {

        content: postForm.content,

        hashtags: postForm.hashtags,

      })

    }

    const { data } = await publisher(postForm.id)

    if (data.post) fillPostForm(data.post)

    emit('refreshed')

    ElMessage.success(data.message || '发布成功')

  } catch (e) {

    ElMessage.error(e.response?.data?.error || '发布失败')

  } finally {

    publishing.value = false

  }

}



defineExpose({ open })

</script>



<style scoped>

.dialog-hint {

  margin: 0 0 12px;

  color: var(--muted);

  font-size: 13px;

}



.post-meta {

  display: flex;

  align-items: center;

  justify-content: space-between;

  margin-bottom: 12px;

}



.post-meta .word-count {

  font-size: 12px;

  color: var(--accent);

  font-weight: 600;

}



.post-meta .word-count-warn {

  color: #e6a23c;

}



.post-form {

  margin-top: 4px;

}



.published-link {

  margin-top: 8px;

}

</style>

