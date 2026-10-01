/** 内容分类标签样式 */
export const categoryTagTypes = {
  entertainment: 'danger',
  finance: 'warning',
  politics: '',
  tech_ai: 'primary',
  digital_auto: 'success',
  sports: 'info',
  other: 'info',
}

export const fallbackCategories = [
  { id: 'entertainment', name: '文娱作品' },
  { id: 'finance', name: '财经股票' },
  { id: 'politics', name: '社会时政' },
  { id: 'tech_ai', name: '科技AI' },
  { id: 'digital_auto', name: '数码汽车' },
  { id: 'sports', name: '体育电竞' },
  { id: 'other', name: '其他' },
]

export function categoryLabel(id, categories = fallbackCategories) {
  const found = categories.find((c) => c.id === id)
  return found ? found.name : id || '其他'
}

export function categoryTagType(id) {
  return categoryTagTypes[id] || 'info'
}
