<template>
  <el-container direction="vertical" class="layout">
    <header class="top-header glass-card">
      <div class="logo" title="世远 SY">
        <span class="logo-cn">世远</span>
        <span class="logo-en">SY</span>
      </div>
      <nav class="top-nav">
        <button
          v-for="item in topMenus"
          :key="item.id"
          type="button"
          class="top-nav-item"
          :class="{ active: activeSection === item.id }"
          @click="switchSection(item.id)"
        >
          {{ item.label }}
        </button>
      </nav>
    </header>

    <el-container class="body">
      <el-aside :width="asideWidth" class="aside glass-card" :class="{ collapsed: sidebarCollapsed }">
        <button
          type="button"
          class="aside-toggle"
          :title="sidebarCollapsed ? '展开菜单' : '收起菜单'"
          @click="toggleSidebar"
        >
          <el-icon><component :is="sidebarCollapsed ? 'Expand' : 'Fold'" /></el-icon>
        </button>
        <el-menu
          :default-active="route.path"
          v-model:openeds="openedMenus"
          :collapse="sidebarCollapsed"
          :collapse-transition="false"
          router
          class="menu"
        >
          <template v-for="item in sideMenus" :key="item.path || item.id">
            <el-sub-menu v-if="item.children?.length" :index="item.id">
              <template #title>
                <el-icon><component :is="item.icon" /></el-icon>
                <span>{{ item.label }}</span>
              </template>
              <template v-for="child in item.children" :key="child.path || child.id">
                <el-sub-menu v-if="child.children?.length" :index="child.id">
                  <template #title>
                    <el-icon><component :is="child.icon" /></el-icon>
                    <span @click="goMenuDefault(child)">{{ child.label }}</span>
                  </template>
                  <el-menu-item
                    v-for="grand in child.children"
                    :key="grand.path"
                    :index="grand.path"
                  >
                    <el-icon><component :is="grand.icon" /></el-icon>
                    <span>{{ grand.label }}</span>
                  </el-menu-item>
                </el-sub-menu>
                <el-menu-item v-else :index="child.path">
                  <el-icon><component :is="child.icon" /></el-icon>
                  <span>{{ child.label }}</span>
                </el-menu-item>
              </template>
            </el-sub-menu>
            <el-menu-item v-else :index="item.path">
              <el-icon><component :is="item.icon" /></el-icon>
              <span>{{ item.label }}</span>
            </el-menu-item>
          </template>
        </el-menu>
        <div v-if="activeSection === 'hot'" class="aside-footer">
          <el-button
            type="primary"
            :round="!sidebarCollapsed"
            :circle="sidebarCollapsed"
            :loading="triggering"
            @click="onTrigger"
          >
            <el-icon><Refresh /></el-icon>
            <span v-if="!sidebarCollapsed">立即抓取</span>
          </el-button>
        </div>
      </el-aside>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { triggerTask } from './api'

const route = useRoute()
const router = useRouter()
const triggering = ref(false)

const sections = {
  finance: {
    id: 'finance',
    label: '股债基期',
    defaultPath: '/stocks/agent',
    menus: [
      {
        id: 'stocks',
        icon: 'TrendCharts',
        label: '股票',
        children: [
          { path: '/stocks/agent', icon: 'Cpu', label: '智能体' },
          { path: '/stocks/cloud-map', icon: 'Grid', label: '大盘云图' },
          { path: '/stocks/research', icon: 'Search', label: '个股研究' },
          {
            id: 'quant',
            icon: 'Histogram',
            label: '量化交易',
            defaultPath: '/stocks/quant/backtest',
            children: [
              { path: '/stocks/quant/backtest', icon: 'DataAnalysis', label: '量化回测' },
              { path: '/stocks/quant/strategy', icon: 'Collection', label: '量化策略' },
              { path: '/stocks/quant/monitor', icon: 'Monitor', label: '量化盯盘' },
            ],
          },
        ],
      },
      { path: '/bonds', icon: 'Coin', label: '债市' },
      { path: '/funds', icon: 'Wallet', label: '基金' },
      { path: '/futures', icon: 'DataLine', label: '期货' },
    ],
  },
  hot: {
    id: 'hot',
    label: '热搜榜单',
    defaultPath: '/dashboard',
    menus: [
      { path: '/dashboard', icon: 'Odometer', label: '数据概览' },
      { path: '/hot-topics', icon: 'TrendCharts', label: '热搜榜单' },
      { path: '/posts', icon: 'ChatDotRound', label: '微博列表' },
    ],
  },
}

const topMenus = Object.values(sections)

const activeSection = computed(() => route.meta?.section || 'finance')

const sideMenus = computed(() => sections[activeSection.value]?.menus || sections.finance.menus)

const openedMenus = ref([])
const SIDEBAR_KEY = 'sy_sidebar_collapsed'
const sidebarCollapsed = ref(localStorage.getItem(SIDEBAR_KEY) === '1')

const asideWidth = computed(() => (sidebarCollapsed.value ? '72px' : '220px'))

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
  localStorage.setItem(SIDEBAR_KEY, sidebarCollapsed.value ? '1' : '0')
}

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/stocks/quant')) {
      openedMenus.value = ['stocks', 'quant']
    } else if (path.startsWith('/stocks')) {
      openedMenus.value = ['stocks']
    }
  },
  { immediate: true },
)

function switchSection(sectionId) {
  if (activeSection.value === sectionId) return
  router.push(sections[sectionId].defaultPath)
}

function goMenuDefault(item) {
  const path = item?.defaultPath || item?.children?.[0]?.path
  if (path && route.path !== path) router.push(path)
}

async function onTrigger() {
  triggering.value = true
  try {
    await triggerTask()
    ElMessage.success('任务已触发，请稍后刷新查看')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '触发失败')
  } finally {
    triggering.value = false
  }
}
</script>

<style scoped>
.layout {
  height: 100vh;
  min-height: 100vh;
  padding: 16px;
  gap: 12px;
  overflow: hidden;
  box-sizing: border-box;
}

.top-header {
  display: flex;
  align-items: center;
  gap: 32px;
  padding: 12px 24px;
  flex-shrink: 0;
}

.logo {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
  user-select: none;
}

.logo-cn {
  font-size: 1.35rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.logo-en {
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--muted);
  padding: 2px 6px;
  border: 1.5px solid rgba(78, 205, 196, 0.5);
  border-radius: 4px;
  line-height: 1.2;
}

.top-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-nav-item {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.top-nav-item:hover {
  background: rgba(255, 107, 107, 0.08);
  color: var(--primary);
}

.top-nav-item.active {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.18), rgba(78, 205, 196, 0.12));
  color: var(--primary);
}

.body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: 16px;
}

.aside {
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  margin-right: 0;
  transition: width 0.25s ease;
  overflow: hidden;
  position: relative;
}

.aside.collapsed {
  padding: 12px 8px;
}

.aside-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0 0 10px auto;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.2s, color 0.2s, border-color 0.2s;
}

.aside.collapsed .aside-toggle {
  margin: 0 auto 10px;
}

.aside-toggle:hover {
  background: rgba(64, 158, 255, 0.1);
  color: var(--primary);
  border-color: rgba(64, 158, 255, 0.25);
}

.menu {
  border: none;
  background: transparent;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
}

.aside.collapsed .menu:not(.el-menu--collapse) {
  width: 100%;
}

.aside-footer {
  padding: 12px 0 0;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
}

.aside.collapsed .aside-footer {
  padding-top: 8px;
}

.aside.collapsed .aside-footer .el-button {
  width: 40px;
  height: 40px;
  padding: 0;
}

.main {
  padding: 0;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

:deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.15), rgba(78, 205, 196, 0.1)) !important;
  color: var(--primary) !important;
  border-radius: 8px;
}

:deep(.el-sub-menu__title:hover),
:deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--primary);
}

:deep(.el-menu--collapse) {
  width: 48px;
}

:deep(.el-menu--collapse .el-sub-menu__title),
:deep(.el-menu--collapse .el-menu-item) {
  justify-content: center;
  padding: 0 !important;
}

:deep(.el-menu--collapse .el-menu-item .el-icon),
:deep(.el-menu--collapse .el-sub-menu__title .el-icon) {
  margin: 0;
}
</style>
