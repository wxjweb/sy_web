const STORAGE_KEY = 'stock_research_cache'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_ENTRIES = 50

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase()
}

function loadCacheMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const map = JSON.parse(raw)
    return map && typeof map === 'object' ? map : {}
  } catch {
    return {}
  }
}

function saveCacheMap(map) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

function pruneCacheMap(map) {
  const now = Date.now()
  const entries = Object.entries(map).filter(([, item]) => (
    item?.cachedAt && now - item.cachedAt < CACHE_TTL_MS
  ))
  entries.sort((a, b) => (b[1].cachedAt || 0) - (a[1].cachedAt || 0))
  const next = {}
  for (const [key, item] of entries.slice(0, MAX_ENTRIES)) {
    next[key] = item
  }
  return next
}

export function loadStockResearchCache(queryOrCode) {
  const key = normalizeKey(queryOrCode)
  if (!key) return null
  const map = pruneCacheMap(loadCacheMap())
  saveCacheMap(map)
  const item = map[key]
  if (!item?.data) return null
  if (Date.now() - item.cachedAt >= CACHE_TTL_MS) return null
  return item.data
}

export function saveStockResearchCache(data, query = '') {
  const code = data?.quote?.code
  const keys = new Set([normalizeKey(code), normalizeKey(query)].filter(Boolean))
  if (!keys.size || !data) return loadCacheMap()

  const map = pruneCacheMap(loadCacheMap())
  const entry = { data, cachedAt: Date.now() }
  for (const key of keys) {
    map[key] = entry
  }
  saveCacheMap(map)
  return map
}

export function clearStockResearchCache() {
  localStorage.removeItem(STORAGE_KEY)
}
