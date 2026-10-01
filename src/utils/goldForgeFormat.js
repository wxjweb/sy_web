/** 铸金台模块内容格式化 */

export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const HIGHLIGHT_WORDS = [
  '强烈看好', '强烈买入', '看好', '买入', '中性', '持有', '谨慎', '回避', '卖出', '减持',
  '利好', '利空', '偏空', '偏多', '溢价', '折价', '平价',
  'S级', 'A级', 'B级', '强共振', '策略修正',
]

export function formatRichText(text) {
  if (!text) return ''
  let raw = String(text)
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<result>[\s\S]*?<\/result>/gi, '')
    .trim()
  if (!raw) return ''
  let html = escapeHtml(raw)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/^###\s+(.+)$/gm, '<h4 class="gf-h4">$1</h4>')
  html = html.replace(/^##\s+(.+)$/gm, '<h3 class="gf-h3">$1</h3>')
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (m) => `<ul class="gf-list">${m}</ul>`)
  html = html.replace(/\n{2,}/g, '</p><p class="gf-p">')
  html = html.replace(/\n/g, '<br>')
  for (const w of HIGHLIGHT_WORDS) {
    html = html.replaceAll(w, `<span class="gf-kw">${w}</span>`)
  }
  return `<p class="gf-p">${html}</p>`
}

export function conclusionType(value) {
  const v = String(value || '')
  if (/利好|看好|买入|强烈|溢价|S级|A级/.test(v)) return 'positive'
  if (/利空|谨慎|回避|卖出|减持|折价|偏空|B级/.test(v)) return 'negative'
  if (/中性|持有|平价|观望/.test(v)) return 'neutral'
  if (/警告|修正|风险/.test(v)) return 'warning'
  return 'default'
}

export function importanceType(level) {
  const v = String(level || '')
  if (v === '高') return 'danger'
  if (v === '中') return 'warning'
  return 'info'
}

export function scoreClass(score) {
  if (score > 0) return 'score-up'
  if (score < 0) return 'score-down'
  return 'score-flat'
}

export function normalizeResult(result) {
  if (!result || typeof result !== 'object') return result
  const keys = Object.keys(result)
  const isFallbackShape =
    keys.length <= 2 &&
    typeof result.summary === 'string' &&
    !result.fundamental &&
    !result.peers &&
    !result.plans &&
    !result.steps
  if (isFallbackShape) {
    const raw = result.summary
    const reasoningMatch = raw.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
    const cleaned = raw
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/i, '')
      .replace(/<result>[\s\S]*?<\/result>/i, '')
      .trim()
    return {
      _fallback: true,
      _reasoningExtra: reasoningMatch?.[1]?.trim() || '',
      _text: cleaned || raw,
    }
  }
  return result
}
