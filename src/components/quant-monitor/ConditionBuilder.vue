<template>
  <div class="condition-builder">
    <div class="tree-head">
      <span>条件组合</span>
      <el-radio-group v-model="local.op" size="small">
        <el-radio-button label="AND">全部满足 (AND)</el-radio-button>
        <el-radio-button label="OR">任一满足 (OR)</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" @click="addNode">添加条件</el-button>
    </div>

    <div v-if="!(local.children || []).length" class="empty-hint">
      暂无条件，点击「添加条件」开始拼接
    </div>

    <div
      v-for="(node, idx) in local.children || []"
      :key="idx"
      class="node-row"
    >
      <el-select v-model="node.indicator" style="width: 150px" @change="onIndicatorChange(node)">
        <el-option
          v-for="n in nodeTypes"
          :key="n.value"
          :label="n.label"
          :value="n.value"
        />
      </el-select>

      <template v-if="node.indicator === 'macd_cross' || node.indicator === 'ma_cross'">
        <el-select v-model="node.dir" style="width: 100px">
          <el-option label="金叉" value="golden" />
          <el-option label="死叉" value="death" />
        </el-select>
        <el-dropdown
          v-if="node.indicator === 'macd_cross'"
          trigger="click"
          @command="(v) => applyQuick(node, v)"
        >
          <el-button size="small" text type="primary">常用参数</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in quickOptions('macd_cross')"
                :key="opt.label"
                :command="opt"
              >
                {{ opt.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>

      <template v-else-if="node.indicator === 'rsi' || node.indicator === 'kdj' || node.indicator === 'volume_ratio'">
        <el-select v-model="node.cmp" style="width: 80px">
          <el-option label="<" value="<" />
          <el-option label="<=" value="<=" />
          <el-option label=">" value=">" />
          <el-option label=">=" value=">=" />
        </el-select>
        <el-input-number v-model="node.value" :step="1" controls-position="right" />
        <el-dropdown
          v-if="quickOptions(node.indicator).length"
          trigger="click"
          @command="(v) => applyQuick(node, v)"
        >
          <el-button size="small" text type="primary">常用参数</el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="opt in quickOptions(node.indicator)"
                :key="opt.label"
                :command="opt"
              >
                {{ opt.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>

      <template v-else-if="node.indicator === 'boll'">
        <el-select v-model="node.band" style="width: 110px">
          <el-option label="上轨附近" value="upper" />
          <el-option label="中轨" value="mid" />
          <el-option label="下轨附近" value="lower" />
        </el-select>
      </template>

      <template v-else-if="['break_high', 'break_low', 'above_ma', 'below_ma'].includes(node.indicator)">
        <span class="muted">窗口</span>
        <el-input-number v-model="node.window" :min="2" :max="120" controls-position="right" />
      </template>

      <template v-else-if="node.indicator === 'td_setup'">
        <el-select v-model="node.dir" style="width: 110px">
          <el-option label="买入九转" value="buy" />
          <el-option label="卖出九转" value="sell" />
        </el-select>
      </template>

      <el-select v-model="node.side" style="width: 100px" placeholder="方向">
        <el-option label="买入侧" value="buy" />
        <el-option label="卖出侧" value="sell" />
        <el-option label="通用" value="" />
      </el-select>

      <el-button text type="danger" @click="removeNode(idx)">删除</el-button>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({ op: 'AND', children: [] }) },
  nodeTypes: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue'])

const local = reactive({
  op: 'AND',
  children: [],
})

function syncFromProps() {
  const v = props.modelValue || {}
  local.op = v.op || 'AND'
  local.children = Array.isArray(v.children)
    ? v.children.map((c) => ({ ...c }))
    : []
}

watch(() => props.modelValue, syncFromProps, { immediate: true, deep: true })

watch(
  local,
  () => {
    emit('update:modelValue', {
      op: local.op,
      children: local.children.map((c) => {
        const out = { ...c, type: 'indicator', indicator: c.indicator }
        if (!out.side) delete out.side
        return out
      }),
    })
  },
  { deep: true },
)

function defaultNode(indicator = 'macd_cross') {
  const base = { type: 'indicator', indicator, side: 'buy' }
  if (indicator === 'macd_cross' || indicator === 'ma_cross') {
    return { ...base, dir: 'golden' }
  }
  if (indicator === 'rsi') return { ...base, cmp: '<', value: 30 }
  if (indicator === 'kdj') return { ...base, cmp: '<', value: 20 }
  if (indicator === 'volume_ratio') return { ...base, cmp: '>', value: 1.5 }
  if (indicator === 'boll') return { ...base, band: 'lower' }
  if (['break_high', 'break_low', 'above_ma', 'below_ma'].includes(indicator)) {
    return { ...base, window: 20 }
  }
  if (indicator === 'td_setup') return { ...base, dir: 'buy' }
  return base
}

function addNode() {
  local.children.push(defaultNode())
}

function removeNode(idx) {
  local.children.splice(idx, 1)
}

function onIndicatorChange(node) {
  Object.assign(node, defaultNode(node.indicator), { indicator: node.indicator })
}

const QUICK = {
  macd_cross: [
    { label: '金叉买入', patch: { dir: 'golden', side: 'buy' } },
    { label: '死叉卖出', patch: { dir: 'death', side: 'sell' } },
  ],
  rsi: [
    { label: '超卖 <30', patch: { cmp: '<', value: 30, side: 'buy' } },
    { label: '超买 >70', patch: { cmp: '>', value: 70, side: 'sell' } },
    { label: '中性确认 >50', patch: { cmp: '>', value: 50, side: 'buy' } },
  ],
  kdj: [
    { label: '超卖 J<0', patch: { cmp: '<', value: 0, side: 'buy' } },
    { label: '超买 J>100', patch: { cmp: '>', value: 100, side: 'sell' } },
  ],
  volume_ratio: [
    { label: '放量 >1.5', patch: { cmp: '>', value: 1.5, side: 'buy' } },
    { label: '缩量 <0.8', patch: { cmp: '<', value: 0.8, side: 'buy' } },
  ],
}

function quickOptions(indicator) {
  return QUICK[indicator] || []
}

function applyQuick(node, opt) {
  if (!opt?.patch) return
  Object.assign(node, opt.patch)
}
</script>

<style scoped>
.condition-builder {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.4);
}

.tree-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 13px;
}

.node-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.02);
}

.empty-hint {
  font-size: 12px;
  color: var(--muted);
  padding: 8px 0;
}

.muted {
  font-size: 12px;
  color: var(--muted);
}
</style>
