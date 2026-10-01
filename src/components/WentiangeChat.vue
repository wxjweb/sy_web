<template>
  <div class="wt-chat">
    <!-- 左侧：对话历史 -->
    <aside class="wt-sidebar glass-card">
      <el-button type="primary" round class="new-chat-btn" @click="onNewChat">
        <el-icon><Plus /></el-icon>
        开启新对话
      </el-button>
      <el-input
        v-model="historySearch"
        clearable
        placeholder="搜索对话"
        class="history-search"
        @input="onHistorySearch"
        @clear="loadHistory('')"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <div v-loading="historyLoading" class="history-scroll">
        <template v-for="group in historyGroups" :key="group.key">
          <p class="history-label">{{ group.label }}</p>
          <button
            v-for="item in group.items"
            :key="item.id"
            type="button"
            class="history-item"
            :class="{ active: currentId === item.id }"
            @click="selectConversation(item.id)"
          >
            <span class="history-title">{{ item.title }}</span>
            <el-icon class="history-del" @click.stop="removeConversation(item.id)"><Delete /></el-icon>
          </button>
        </template>
        <p v-if="!historyLoading && !conversations.length" class="history-empty">暂无历史对话</p>
      </div>
    </aside>

    <!-- 中间：主对话区 -->
    <main class="wt-main glass-card">
      <div v-if="!currentId" class="wt-empty">
        <div class="wt-empty-icon">问</div>
        <h3>问天阁 · 股票智能对话</h3>
        <p>宏观研判 · 政策解读 · 个股问答 · 默认模型 {{ meta.model || '—' }}</p>
        <el-button type="primary" round @click="onNewChat">开始新对话</el-button>
      </div>

      <template v-else>
        <div ref="messageListRef" class="message-list">
          <div v-if="!messages.length && !sending" class="welcome-hint">
            向问天阁提问，例如：今日 A 股怎么看？某行业景气度如何？
          </div>

          <template v-for="turn in turns" :key="turn.turnIndex">
            <div
              v-if="turn.user"
              :id="`turn-${turn.turnIndex}`"
              class="msg-row user"
            >
              <div class="msg-bubble">
                <p class="msg-text">{{ turn.user.content }}</p>
                <div v-if="turn.user.attachments?.length" class="msg-attachments">
                  <a
                    v-for="(att, i) in turn.user.attachments"
                    :key="i"
                    :href="att.url"
                    target="_blank"
                    rel="noopener"
                    class="att-tag"
                  >{{ att.name }}</a>
                </div>
              </div>
            </div>

            <div v-if="turn.assistant" class="msg-row assistant">
              <div class="msg-avatar">阁</div>
              <div class="msg-body">
                <el-collapse v-if="turn.assistant.reasoning" v-model="expandedReasonings" class="think-collapse">
                  <el-collapse-item :name="turn.turnIndex">
                    <template #title>
                      <span class="think-title">
                        已思考
                        <template v-if="turn.assistant.thinking_seconds">
                          （用时 {{ turn.assistant.thinking_seconds }} 秒）
                        </template>
                      </span>
                    </template>
                    <div class="think-content">{{ turn.assistant.reasoning }}</div>
                  </el-collapse-item>
                </el-collapse>

                <div v-if="turn.assistant.search_sources?.length" class="search-badge">
                  已检索 {{ turn.assistant.search_sources.length }} 条资讯
                </div>

                <div class="msg-bubble assistant-bubble">
                  <div class="msg-md" v-html="renderChatMarkdown(turn.assistant.content)" />
                  <div class="msg-actions">
                    <el-tooltip content="复制" placement="top">
                      <button type="button" class="action-btn" @click="copyMessage(turn.assistant)">
                        <el-icon><CopyDocument /></el-icon>
                      </button>
                    </el-tooltip>
                  </div>
                </div>

                <div v-if="turn.assistant.suggestions?.length" class="suggestions">
                  <button
                    v-for="(q, i) in turn.assistant.suggestions"
                    :key="i"
                    type="button"
                    class="suggest-chip"
                    @click="askSuggestion(q)"
                  >{{ q }}</button>
                </div>
              </div>
            </div>
          </template>

          <!-- 流式输出中的助手消息 -->
          <div v-if="streaming" :id="`turn-${streaming.turnIndex}`" class="msg-row assistant">
            <div class="msg-avatar">阁</div>
            <div class="msg-body">
              <el-collapse
                v-if="streaming.displayedReasoning || streaming.reasoningRaw"
                v-model="streamingReasoningOpen"
                class="think-collapse"
              >
                <el-collapse-item :name="streaming.turnIndex">
                  <template #title>
                    <span class="think-title">{{ streaming.thinking ? '思考中…' : '已思考' }}</span>
                  </template>
                  <div class="think-content">{{ streaming.displayedReasoning }}</div>
                </el-collapse-item>
              </el-collapse>

              <div v-if="streaming.searchCount" class="search-badge">
                已检索 {{ streaming.searchCount }} 条资讯
              </div>

              <div class="msg-bubble assistant-bubble">
                <div class="msg-md" v-html="streamingHtml" />
              </div>
            </div>
          </div>

          <div v-else-if="sending" class="msg-row assistant">
            <div class="msg-avatar">阁</div>
            <div class="msg-bubble assistant-bubble typing">
              <span class="dot" /><span class="dot" /><span class="dot" />
            </div>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="input-area">
          <div v-if="pendingFiles.length" class="pending-files">
            <el-tag
              v-for="(f, i) in pendingFiles"
              :key="i"
              closable
              size="small"
              @close="removePendingFile(i)"
            >{{ f.name }}</el-tag>
          </div>
          <div class="input-box">
            <el-input
              v-model="inputText"
              type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
              placeholder="向问天阁提问，支持股票、宏观、行业分析…"
              @keydown.enter.exact.prevent="onSend"
            />
            <div class="input-toolbar">
              <div class="toolbar-left">
                <button
                  type="button"
                  class="tool-toggle"
                  :class="{ active: deepThink }"
                  @click="deepThink = !deepThink"
                >
                  <el-icon><Cpu /></el-icon>
                  深度思考
                </button>
                <button
                  type="button"
                  class="tool-toggle"
                  :class="{ active: smartSearch }"
                  @click="smartSearch = !smartSearch"
                >
                  <el-icon><Search /></el-icon>
                  智能搜索
                </button>
                <span class="model-tag">{{ meta.model || '默认模型' }}</span>
              </div>
              <div class="toolbar-right">
                <input ref="fileInputRef" type="file" multiple hidden @change="onFilePick" />
                <input ref="imageInputRef" type="file" accept="image/*" multiple hidden @change="onImagePick" />
                <el-tooltip content="上传附件" placement="top">
                  <button type="button" class="icon-btn" @click="fileInputRef?.click()">
                    <el-icon><Paperclip /></el-icon>
                  </button>
                </el-tooltip>
                <el-tooltip content="上传图片" placement="top">
                  <button type="button" class="icon-btn" @click="imageInputRef?.click()">
                    <el-icon><Picture /></el-icon>
                  </button>
                </el-tooltip>
                <el-button
                  type="primary"
                  circle
                  :loading="sending"
                  :disabled="!canSend"
                  @click="onSend"
                >
                  <el-icon><Top /></el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </main>

    <!-- 右侧：轮次导航 -->
    <aside v-if="currentId && turns.length" class="wt-turns glass-card">
      <p class="turns-title">对话轮次</p>
      <button
        v-for="turn in turns"
        :key="turn.turnIndex"
        type="button"
        class="turn-item"
        :class="{ active: activeTurn === turn.turnIndex }"
        @click="scrollToTurn(turn.turnIndex)"
      >
        <span class="turn-no">第 {{ turn.turnIndex + 1 }} 轮</span>
        <span class="turn-preview">{{ turnPreview(turn) }}</span>
      </button>
    </aside>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createWentiangeConversation,
  deleteWentiangeConversation,
  getWentiangeConversation,
  getWentiangeConversations,
  getWentiangeMeta,
} from '../api'
import { groupConversationsByDate, renderChatMarkdown } from '../utils/wentiangeFormat'
import { extractStreamDisplay, streamWentiangeMessage } from '../utils/wentiangeSse'
import { Typewriter } from '../utils/wentiangeTypewriter'

const meta = reactive({ model: '', max_files: 10, max_file_mb: 10 })
const conversations = ref([])
const historyLoading = ref(false)
const historySearch = ref('')
const currentId = ref(null)
const messages = ref([])
const turns = ref([])
const sending = ref(false)
const streaming = ref(null)
const streamingReasoningOpen = ref([])
const inputText = ref('')
const deepThink = ref(false)
const smartSearch = ref(true)
const pendingFiles = ref([])
const messageListRef = ref(null)
const fileInputRef = ref(null)
const imageInputRef = ref(null)
const activeTurn = ref(0)
const expandedReasonings = ref([])

let streamAbort = null
let answerWriter = null
let reasoningWriter = null
let searchDebounce = null
let rawStream = ''
let reasoningStream = ''

const historyGroups = computed(() => groupConversationsByDate(conversations.value))
const canSend = computed(() => (inputText.value.trim() || pendingFiles.value.length) && !sending.value && !streaming.value)

const streamingHtml = computed(() => {
  if (!streaming.value) return ''
  const html = renderChatMarkdown(streaming.value.displayedAnswer)
  return streaming.value.typing ? `${html}<span class="wt-cursor"></span>` : html
})

function initTypewriters() {
  answerWriter?.destroy()
  reasoningWriter?.destroy()
  answerWriter = new Typewriter((text) => {
    if (streaming.value) streaming.value.displayedAnswer = text
  })
  reasoningWriter = new Typewriter((text) => {
    if (streaming.value) streaming.value.displayedReasoning = text
  })
}

function destroyTypewriters() {
  answerWriter?.destroy()
  reasoningWriter?.destroy()
  answerWriter = null
  reasoningWriter = null
}

function turnPreview(turn) {
  const text = turn.user?.content || turn.assistant?.content || ''
  return text.length > 24 ? `${text.slice(0, 24)}…` : text
}

function buildTurns(msgs, extraAssistant = null) {
  const byTurn = {}
  for (const m of msgs || []) {
    const idx = m.turn_index ?? 0
    const slot = byTurn[idx] || { turnIndex: idx, user: null, assistant: null }
    if (m.role === 'user') slot.user = m
    else slot.assistant = m
    byTurn[idx] = slot
  }
  if (extraAssistant) {
    const idx = extraAssistant.turn_index ?? 0
    const slot = byTurn[idx] || { turnIndex: idx, user: null, assistant: null }
    slot.assistant = extraAssistant
    byTurn[idx] = slot
  }
  return Object.keys(byTurn).sort((a, b) => Number(a) - Number(b)).map((k) => byTurn[k])
}

async function loadMeta() {
  try {
    const { data } = await getWentiangeMeta()
    Object.assign(meta, data)
  } catch { /* ignore */ }
}

async function loadHistory(q = historySearch.value) {
  historyLoading.value = true
  try {
    const params = { limit: 50 }
    if (q?.trim()) params.q = q.trim()
    const { data } = await getWentiangeConversations(params)
    conversations.value = data.list || []
  } catch {
    ElMessage.error('加载对话历史失败')
  } finally {
    historyLoading.value = false
  }
}

function onHistorySearch() {
  clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => loadHistory(historySearch.value), 300)
}

async function selectConversation(id) {
  if (currentId.value === id) return
  cancelStream()
  currentId.value = id
  try {
    const { data } = await getWentiangeConversation(id)
    messages.value = data.messages || []
    turns.value = buildTurns(data.messages)
    activeTurn.value = turns.value.length ? turns.value[turns.value.length - 1].turnIndex : 0
    await nextTick()
    scrollToBottom()
  } catch {
    ElMessage.error('加载对话失败')
  }
}

async function onNewChat() {
  try {
    const { data } = await createWentiangeConversation({ title: '新对话' })
    conversations.value.unshift(data)
    currentId.value = data.id
    messages.value = []
    turns.value = []
    inputText.value = ''
    pendingFiles.value = []
  } catch {
    ElMessage.error('创建对话失败')
  }
}

async function removeConversation(id) {
  try {
    await ElMessageBox.confirm('确定删除该对话？', '提示', { type: 'warning' })
    await deleteWentiangeConversation(id)
    conversations.value = conversations.value.filter((c) => c.id !== id)
    if (currentId.value === id) {
      currentId.value = null
      messages.value = []
      turns.value = []
    }
    ElMessage.success('已删除')
  } catch { /* cancel or error */ }
}

function onFilePick(e) {
  addPendingFiles([...e.target.files])
  e.target.value = ''
}

function onImagePick(e) {
  addPendingFiles([...e.target.files])
  e.target.value = ''
}

function addPendingFiles(files) {
  const max = meta.max_files || 10
  const maxBytes = (meta.max_file_mb || 10) * 1024 * 1024
  for (const f of files) {
    if (pendingFiles.value.length >= max) {
      ElMessage.warning(`最多 ${max} 个文件`)
      break
    }
    if (f.size > maxBytes) {
      ElMessage.warning(`${f.name} 超过 ${meta.max_file_mb}MB`)
      continue
    }
    pendingFiles.value.push(f)
  }
}

function removePendingFile(index) {
  pendingFiles.value.splice(index, 1)
}

function cancelStream() {
  streamAbort?.abort()
  streamAbort = null
  destroyTypewriters()
  streaming.value = null
  rawStream = ''
  reasoningStream = ''
}

async function onSend() {
  if (!canSend.value || !currentId.value) return
  const content = inputText.value.trim()
  const files = [...pendingFiles.value]
  inputText.value = ''
  pendingFiles.value = []
  sending.value = true

  const turnIndex = turns.value.length
  const optimisticUser = {
    role: 'user',
    content: content || '（附件）',
    attachments: files.map((f) => ({ name: f.name })),
    turn_index: turnIndex,
  }
  turns.value = [...turns.value, { turnIndex, user: optimisticUser, assistant: null }]

  rawStream = ''
  reasoningStream = ''
  initTypewriters()
  streaming.value = {
    turnIndex,
    displayedAnswer: '',
    displayedReasoning: '',
    reasoningRaw: '',
    searchCount: 0,
    thinking: deepThink.value,
    typing: true,
  }
  streamingReasoningOpen.value = deepThink.value ? [turnIndex] : []

  const fd = new FormData()
  fd.append('content', content)
  fd.append('deep_think', deepThink.value ? '1' : '0')
  fd.append('smart_search', smartSearch.value ? '1' : '0')
  files.forEach((f) => fd.append('files', f))

  streamAbort = new AbortController()

  try {
    await streamWentiangeMessage(currentId.value, fd, {
      signal: streamAbort.signal,
      retries: 2,
      onEvent: ({ event, data }) => {
        if (event === 'ping') return

        if (event === 'search') {
          if (streaming.value) streaming.value.searchCount = data.count || 0
          return
        }

        if (event === 'user') {
          const idx = turns.value.findIndex((t) => t.turnIndex === turnIndex)
          if (idx >= 0) {
            turns.value[idx] = { ...turns.value[idx], user: data }
            turns.value = [...turns.value]
          }
          return
        }

        if (event === 'delta' && data.content) {
          rawStream += data.content
          const { reasoning, answer } = extractStreamDisplay(rawStream)
          answerWriter?.setTarget(answer)
          if (reasoning) {
            reasoningWriter?.setTarget(reasoning)
            if (streaming.value) streaming.value.reasoningRaw = reasoning
          }
          scrollToBottom()
          return
        }

        if (event === 'reasoning_delta' && data.content) {
          reasoningStream += data.content
          reasoningWriter?.setTarget(reasoningStream)
          if (streaming.value) {
            streaming.value.reasoningRaw = reasoningStream
            streaming.value.thinking = true
          }
          return
        }

        if (event === 'done') {
          answerWriter?.flush()
          reasoningWriter?.flush()
          if (streaming.value) {
            streaming.value.typing = false
            streaming.value.thinking = false
          }
          messages.value = [
            ...messages.value,
            data.user_message,
            data.assistant_message,
          ]
          turns.value = buildTurns(messages.value)
          activeTurn.value = data.assistant_message.turn_index
          const conv = data.conversation
          const cidx = conversations.value.findIndex((c) => c.id === conv.id)
          if (cidx >= 0) {
            conversations.value[cidx] = { ...conversations.value[cidx], ...conv }
          } else {
            conversations.value.unshift(conv)
          }
          streaming.value = null
          destroyTypewriters()
          nextTick(scrollToBottom)
          return
        }

        if (event === 'error') {
          throw new Error(data.error || '流式响应错误')
        }
      },
    })

    if (streaming.value) {
      throw new Error('连接意外中断，请重试')
    }
  } catch (e) {
    if (!streamAbort?.signal.aborted) {
      turns.value = turns.value.filter((t) => t.turnIndex !== turnIndex)
      inputText.value = content
      pendingFiles.value = files
      ElMessage.error(e.message || '发送失败')
    }
    cancelStream()
  } finally {
    sending.value = false
    streamAbort = null
  }
}

function askSuggestion(q) {
  inputText.value = q
  onSend()
}

function copyMessage(msg) {
  const parts = []
  if (msg.reasoning) parts.push(`【思考过程】\n${msg.reasoning}`)
  parts.push(msg.content || '')
  const text = parts.join('\n\n').trim()
  navigator.clipboard?.writeText(text).then(
    () => ElMessage.success('已复制'),
    () => ElMessage.warning('复制失败'),
  )
}

function scrollToTurn(turnIndex) {
  activeTurn.value = turnIndex
  document.getElementById(`turn-${turnIndex}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function scrollToBottom() {
  const el = messageListRef.value
  if (el) el.scrollTop = el.scrollHeight
}

onMounted(async () => {
  initTypewriters()
  await Promise.all([loadMeta(), loadHistory()])
})

onBeforeUnmount(() => {
  cancelStream()
  clearTimeout(searchDebounce)
})
</script>

<style scoped>
.wt-chat {
  display: grid;
  grid-template-columns: 240px 1fr 200px;
  gap: 12px;
  min-height: calc(100vh - 220px);
  height: calc(100vh - 220px);
}

@media (max-width: 1100px) {
  .wt-chat { grid-template-columns: 220px 1fr; }
  .wt-turns { display: none; }
}

@media (max-width: 768px) {
  .wt-chat { grid-template-columns: 1fr; height: auto; min-height: 600px; }
  .wt-sidebar { max-height: 200px; }
}

.wt-sidebar {
  display: flex;
  flex-direction: column;
  padding: 12px;
  overflow: hidden;
}

.new-chat-btn { width: 100%; margin-bottom: 12px; }

.history-search {
  margin-bottom: 10px;
}

.history-search :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.history-scroll {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.history-label {
  margin: 10px 0 6px;
  font-size: 12px;
  color: var(--muted);
}

.history-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  color: var(--text);
  transition: background 0.15s;
}

.history-item:hover, .history-item.active {
  background: rgba(64, 158, 255, 0.1);
}

.history-title {
  flex: 1;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-del {
  opacity: 0;
  color: var(--muted);
  flex-shrink: 0;
}

.history-item:hover .history-del { opacity: 1; }

.history-empty {
  font-size: 12px;
  color: var(--muted);
  text-align: center;
  padding: 16px 0;
}

.wt-main {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}

.wt-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
}

.wt-empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, var(--primary), var(--accent));
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  min-height: 0;
}

.welcome-hint {
  text-align: center;
  color: var(--muted);
  font-size: 14px;
  padding: 48px 16px;
}

.msg-row {
  display: flex;
  margin-bottom: 20px;
}

.msg-row.user { justify-content: flex-end; }

.msg-row.user .msg-bubble {
  max-width: 75%;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(78, 205, 196, 0.12));
  border-radius: 14px 14px 4px 14px;
  padding: 12px 14px;
}

.msg-row.assistant { align-items: flex-start; gap: 10px; }

.msg-avatar {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.msg-body { flex: 1; min-width: 0; max-width: 85%; }

.msg-text { margin: 0; line-height: 1.7; white-space: pre-wrap; word-break: break-word; }

.msg-attachments { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }

.att-tag {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--primary);
  text-decoration: none;
}

.think-collapse {
  margin-bottom: 8px;
  border: none;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
}

.think-collapse :deep(.el-collapse-item__header) {
  height: 36px;
  padding: 0 12px;
  background: transparent;
  font-size: 13px;
  color: var(--muted);
}

.think-content {
  padding: 0 12px 12px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--muted);
  white-space: pre-wrap;
}

.search-badge {
  display: inline-block;
  margin-bottom: 8px;
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.assistant-bubble {
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 4px 14px 14px 14px;
  padding: 14px 16px;
  position: relative;
}

.msg-md :deep(.wt-p) { margin: 0 0 8px; line-height: 1.75; }
.msg-md :deep(.wt-h3), .msg-md :deep(.wt-h4) { margin: 12px 0 6px; font-weight: 700; }
.msg-md :deep(.wt-list) { margin: 8px 0; padding-left: 20px; }
.msg-md :deep(.wt-code) {
  display: block;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  overflow-x: auto;
  font-size: 12px;
}
.msg-md :deep(.wt-inline-code) {
  padding: 1px 4px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.06);
  font-size: 12px;
}

.msg-md :deep(pre) {
  display: block;
  padding: 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.04);
  overflow-x: auto;
  font-size: 12px;
}

.msg-md :deep(.wt-cursor),
.streaming-md :deep(.wt-cursor) {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: text-bottom;
  background: #409eff;
  animation: wt-blink 0.8s step-end infinite;
}

@keyframes wt-blink {
  50% { opacity: 0; }
}

.msg-actions {
  display: flex;
  gap: 4px;
  margin-top: 10px;
}

.action-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
}

.action-btn:hover { background: rgba(0, 0, 0, 0.05); color: var(--primary); }

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.suggest-chip {
  border: 1px solid rgba(64, 158, 255, 0.25);
  background: rgba(64, 158, 255, 0.06);
  color: var(--text);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}

.suggest-chip:hover { background: rgba(64, 158, 255, 0.14); }

.typing { display: flex; gap: 4px; align-items: center; padding: 16px 20px; }
.dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--muted);
  animation: blink 1.2s infinite;
}
.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0.3; }
  40% { opacity: 1; }
}

.input-area {
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  padding: 12px 16px 16px;
  background: rgba(255, 255, 255, 0.5);
}

.pending-files {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.input-box {
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 14px;
  padding: 10px 12px 8px;
  background: #fff;
}

.input-box :deep(.el-textarea__inner) {
  box-shadow: none;
  border: none;
  padding: 0;
  resize: none;
}

.input-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 8px;
}

.toolbar-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.tool-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: transparent;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  color: var(--muted);
}

.tool-toggle.active {
  border-color: rgba(64, 158, 255, 0.4);
  background: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.model-tag {
  font-size: 11px;
  color: var(--muted);
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.04);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
}

.icon-btn:hover { background: rgba(0, 0, 0, 0.05); color: var(--primary); }

.wt-turns {
  padding: 12px;
  overflow-y: auto;
}

.turns-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
}

.turn-item {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 8px 10px;
  margin-bottom: 4px;
  border-radius: 8px;
  cursor: pointer;
}

.turn-item:hover, .turn-item.active {
  background: rgba(64, 158, 255, 0.1);
}

.turn-no {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--primary);
}

.turn-preview {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
