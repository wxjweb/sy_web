/**
 * 将后端时间（ISO UTC 或已本地化字符串）格式化为东八区可读时间。
 */
export function formatMonitorTime(value) {
  if (value == null || value === '') return '—'
  const raw = String(value).trim()
  // 已是本地格式（无 T/Z）直接规范化空格
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    return raw.replace('T', ' ').slice(0, 19)
  }
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    return raw.replace('T', ' ').slice(0, 19)
  }
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value || '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}
