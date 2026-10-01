import axios from 'axios'

const http = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

export const getDashboard = (params) => http.get('/dashboard', { params })
export const getHotTopics = (params) => http.get('/hot-topics', { params })
export const createHotTopic = (payload) => http.post('/hot-topics', payload)
export const getWeiboPosts = (params) => http.get('/weibo-posts', { params })
export const getWeiboPost = (id) => http.get(`/weibo-posts/${id}`)
export const getTopicWeiboPost = (topicId) => http.get(`/hot-topics/${topicId}/weibo-post`)
export const updateWeiboPost = (id, payload) => http.patch(`/weibo-posts/${id}`, payload)
export const publishWeiboPost = (id) => http.post(`/weibo-posts/${id}/publish`, null, { timeout: 60000 })
export const markWeiboPostPublished = (id) => http.post(`/weibo-posts/${id}/mark-published`)
export const triggerTask = () => http.post('/tasks/trigger')
export const generateForTopic = (topicId) =>
  http.post(`/hot-topics/${topicId}/generate`, null, { timeout: 180000 })
export const getSources = () => http.get('/sources')
export const getCategories = () => http.get('/categories')

export const ocrHotTopicsImage = (file) => {
  const fd = new FormData()
  fd.append('image', file)
  return http.post('/hot-topics/ocr', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}

export const importHotTopics = (payload) => http.post('/hot-topics/import', payload)

export const getFinanceHotTopics = (params) => http.get('/finance-hot-topics', { params })
export const createFinanceHotTopic = (payload) => http.post('/finance-hot-topics', payload)
export const ocrFinanceHotTopicsImage = (file) => {
  const fd = new FormData()
  fd.append('image', file)
  return http.post('/finance-hot-topics/ocr', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  })
}
export const importFinanceHotTopics = (payload) => http.post('/finance-hot-topics/import', payload)
export const generateForFinanceTopic = (topicId) =>
  http.post(`/finance-hot-topics/${topicId}/generate`, null, { timeout: 180000 })
export const getFinanceTopicWeiboPost = (topicId) =>
  http.get(`/finance-hot-topics/${topicId}/weibo-post`)
export const updateFinanceWeiboPost = (id, payload) => http.patch(`/finance-weibo-posts/${id}`, payload)
export const publishFinanceWeiboPost = (id) =>
  http.post(`/finance-weibo-posts/${id}/publish`, null, { timeout: 60000 })
export const markFinanceWeiboPostPublished = (id) =>
  http.post(`/finance-weibo-posts/${id}/mark-published`)
export const triggerFinanceTask = () => http.post('/tasks/trigger-finance')

export const getStockSuggest = (q) => http.get('/stocks/suggest', { params: { q } })
export const getStockResearch = (q) => http.get('/stocks/research', { params: { q }, timeout: 120000 })
export const getStockQuote = (q) => http.get('/stocks/quote', { params: { q } })
export const getStockKline = (q, period = 'day', limit = 120) =>
  http.get('/stocks/kline', { params: { q, period, limit } })
export const analyzeStockPosition = (payload) => http.post('/stocks/position-analysis', payload, { timeout: 120000 })
export const getStockRecommendations = (limit = 30, horizon = '') =>
  http.get('/stocks/recommendations', { params: { limit, horizon }, timeout: 90000 })

export const getQuantStrategies = () => http.get('/stocks/quant/strategies')
export const runQuantBacktest = (payload) =>
  http.post('/stocks/quant/backtest', payload, { timeout: 120000 })

export const getQuantMonitorMeta = () => http.get('/stocks/quant/monitor/meta')
export const getQuantMonitorDashboard = () => http.get('/stocks/quant/monitor/dashboard')
export const getQuantMonitorAnalytics = () => http.get('/stocks/quant/monitor/analytics')
export const getQuantMonitorStrategies = (params) =>
  http.get('/stocks/quant/monitor/strategies', { params })
export const createQuantMonitorStrategy = (payload) =>
  http.post('/stocks/quant/monitor/strategies', payload)
export const updateQuantMonitorStrategy = (id, payload) =>
  http.patch(`/stocks/quant/monitor/strategies/${id}`, payload)
export const deleteQuantMonitorStrategy = (id) =>
  http.delete(`/stocks/quant/monitor/strategies/${id}`)
export const actionQuantMonitorStrategy = (id, action, payload = {}) =>
  http.post(`/stocks/quant/monitor/strategies/${id}/action`, { action, ...payload })
export const batchQuantMonitorStrategies = (payload) =>
  http.post('/stocks/quant/monitor/strategies/batch', payload)
export const getQuantMonitorStrategyLogs = (id, params) =>
  http.get(`/stocks/quant/monitor/strategies/${id}/logs`, { params })
export const backtestQuantMonitorStrategy = (id, payload) =>
  http.post(`/stocks/quant/monitor/strategies/${id}/backtest`, payload, { timeout: 120000 })
export const getQuantMonitorSignals = (params) =>
  http.get('/stocks/quant/monitor/signals', { params })
export const getQuantMonitorSignal = (id) =>
  http.get(`/stocks/quant/monitor/signals/${id}`)
export const updateQuantMonitorSignal = (id, payload) =>
  http.patch(`/stocks/quant/monitor/signals/${id}`, payload)
export const deleteQuantMonitorSignals = (ids) =>
  http.delete('/stocks/quant/monitor/signals', { data: { ids } })
export const exportQuantMonitorSignalsUrl = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return `/api/stocks/quant/monitor/signals/export${q ? `?${q}` : ''}`
}
export const getQuantMonitorLive = () => http.get('/stocks/quant/monitor/live', { timeout: 60000 })
export const scanQuantMonitor = (payload = {}) =>
  http.post('/stocks/quant/monitor/scan', payload, { timeout: 120000 })
export const getQuantMonitorSettings = () => http.get('/stocks/quant/monitor/settings')
export const updateQuantMonitorSettings = (payload) =>
  http.patch('/stocks/quant/monitor/settings', payload)
export const cleanupQuantMonitor = (payload = {}) =>
  http.post('/stocks/quant/monitor/cleanup', payload)
export const backupQuantMonitor = () => http.get('/stocks/quant/monitor/backup', { timeout: 60000 })
export const restoreQuantMonitor = (payload) =>
  http.post('/stocks/quant/monitor/backup', payload, { timeout: 60000 })
export const testQuantMonitorPush = (payload) =>
  http.post('/stocks/quant/monitor/push/test', payload)
export const getQuantMonitorUserTemplates = () => http.get('/stocks/quant/monitor/user-templates')
export const createQuantMonitorUserTemplate = (payload) =>
  http.post('/stocks/quant/monitor/user-templates', payload)
export const updateQuantMonitorUserTemplate = (id, payload) =>
  http.patch(`/stocks/quant/monitor/user-templates/${id}`, payload)
export const deleteQuantMonitorUserTemplate = (id) =>
  http.delete(`/stocks/quant/monitor/user-templates/${id}`)

export const getQuantStrategyMeta = () => http.get('/stocks/quant/strategy/meta')
export const getQuantStrategyTemplates = (params) =>
  http.get('/stocks/quant/strategy/templates', { params })
export const getQuantStrategyTemplate = (id) =>
  http.get(`/stocks/quant/strategy/templates/${id}`)
export const createQuantStrategyTemplate = (payload) =>
  http.post('/stocks/quant/strategy/templates', payload)
export const updateQuantStrategyTemplate = (id, payload) =>
  http.patch(`/stocks/quant/strategy/templates/${id}`, payload)
export const deleteQuantStrategyTemplate = (id) =>
  http.delete(`/stocks/quant/strategy/templates/${id}`)
export const useQuantStrategyTemplate = (id, payload) =>
  http.post(`/stocks/quant/strategy/templates/${id}/use`, payload)
export const getQuantStrategyTemplateVersions = (id) =>
  http.get(`/stocks/quant/strategy/templates/${id}/versions`)
export const rollbackQuantStrategyTemplateVersion = (id, versionId) =>
  http.post(`/stocks/quant/strategy/templates/${id}/versions/${versionId}/rollback`)
export const exportQuantStrategyTemplate = (id) =>
  http.get(`/stocks/quant/strategy/templates/${id}/export`)
export const importQuantStrategyTemplate = (payload) =>
  http.post('/stocks/quant/strategy/templates/import', payload)
export const getQuantStrategyList = (params) =>
  http.get('/stocks/quant/strategy/strategies', { params })
export const createQuantStrategy = (payload) =>
  http.post('/stocks/quant/strategy/strategies', payload)
export const updateQuantStrategy = (id, payload) =>
  http.patch(`/stocks/quant/strategy/strategies/${id}`, payload)
export const deleteQuantStrategy = (id) =>
  http.delete(`/stocks/quant/strategy/strategies/${id}`)
export const actionQuantStrategy = (id, action, payload = {}) =>
  http.post(`/stocks/quant/strategy/strategies/${id}/action`, { action, ...payload })
export const batchQuantStrategies = (payload) =>
  http.post('/stocks/quant/strategy/strategies/batch', payload)
export const saveQuantStrategyAsTemplate = (id, payload) =>
  http.post(`/stocks/quant/strategy/strategies/${id}/save-as-template`, payload)

export const getGoldForgeMeta = () => http.get('/stocks/gold-forge/meta')
export const runGoldForgeAnalyze = (payload) =>
  http.post('/stocks/gold-forge/analyze', payload, { timeout: 300000 })
export const getGoldForgeSessions = (params) => http.get('/stocks/gold-forge/sessions', { params })
export const getGoldForgeSession = (id) => http.get(`/stocks/gold-forge/sessions/${id}`)
export const getGoldForgeMemory = (code) => http.get('/stocks/gold-forge/memory', { params: { code } })

export const getWentiangeMeta = () => http.get('/stocks/wentiange/meta')
export const getWentiangeConversations = (params) => http.get('/stocks/wentiange/conversations', { params })
export const createWentiangeConversation = (payload) => http.post('/stocks/wentiange/conversations', payload)
export const getWentiangeConversation = (id) => http.get(`/stocks/wentiange/conversations/${id}`)
export const deleteWentiangeConversation = (id) => http.delete(`/stocks/wentiange/conversations/${id}`)
export const sendWentiangeMessage = (id, formData) =>
  http.post(`/stocks/wentiange/conversations/${id}/messages`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 300000,
  })

/** 流式 SSE 请使用 utils/wentiangeSse.js 中的 streamWentiangeMessage */

export const getStockWatchlist = (params) =>
  http.get('/stocks/watchlist', { params, timeout: 60000 })
export const getStockWatchlistPieStats = (params) =>
  http.get('/stocks/watchlist/stats/pie', { params, timeout: 90000 })
export const getStockWatchlistBarStats = (params) =>
  http.get('/stocks/watchlist/stats/bars', { params, timeout: 90000 })
export const addStockWatchlist = (payload) => http.post('/stocks/watchlist', payload)
export const bulkAddStockWatchlist = (items) => http.post('/stocks/watchlist/bulk', { items })
export const bulkDeleteStockWatchlist = (codes) => http.delete('/stocks/watchlist/bulk', { data: { codes } })
export const updateStockWatchlist = (code, payload) =>
  http.patch(`/stocks/watchlist/${encodeURIComponent(code)}`, payload, { timeout: 15000 })
export const deleteStockWatchlist = (code) => http.delete(`/stocks/watchlist/${code}`)

export const getSimTradePortfolio = (params) =>
  http.get('/stocks/sim-trade', { params, timeout: 120000 })
export const sellSimTrade = (payload) => http.post('/stocks/sim-trade/sell', payload)
export const getSimTradeLogs = (params) =>
  http.get('/stocks/sim-trade/logs', { params, timeout: 30000 })
export const syncSimTrade = () => http.post('/stocks/sim-trade/sync', {}, { timeout: 180000 })

export const getMarketCloudMap = (type = 'industry', sector = '') =>
  http.get('/market/cloud-map', { params: { type, sector }, timeout: 120000 })
export const getMarketGainers = ({
  limit = 50,
  order = 'desc',
  sort = 'change_pct',
  market = 'all',
  include_st = false,
} = {}) =>
  http.get('/market/gainers', {
    params: {
      limit,
      order,
      sort,
      market,
      include_st: include_st ? 1 : 0,
    },
    timeout: 120000,
  })

export const getMarketArticles = (params) => http.get('/market-articles', { params })
export const getMarketArticle = (id) => http.get(`/market-articles/${id}`)
export const getMarketArticleSlots = () => http.get('/market-articles/slots')
export const triggerMarketArticle = (slot) => http.post('/market-articles/trigger', null, { params: { slot }, timeout: 10000 })
