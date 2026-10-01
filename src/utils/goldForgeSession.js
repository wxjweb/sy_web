/** 将历史会话数据转换为分析结果结构，供结果面板复用 */

export function sessionToResult(session) {
  if (!session) return null
  return {
    session_id: session.id,
    stock: {
      code: session.stock_code,
      name: session.stock_name,
    },
    snapshot: session.snapshot || session.technical_data || {},
    modules: session.modules || {},
    s_resonance_alert: session.s_resonance_alert || null,
    memory_injected: session.memory_summary || '',
  }
}

export function formatSessionTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const RISK_PROFILE_LABELS = {
  conservative: '保守',
  moderate: '稳健',
  aggressive: '激进',
}
