const STORAGE_KEY = 'stock_research_history'
const MAX_HISTORY = 100

export function loadStockSearchHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveStockSearchHistory(item) {
  const query = (item?.query || '').trim()
  if (!query) return loadStockSearchHistory()

  const normalized = query.toLowerCase()
  const next = [
    {
      query,
      name: item.name || '',
      code: item.code || '',
      searchedAt: Date.now(),
    },
    ...loadStockSearchHistory().filter((h) => (h.query || '').trim().toLowerCase() !== normalized),
  ].slice(0, MAX_HISTORY)

  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function clearStockSearchHistory() {
  localStorage.removeItem(STORAGE_KEY)
  return []
}

export function formatHistoryLabel(item) {
  const name = (item?.name || '').trim()
  const code = (item?.code || '').trim()
  if (name && code) return `${name} (${code})`
  return (item?.query || '').trim()
}
