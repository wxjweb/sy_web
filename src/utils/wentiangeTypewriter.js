/** 打字机效果：按字符类型调整速度 */

export function getCharDelay(char) {
  if (char === '。' || char === '？' || char === '！' || char === '…') return 200
  if (char === '，' || char === '、' || char === '；' || char === '：') return 100
  if (char === '\n') return 80
  return 50
}

export class Typewriter {
  constructor(onUpdate) {
    this.target = ''
    this.displayed = ''
    this.onUpdate = onUpdate
    this._timer = null
    this._running = false
  }

  setTarget(text) {
    this.target = text || ''
    this._kick()
  }

  flush() {
    this._stop()
    this.displayed = this.target
    this.onUpdate(this.displayed)
  }

  reset() {
    this._stop()
    this.target = ''
    this.displayed = ''
    this.onUpdate('')
  }

  _kick() {
    if (this._running) return
    if (this.displayed.length >= this.target.length) return
    this._running = true
    this._tick()
  }

  _tick() {
    if (this.displayed.length >= this.target.length) {
      this._running = false
      return
    }
    const next = this.target[this.displayed.length]
    this.displayed += next
    this.onUpdate(this.displayed)
    this._timer = setTimeout(() => this._tick(), getCharDelay(next))
  }

  _stop() {
    this._running = false
    if (this._timer) {
      clearTimeout(this._timer)
      this._timer = null
    }
  }

  destroy() {
    this._stop()
  }
}
