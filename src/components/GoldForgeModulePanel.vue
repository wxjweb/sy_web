<template>
  <div class="gf-module-body">
    <el-collapse v-if="reasoningText" class="reasoning-collapse">
      <el-collapse-item title="查看 AI 推理过程">
        <div class="gf-rich" v-html="formatRichText(reasoningText)" />
      </el-collapse-item>
    </el-collapse>

    <!-- M1 个股深度画像 -->
    <template v-if="moduleId === 'm1' && !data._fallback">
      <div class="gf-rating-banner">
        <span class="gf-label">综合评级</span>
        <span class="gf-badge" :class="conclusionType(data.overall_rating)">{{ data.overall_rating || '—' }}</span>
      </div>
      <div class="gf-dim-grid">
        <div v-for="dim in m1Dimensions" :key="dim.key" class="gf-dim-card">
          <div class="gf-dim-head">
            <span class="gf-dim-title">{{ dim.label }}</span>
            <span class="gf-badge sm" :class="conclusionType(data[dim.key]?.conclusion)">
              {{ data[dim.key]?.conclusion || '—' }}
            </span>
          </div>
          <div class="gf-rich" v-html="formatRichText(data[dim.key]?.summary)" />
        </div>
      </div>
      <div v-if="data.data_notes?.length" class="gf-notes">
        <span v-for="(n, i) in data.data_notes" :key="i" class="gf-note-tag">{{ n }}</span>
      </div>
    </template>

    <!-- M2 同行对标 -->
    <template v-else-if="moduleId === 'm2' && !data._fallback">
      <div class="gf-kv-row">
        <span class="gf-k">行业</span><span class="gf-v highlight">{{ data.industry || '—' }}</span>
        <span class="gf-k">估值状态</span>
        <span class="gf-badge" :class="conclusionType(data.valuation_status)">{{ data.valuation_status || '—' }}</span>
      </div>
      <p class="gf-reason">{{ data.reason }}</p>
      <el-table v-if="data.peers?.length" :data="data.peers" stripe size="small" class="gf-table">
        <el-table-column prop="name" label="竞对" min-width="100" />
        <el-table-column prop="peg" label="PEG" width="80" />
        <el-table-column prop="gross_margin" label="毛利率" width="90" />
        <el-table-column prop="revenue_growth" label="营收增速" width="90" />
        <el-table-column prop="roe" label="ROE" width="80" />
      </el-table>
    </template>

    <!-- M3 宏观周期 -->
    <template v-else-if="moduleId === 'm3' && !data._fallback">
      <div class="gf-tag-grid">
        <div class="gf-tag-item"><span class="gf-k">市场情绪</span><span class="gf-badge" :class="conclusionType(data.market_sentiment)">{{ data.market_sentiment }}</span></div>
        <div class="gf-tag-item"><span class="gf-k">行业周期</span><span class="gf-badge" :class="conclusionType(data.industry_cycle)">{{ data.industry_cycle }}</span></div>
        <div class="gf-tag-item"><span class="gf-k">板块属性</span><span class="gf-v">{{ data.sector_type }}</span></div>
        <div class="gf-tag-item"><span class="gf-k">宏观影响</span><span class="gf-badge" :class="conclusionType(data.macro_impact)">{{ data.macro_impact }}</span></div>
      </div>
      <div class="gf-rich" v-html="formatRichText(data.summary)" />
    </template>

    <!-- M4 多空信息 -->
    <template v-else-if="moduleId === 'm4' && !data._fallback">
      <div class="gf-rating-banner">
        <span class="gf-label">信息面判断</span>
        <span class="gf-badge" :class="conclusionType(data.info_bias)">{{ data.info_bias || '—' }}</span>
      </div>
      <div class="gf-two-col">
        <div class="gf-list-block positive">
          <h4>利好信息</h4>
          <div v-for="(item, i) in data.bullish || []" :key="'b'+i" class="gf-info-item">
            <el-tag size="small" :type="importanceType(item.importance)" effect="plain">{{ item.importance }}</el-tag>
            <span>{{ item.title }}</span>
            <span class="gf-meta">{{ item.status }}</span>
          </div>
          <p v-if="!data.bullish?.length" class="gf-empty">暂无</p>
        </div>
        <div class="gf-list-block negative">
          <h4>利空信息</h4>
          <div v-for="(item, i) in data.bearish || []" :key="'r'+i" class="gf-info-item">
            <el-tag size="small" :type="importanceType(item.importance)" effect="plain">{{ item.importance }}</el-tag>
            <span>{{ item.title }}</span>
            <span class="gf-meta">{{ item.status }}</span>
          </div>
          <p v-if="!data.bearish?.length" class="gf-empty">暂无</p>
        </div>
      </div>
      <h4 class="gf-sub-title">事件日历（未来60天）</h4>
      <el-table v-if="data.event_calendar?.length" :data="data.event_calendar" stripe size="small" class="gf-table">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="event" label="事件" min-width="180" />
        <el-table-column prop="impact" label="影响" width="80">
          <template #default="{ row }">
            <el-tag size="small" :type="importanceType(row.impact)" effect="plain">{{ row.impact }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="gf-rich" v-html="formatRichText(data.summary)" />
    </template>

    <!-- M5 仓位诊断 -->
    <template v-else-if="moduleId === 'm5' && !data._fallback">
      <div class="gf-kv-row">
        <span class="gf-k">仓位健康度</span>
        <span class="gf-badge" :class="conclusionType(data.position_health)">{{ data.position_health }}</span>
        <span class="gf-k">操作建议</span>
        <span class="gf-badge lg" :class="actionType(data.add_reduce_action)">{{ data.add_reduce_action }}</span>
      </div>
      <div class="gf-block-list">
        <div v-if="data.position_ratio_comment" class="gf-block"><strong>仓位评估</strong><p>{{ data.position_ratio_comment }}</p></div>
        <div v-if="data.stop_loss_suggestion" class="gf-block warn"><strong>止损建议</strong><p>{{ data.stop_loss_suggestion }}</p></div>
        <div v-if="data.add_reduce_detail" class="gf-block"><strong>加减仓详情</strong><p>{{ data.add_reduce_detail }}</p></div>
        <div v-if="data.stress_test" class="gf-block danger"><strong>压力测试</strong><p>{{ data.stress_test }}</p></div>
        <div v-if="data.summary" class="gf-block"><strong>综合摘要</strong><div class="gf-rich" v-html="formatRichText(data.summary)" /></div>
      </div>
    </template>

    <!-- M6 CoT 打分 -->
    <template v-else-if="moduleId === 'm6'">
      <div class="gf-rating-banner">
        <span class="gf-label">综合评级</span>
        <span class="gf-badge lg" :class="conclusionType(data.overall_rating)">{{ data.overall_rating }}</span>
        <span class="gf-score-total">总分 <em :class="scoreClass(data.total_score)">{{ data.total_score >= 0 ? '+' : '' }}{{ data.total_score }}</em></span>
        <span class="gf-meta-inline">胜率 {{ data.win_rate }}% · 盈亏比 {{ data.risk_reward }}</span>
      </div>
      <div class="gf-steps">
        <div v-for="(s, i) in data.steps || []" :key="i" class="gf-step-card">
          <span class="gf-step-name">Step {{ i + 1 }} · {{ s.step }}</span>
          <span class="gf-step-score" :class="scoreClass(s.score)">{{ s.score >= 0 ? '+' : '' }}{{ s.score }} 分</span>
        </div>
      </div>
      <p v-if="data.plan_filter?.length" class="gf-filter">
        保留方案：<strong>{{ planFilterLabel(data.plan_filter) }}</strong>
      </p>
    </template>

    <!-- M7 投资计划 -->
    <template v-else-if="moduleId === 'm7'">
      <p class="gf-chain">{{ data.reasoning_chain }}</p>
      <p class="gf-cap-util"><strong>资金占用：</strong>{{ data.capital_utilization }}</p>
      <div v-for="(plan, key) in data.plans || {}" :key="key" class="gf-plan-block" :class="planColor(key)">
        <h4>{{ planLabel(key) }} · 仓位 {{ plan.total_position_pct || '—' }}</h4>
        <div class="gf-kv-row compact">
          <span>建议股数 <strong>{{ plan.total_shares || '—' }}</strong></span>
          <span>止损 <strong class="down">{{ plan.stop_loss_price }}</strong></span>
          <span v-if="plan.entry_grid?.resonance_grade || plan.entry_grid?.time_resonance?.resonance_grade">
            共振 <strong>{{ plan.entry_grid?.time_resonance?.resonance_grade || plan.entry_grid?.resonance_grade }}</strong>
          </span>
        </div>
        <el-table v-if="plan.entry_grid?.levels?.length" :data="plan.entry_grid.levels" size="small" class="gf-table">
          <el-table-column prop="ratio" label="回撤" width="70" />
          <el-table-column prop="price" label="价位" width="80" />
          <el-table-column prop="weight" label="权重" width="70" />
          <el-table-column prop="status" label="状态" />
        </el-table>
        <div v-if="plan.take_profit_levels?.length" class="gf-tp-list">
          <span v-for="tp in plan.take_profit_levels" :key="tp.level" class="gf-tp-tag">
            {{ tp.level }} {{ tp.price }} 卖{{ tp.sell_percent }}
          </span>
        </div>
        <p v-if="plan.note" class="gf-plan-note">{{ plan.note }}</p>
      </div>
    </template>

    <!-- M8 综合裁决 -->
    <template v-else-if="moduleId === 'm8' && !data._fallback">
      <div class="gf-rating-banner">
        <span class="gf-badge xl" :class="conclusionType(data.rating)">{{ data.rating }}</span>
        <span class="gf-v">推荐 {{ data.recommended_plan }} · 置信度 <strong>{{ data.confidence_score }}</strong> 分</span>
      </div>
      <div class="gf-rich" v-html="formatRichText(data.rating_logic)" />
      <ul v-if="data.risks?.length" class="gf-risk-list">
        <li v-for="(r, i) in data.risks" :key="i">{{ r }}</li>
      </ul>
      <p v-if="data.time_window" class="gf-time-window"><strong>时间窗口：</strong>{{ data.time_window }}</p>
    </template>

    <!-- 解析失败 / 通用兜底 -->
    <template v-else>
      <div class="gf-rich" v-html="formatRichText(data._text || data.summary || fallbackJson)" />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import {
  conclusionType,
  formatRichText,
  importanceType,
  normalizeResult,
  scoreClass,
} from '../utils/goldForgeFormat'

const props = defineProps({
  moduleId: { type: String, required: true },
  result: { type: Object, default: () => ({}) },
  reasoning: { type: String, default: '' },
})

const data = computed(() => normalizeResult(props.result))

const reasoningText = computed(() => {
  const extra = data.value._reasoningExtra
  return [props.reasoning, extra].filter(Boolean).join('\n\n')
})

const fallbackJson = computed(() => {
  try {
    return '```\n' + JSON.stringify(props.result, null, 2) + '\n```'
  } catch {
    return String(props.result)
  }
})

const m1Dimensions = [
  { key: 'fundamental', label: '基本面' },
  { key: 'technical', label: '技术面' },
  { key: 'capital_flow', label: '资金面' },
]

function actionType(action) {
  const v = String(action || '')
  if (/增|买|建仓/.test(v)) return 'positive'
  if (/减|卖|清/.test(v)) return 'negative'
  return 'neutral'
}

function planFilterLabel(keys) {
  const map = { conservative: '保守', moderate: '稳健', aggressive: '激进' }
  return keys.map((k) => map[k] || k).join('、')
}

function planLabel(key) {
  return { conservative: '保守型', moderate: '稳健型', aggressive: '激进型' }[key] || key
}

function planColor(key) {
  return { conservative: 'plan-green', moderate: 'plan-orange', aggressive: 'plan-red' }[key] || ''
}
</script>

<style scoped>
.gf-module-body { font-size: 14px; line-height: 1.7; color: var(--text); }
.gf-rich :deep(.gf-p) { margin: 0 0 10px; }
.gf-rich :deep(.gf-h3) { margin: 12px 0 8px; font-size: 15px; color: var(--primary); }
.gf-rich :deep(.gf-h4) { margin: 10px 0 6px; font-size: 14px; font-weight: 700; }
.gf-rich :deep(.gf-list) { margin: 8px 0; padding-left: 20px; }
.gf-rich :deep(.gf-kw) {
  font-weight: 700;
  padding: 0 4px;
  border-radius: 3px;
  background: rgba(64, 158, 255, 0.12);
  color: #0984e3;
}
.gf-rating-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(90deg, rgba(255, 107, 107, 0.08), rgba(78, 205, 196, 0.08));
}
.gf-label { font-size: 13px; color: var(--muted); }
.gf-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
}
.gf-badge.sm { padding: 2px 8px; font-size: 12px; }
.gf-badge.lg { padding: 6px 16px; font-size: 15px; }
.gf-badge.xl { padding: 8px 20px; font-size: 16px; }
.gf-badge.positive { background: rgba(39, 174, 96, 0.15); color: #1e8449; }
.gf-badge.negative { background: rgba(231, 76, 60, 0.15); color: #c0392b; }
.gf-badge.neutral { background: rgba(149, 165, 166, 0.2); color: #566573; }
.gf-badge.warning { background: rgba(243, 156, 18, 0.18); color: #d35400; }
.gf-badge.default { background: rgba(64, 158, 255, 0.12); color: #2980b9; }
.gf-dim-grid { display: grid; gap: 12px; }
.gf-dim-card {
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.5);
}
.gf-dim-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.gf-dim-title { font-weight: 700; font-size: 14px; }
.gf-notes { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }
.gf-note-tag { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: rgba(0,0,0,0.05); color: var(--muted); }
.gf-kv-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-bottom: 12px; }
.gf-kv-row.compact { font-size: 13px; margin-top: 8px; }
.gf-k { color: var(--muted); font-size: 13px; }
.gf-v.highlight { font-weight: 700; color: var(--primary); }
.gf-v .down, .down { color: #e74c3c; font-weight: 700; }
.gf-reason { margin: 0 0 12px; padding: 10px 12px; background: rgba(64,158,255,0.06); border-radius: 8px; }
.gf-tag-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 12px; }
@media (max-width: 600px) { .gf-tag-grid { grid-template-columns: 1fr; } }
.gf-tag-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-radius: 8px; background: rgba(0,0,0,0.03); }
.gf-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
@media (max-width: 700px) { .gf-two-col { grid-template-columns: 1fr; } }
.gf-list-block { padding: 12px; border-radius: 10px; }
.gf-list-block.positive { background: rgba(39, 174, 96, 0.08); border-left: 3px solid #27ae60; }
.gf-list-block.negative { background: rgba(231, 76, 60, 0.08); border-left: 3px solid #e74c3c; }
.gf-list-block h4 { margin: 0 0 8px; font-size: 14px; }
.gf-info-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-bottom: 8px; font-size: 13px; }
.gf-meta { color: var(--muted); font-size: 12px; }
.gf-meta-inline { font-size: 12px; color: var(--muted); }
.gf-empty { color: var(--muted); font-size: 12px; margin: 0; }
.gf-sub-title { margin: 12px 0 8px; font-size: 14px; font-weight: 700; }
.gf-block-list { display: flex; flex-direction: column; gap: 10px; }
.gf-block { padding: 10px 12px; border-radius: 8px; background: rgba(0,0,0,0.03); }
.gf-block.warn { background: rgba(243, 156, 18, 0.1); border-left: 3px solid #f39c12; }
.gf-block.danger { background: rgba(231, 76, 60, 0.08); border-left: 3px solid #e74c3c; }
.gf-block p { margin: 6px 0 0; }
.gf-score-total em { font-style: normal; font-weight: 800; font-size: 18px; }
.score-up { color: #27ae60; }
.score-down { color: #e74c3c; }
.score-flat { color: var(--muted); }
.gf-steps { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 8px; margin-bottom: 12px; }
.gf-step-card {
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.gf-step-name { font-size: 12px; color: var(--muted); }
.gf-step-score { font-weight: 800; font-size: 16px; }
.gf-filter { margin: 0; font-size: 13px; }
.gf-chain, .gf-cap-util { font-size: 13px; color: var(--muted); margin: 0 0 12px; }
.gf-plan-block {
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}
.gf-plan-block.plan-green { border-top: 3px solid #27ae60; }
.gf-plan-block.plan-orange { border-top: 3px solid #e67e22; }
.gf-plan-block.plan-red { border-top: 3px solid #e74c3c; }
.gf-plan-block h4 { margin: 0 0 8px; }
.gf-tp-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.gf-tp-tag { font-size: 12px; padding: 2px 8px; border-radius: 4px; background: rgba(39, 174, 96, 0.12); color: #1e8449; }
.gf-plan-note { color: #e67e22; font-size: 12px; margin: 8px 0 0; }
.gf-risk-list { margin: 12px 0; padding-left: 20px; color: #c0392b; }
.gf-time-window { margin: 10px 0 0; padding: 8px 12px; background: rgba(64,158,255,0.08); border-radius: 8px; font-size: 13px; }
.gf-table { margin-top: 8px; }
.reasoning-collapse { margin-bottom: 12px; }
</style>
