<template>
  <div class="monitor-settings" v-loading="loading">
    <div class="glass-card section">
      <h3>通知与推送渠道</h3>
      <el-form label-width="150px">
        <el-form-item label="应用内通知">
          <el-switch v-model="form.notify_in_app" />
        </el-form-item>
        <el-form-item label="桌面弹窗">
          <el-switch v-model="form.notify_desktop" />
          <el-button
            v-if="form.notify_desktop"
            text
            type="primary"
            style="margin-left: 8px"
            @click="requestNotify"
          >授权桌面通知</el-button>
        </el-form-item>
        <el-form-item label="Webhook">
          <el-switch v-model="form.channel_webhook" />
          <el-input
            v-model="form.webhook_url"
            placeholder="https://..."
            style="width: 360px; margin-left: 12px"
          />
          <el-button text type="primary" :loading="testing === 'webhook'" @click="testPush('webhook')">测试</el-button>
        </el-form-item>
        <el-form-item label="Server酱">
          <el-switch v-model="form.channel_serverchan" />
          <el-input
            v-model="form.serverchan_sendkey"
            placeholder="SendKey"
            style="width: 360px; margin-left: 12px"
            show-password
          />
          <el-button text type="primary" :loading="testing === 'serverchan'" @click="testPush('serverchan')">测试</el-button>
        </el-form-item>
        <el-form-item label="企微 / 钉钉 / 飞书">
          <span class="hint-inline">预留扩展，当前版本未接入发送</span>
        </el-form-item>
        <el-form-item label="高强度阈值">
          <el-input-number v-model="form.push_high" :min="0" :max="100" />
          <span class="hint-inline">≥ 该值：桌面 + Webhook/Server酱</span>
        </el-form-item>
        <el-form-item label="中强度阈值">
          <el-input-number v-model="form.push_mid" :min="0" :max="100" />
          <span class="hint-inline">≥ 该值：应用内；低于仅记录</span>
        </el-form-item>
        <el-form-item label="仅交易时段信号">
          <el-switch v-model="form.trade_hours_only" />
        </el-form-item>
        <el-form-item label="免打扰时段">
          <div class="row">
            <el-input v-model="form.quiet_start" placeholder="如 21:00" style="width: 120px" />
            <span>—</span>
            <el-input v-model="form.quiet_end" placeholder="如 08:00" style="width: 120px" />
          </div>
        </el-form-item>
      </el-form>
    </div>

    <div class="glass-card section">
      <h3>策略默认值</h3>
      <el-form label-width="150px">
        <el-form-item label="默认冷却(分钟)">
          <el-input-number v-model="form.default_cooldown_minutes" :min="0" :max="1440" />
        </el-form-item>
        <el-form-item label="默认可日信号上限">
          <el-input-number v-model="form.default_daily_limit" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="默认扫描间隔(秒)">
          <el-input-number v-model="form.default_scan_interval_sec" :min="10" :max="86400" />
        </el-form-item>
        <el-form-item label="默认最低置信度">
          <el-input-number v-model="form.default_min_confidence" :min="0" :max="100" />
        </el-form-item>
        <el-form-item label="默认数据周期">
          <el-select v-model="form.default_data_period" style="width: 160px">
            <el-option label="日K" value="day" />
            <el-option label="5分" value="min5" />
            <el-option label="15分" value="min15" />
            <el-option label="60分" value="min60" />
          </el-select>
        </el-form-item>
        <el-form-item label="默认打开页">
          <el-select v-model="form.default_page" clearable style="width: 160px">
            <el-option label="看板" value="dashboard" />
            <el-option label="策略" value="strategies" />
            <el-option label="监控" value="live" />
            <el-option label="信号" value="signals" />
            <el-option label="回测" value="backtest" />
            <el-option label="设置" value="settings" />
          </el-select>
        </el-form-item>
        <el-form-item label="全局自动扫描">
          <el-switch v-model="form.scan_enabled" />
        </el-form-item>
        <el-form-item label="摸鱼模式">
          <el-switch v-model="form.fish_mode" @change="onFishToggle" />
          <span class="hint-inline">弱化金融用语（侧栏标题不变）</span>
        </el-form-item>
      </el-form>
    </div>

    <div class="glass-card section">
      <h3>备份与恢复</h3>
      <p class="hint">导出策略、设置与个人模板为 JSON；恢复可选择是否替换现有策略。</p>
      <el-button :loading="backing" @click="onBackup">导出备份</el-button>
      <el-upload
        :auto-upload="false"
        :show-file-list="false"
        accept=".json,application/json"
        :on-change="onRestoreFile"
      >
        <el-button :loading="restoring" style="margin-left: 8px">从 JSON 恢复</el-button>
      </el-upload>
    </div>

    <div class="glass-card section">
      <h3>数据管理</h3>
      <p class="hint">
        当前策略 {{ form.strategy_count || 0 }} 条 · 信号 {{ form.signal_count || 0 }} 条
      </p>
      <el-form label-width="150px">
        <el-form-item label="保留天数">
          <el-input-number v-model="form.retention_days" :min="7" :max="3650" />
        </el-form-item>
        <el-form-item>
          <el-button type="warning" :loading="cleaning" @click="onCleanup">清理过期信号</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="actions">
      <el-button type="primary" :loading="saving" @click="save">保存设置</el-button>
      <el-button @click="load">重置</el-button>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  backupQuantMonitor,
  cleanupQuantMonitor,
  getQuantMonitorSettings,
  restoreQuantMonitor,
  testQuantMonitorPush,
  updateQuantMonitorSettings,
} from '../../api'

const emit = defineEmits(['fish-change'])

const loading = ref(false)
const saving = ref(false)
const cleaning = ref(false)
const backing = ref(false)
const restoring = ref(false)
const testing = ref('')

const form = reactive({
  notify_in_app: true,
  notify_desktop: true,
  channel_webhook: false,
  channel_serverchan: false,
  webhook_url: '',
  serverchan_sendkey: '',
  trade_hours_only: true,
  quiet_start: '',
  quiet_end: '',
  default_cooldown_minutes: 30,
  default_daily_limit: 10,
  default_scan_interval_sec: 60,
  default_min_confidence: 60,
  default_data_period: 'day',
  default_page: 'dashboard',
  push_high: 80,
  push_mid: 60,
  retention_days: 180,
  scan_enabled: true,
  fish_mode: false,
  signal_count: 0,
  strategy_count: 0,
})

async function load() {
  loading.value = true
  try {
    const { data } = await getQuantMonitorSettings()
    Object.assign(form, data)
    emit('fish-change', form.fish_mode)
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onFishToggle(v) {
  emit('fish-change', v)
}

async function save() {
  saving.value = true
  try {
    const { data } = await updateQuantMonitorSettings({ ...form })
    Object.assign(form, data)
    emit('fish-change', form.fish_mode)
    ElMessage.success('设置已保存')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

function requestNotify() {
  if (typeof Notification === 'undefined') {
    ElMessage.warning('当前浏览器不支持桌面通知')
    return
  }
  Notification.requestPermission().then((p) => {
    if (p === 'granted') ElMessage.success('已授权桌面通知')
    else ElMessage.warning('未获得通知权限')
  })
}

async function testPush(channel) {
  testing.value = channel
  try {
    await updateQuantMonitorSettings({ ...form })
    const { data } = await testQuantMonitorPush({ channel })
    ElMessage.success(data.message || '测试已发送')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '测试失败')
  } finally {
    testing.value = ''
  }
}

async function onBackup() {
  backing.value = true
  try {
    const { data } = await backupQuantMonitor()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quant-monitor-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('备份已下载')
  } catch (e) {
    ElMessage.error(e?.response?.data?.error || e.message || '备份失败')
  } finally {
    backing.value = false
  }
}

async function onRestoreFile(file) {
  const raw = file?.raw
  if (!raw) return
  restoring.value = true
  try {
    const text = await raw.text()
    const payload = JSON.parse(text)
    await ElMessageBox.confirm('是否用备份中的策略替换现有策略？选「取消」则仅合并新增。', '恢复确认', {
      confirmButtonText: '替换策略',
      cancelButtonText: '合并',
      distinguishCancelAndClose: true,
      type: 'warning',
    }).then(() => {
      payload.replace_strategies = true
    }).catch((action) => {
      if (action === 'cancel') payload.replace_strategies = false
      else throw action
    })
    const { data } = await restoreQuantMonitor(payload)
    ElMessage.success(`恢复完成：策略 ${data.strategies || 0}`)
    await load()
  } catch (e) {
    if (e !== 'close' && e !== 'cancel') {
      ElMessage.error(e?.response?.data?.error || e.message || '恢复失败')
    }
  } finally {
    restoring.value = false
  }
}

async function onCleanup() {
  await ElMessageBox.confirm(
    `将删除超过 ${form.retention_days} 天的历史信号，是否继续？`,
    '清理确认',
    { type: 'warning' },
  )
  cleaning.value = true
  try {
    const { data } = await cleanupQuantMonitor({ days: form.retention_days })
    ElMessage.success(`已清理 ${data.deleted || 0} 条`)
    await load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e?.response?.data?.error || e.message || '清理失败')
  } finally {
    cleaning.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.section {
  padding: 16px 18px;
  margin-bottom: 12px;
}

.section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint {
  font-size: 13px;
  color: var(--muted);
  margin: 0 0 12px;
}

.hint-inline {
  margin-left: 10px;
  font-size: 12px;
  color: var(--muted);
}

.actions {
  display: flex;
  gap: 10px;
}
</style>
