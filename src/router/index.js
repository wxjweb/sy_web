import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', redirect: '/stocks/agent' },
  { path: '/dashboard', name: 'dashboard', meta: { section: 'hot' }, component: () => import('../views/Dashboard.vue') },
  { path: '/hot-topics', name: 'hotTopics', meta: { section: 'hot' }, component: () => import('../views/HotTopics.vue') },
  { path: '/posts', name: 'posts', meta: { section: 'hot' }, component: () => import('../views/WeiboPosts.vue') },
  { path: '/stocks', redirect: '/stocks/agent' },
  { path: '/stocks/gold-forge', redirect: () => ({ path: '/stocks/agent', query: { tab: 'gold-forge' } }) },
  {
    path: '/stocks/agent',
    name: 'stocksAgent',
    meta: { section: 'finance', title: '智能体' },
    component: () => import('../views/StockAgent.vue'),
  },
  {
    path: '/stocks/cloud-map',
    name: 'stocksCloudMap',
    meta: { section: 'finance', title: '大盘云图' },
    component: () => import('../views/MarketCloudMap.vue'),
  },
  {
    path: '/stocks/research',
    name: 'stocksResearch',
    meta: { section: 'finance', title: '个股研究' },
    component: () => import('../views/StockResearch.vue'),
  },
  {
    path: '/stocks/daily-review',
    redirect: () => ({ path: '/stocks/agent', query: { tab: 'review' } }),
  },
  { path: '/stocks/quant', redirect: '/stocks/quant/backtest' },
  {
    path: '/stocks/quant/strategy',
    name: 'stocksQuantStrategy',
    meta: { section: 'finance', title: '量化策略' },
    component: () => import('../views/QuantStrategy.vue'),
  },
  {
    path: '/stocks/quant/backtest',
    name: 'stocksQuantBacktest',
    meta: { section: 'finance', title: '量化回测' },
    component: () => import('../views/QuantTrading.vue'),
  },
  {
    path: '/stocks/quant/monitor',
    name: 'stocksQuantMonitor',
    meta: { section: 'finance', title: '量化盯盘' },
    component: () => import('../views/QuantMonitor.vue'),
  },
  { path: '/bonds', name: 'bonds', meta: { section: 'finance', title: '债市' }, component: () => import('../views/FinancePlaceholder.vue') },
  { path: '/funds', name: 'funds', meta: { section: 'finance', title: '基金' }, component: () => import('../views/FinancePlaceholder.vue') },
  { path: '/futures', name: 'futures', meta: { section: 'finance', title: '期货' }, component: () => import('../views/FinancePlaceholder.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
