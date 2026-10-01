/** 热搜来源标签样式（Element Plus tag type） */

export const sourceTagTypes = {

  weibo: 'danger',

  baidu: 'warning',

  toutiao: 'danger',

  douyin: 'info',

  kuaishou: 'warning',

  netease: 'primary',

  sina: 'danger',

  sohu: 'warning',

  tencent: 'primary',

  xiaohongshu: 'danger',

  zqrb: 'danger',

  ths: 'warning',

  wallstreetcn: 'info',

  gelonghui: 'success',

  eastmoney: 'warning',

  cls: 'danger',

  xueqiu: 'primary',

  taoguba: 'warning',

  sina_finance: 'danger',

  cnfol: 'success',

  lixinger: 'info',

  ttjj: 'warning',

  screenshot: 'success',

  manual: 'info',

}



/** 本地 fallback 来源列表（API 不可用时） */

export const fallbackSources = [

  { id: 'weibo', name: '微博热搜', crawlable: true },

  { id: 'baidu', name: '百度热搜', crawlable: true },

  { id: 'toutiao', name: '今日头条', crawlable: true },

  { id: 'douyin', name: '抖音热榜', crawlable: true },

  { id: 'kuaishou', name: '快手热榜', crawlable: false },

  { id: 'netease', name: '网易新闻', crawlable: true },

  { id: 'sina', name: '新浪热榜', crawlable: true },

  { id: 'sohu', name: '搜狐热榜', crawlable: true },

  { id: 'tencent', name: '腾讯新闻', crawlable: true },

  { id: 'xiaohongshu', name: '小红书', crawlable: false },

  { id: 'zqrb', name: '证券日报', crawlable: true },

  { id: 'ths', name: '同花顺', crawlable: true },

  { id: 'wallstreetcn', name: '华尔街见闻', crawlable: true },

  { id: 'gelonghui', name: '格隆汇', crawlable: false },

  { id: 'eastmoney', name: '东方财富', crawlable: true },

  { id: 'cls', name: '财联社', crawlable: false },

  { id: 'xueqiu', name: '雪球', crawlable: false },

  { id: 'taoguba', name: '淘股吧', crawlable: false },

  { id: 'sina_finance', name: '新浪财经', crawlable: true },

  { id: 'cnfol', name: '中金在线', crawlable: true },

  { id: 'lixinger', name: '理杏仁', crawlable: false },

  { id: 'ttjj', name: '天天基金', crawlable: true },

  { id: 'screenshot', name: '截图识别', crawlable: false },

  { id: 'manual', name: '手动添加', crawlable: false },

]

/** 热搜榜单页保留的来源 */
export const HOT_TOPICS_SOURCE_IDS = [
  'baidu',
  'weibo',
  'toutiao',
  'douyin',
  'kuaishou',
  'screenshot',
  'manual',
]

export function hotTopicsPageSources(sources = fallbackSources) {
  return sources.filter((s) => HOT_TOPICS_SOURCE_IDS.includes(s.id))
}

export function sourceLabel(id, sources = fallbackSources) {

  const found = sources.find((s) => s.id === id)

  return found ? found.name : id

}



export function sourceTagType(id) {

  return sourceTagTypes[id] || 'info'

}



export function crawlableSources(sources = fallbackSources) {

  return sources.filter((s) => s.crawlable)

}



export function importableSources(sources = fallbackSources) {

  return sources.filter((s) => s.id !== 'manual')

}


