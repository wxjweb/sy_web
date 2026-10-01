/** 条件树自然语言摘要（与后端 summarize_condition_tree 对齐） */

function leafText(node) {
  const ind = String(node.indicator || node.op || '')
  const direction = String(node.dir || '')
  if (ind === 'macd_cross') return direction === 'golden' ? 'MACD金叉' : 'MACD死叉'
  if (ind === 'ma_cross') return direction === 'golden' ? '均线金叉' : '均线死叉'
  if (ind === 'rsi') return `RSI${node.cmp || ''}${node.value ?? ''}`
  if (ind === 'kdj') return `KDJ${node.cmp || ''}${node.value ?? ''}`
  if (ind === 'boll') {
    const band = { upper: '上轨', lower: '下轨', mid: '中轨' }[String(node.band)] || '布林'
    return `布林带${band}`
  }
  if (ind === 'volume_ratio') return `量比${node.cmp || ''}${node.value ?? ''}`
  if (ind === 'break_high') return '突破前高'
  if (ind === 'break_low') return '跌破前低'
  if (ind === 'above_ma') return `站上MA${node.window ?? ''}`
  if (ind === 'below_ma') return `跌破MA${node.window ?? ''}`
  if (ind === 'td_setup') return direction === 'buy' ? '九转买入' : '九转卖出'
  if (ind === 'ma_align_bull' || node.op === 'ma_align_bull') return '均线多头排列'
  if (ind === 'ma_align_bear' || node.op === 'ma_align_bear') return '均线空头排列'
  return ind || ''
}

export function summarizeConditionTree(tree) {
  if (!tree) return '未配置条件'
  const buyParts = []
  const sellParts = []

  function walk(node, sideHint = '') {
    if (!node || typeof node !== 'object') return
    const side = String(node.side || sideHint || '')
    if (Array.isArray(node.children) && node.children.length) {
      node.children.forEach((child) => walk(child, side || String(child?.side || '')))
      return
    }
    const text = leafText(node)
    if (!text) return
    if (side === 'sell') sellParts.push(text)
    else buyParts.push(text)
  }

  walk(tree)
  const chunks = []
  if (buyParts.length) chunks.push(`当 ${buyParts.join(' 且 ')} 时 买入`)
  if (sellParts.length) chunks.push(`当 ${sellParts.join(' 且 ')} 时 卖出`)
  return chunks.length ? chunks.join('；') : '条件已配置'
}
