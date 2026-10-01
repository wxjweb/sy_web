/** 问天阁对话 Markdown 渲染 */
import { marked } from 'marked'

marked.setOptions({
  breaks: true,
  gfm: true,
})

export function renderChatMarkdown(text) {
  if (!text) return ''
  try {
    return marked.parse(String(text))
  } catch {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

export function groupConversationsByDate(list) {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  const startOf7 = new Date(startOfToday)
  startOf7.setDate(startOf7.getDate() - 7)
  const startOf30 = new Date(startOfToday)
  startOf30.setDate(startOf30.getDate() - 30)

  const groups = [
    { key: 'today', label: '今天', items: [] },
    { key: 'yesterday', label: '昨天', items: [] },
    { key: 'week', label: '7 天内', items: [] },
    { key: 'month', label: '30 天内', items: [] },
    { key: 'older', label: '更早', items: [] },
  ]

  for (const item of list || []) {
    const d = new Date(item.updated_at || item.created_at)
    if (d >= startOfToday) groups[0].items.push(item)
    else if (d >= startOfYesterday) groups[1].items.push(item)
    else if (d >= startOf7) groups[2].items.push(item)
    else if (d >= startOf30) groups[3].items.push(item)
    else groups[4].items.push(item)
  }
  return groups.filter((g) => g.items.length)
}

/** @deprecated 使用 renderChatMarkdown */
export function formatChatMarkdown(text) {
  return renderChatMarkdown(text)
}
