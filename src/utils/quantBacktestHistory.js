const STORAGE_KEY = 'quant_backtest_history'
const MAX_HISTORY = 100

export function loadBacktestHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveBacktestHistory(item) {
  const code = (item?.code || '').trim()
  const query = (item?.query || code).trim()
  if (!query && !code) return loadBacktestHistory()

  const dedupeKey = (code || query).toLowerCase()
  const next = [
    {
      query,
      name: item.name || '',
      code: code || query,
      strategy: item.strategy || '',
      strategyName: item.strategyName || '',
      dataPeriod: item.dataPeriod || '',
      backtestedAt: Date.now(),
    },
    ...loadBacktestHistory().filter((h) => {
      const key = (h.code || h.query || '').trim().toLowerCase()
      return key && key !== dedupeKey
    }),
  ].slice(0, MAX_HISTORY)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearBacktestHistory() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}

export function formatBacktestHistoryLabel(item) {
  const name = (item?.name || '').trim()
  const code = (item?.code || '').trim()
  if (name && code) return `${name} (${code})`
  return (item?.query || code || '').trim()
}
