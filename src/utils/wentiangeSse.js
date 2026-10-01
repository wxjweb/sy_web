/** SSE 流式请求（POST + fetch，支持重连） */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseSseBlock(block) {
  const lines = block.split('\n').filter(Boolean)
  if (!lines.length) return null
  let event = 'message'
  let data = ''
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data += line.slice(5).trim()
  }
  if (!data) return null
  try {
    return { event, data: JSON.parse(data) }
  } catch {
    return { event, data: { raw: data } }
  }
}

/**
 * @param {number} convId
 * @param {FormData} formData
 * @param {{ onEvent: (ev: {event:string,data:object}) => void, signal?: AbortSignal, retries?: number }} opts
 */
export async function streamWentiangeMessage(convId, formData, { onEvent, signal, retries = 2 }) {
  let attempt = 0
  let receivedBytes = false

  while (attempt <= retries) {
    try {
      const resp = await fetch(`/api/stocks/wentiange/conversations/${convId}/messages/stream`, {
        method: 'POST',
        body: formData,
        signal,
      })

      if (!resp.ok) {
        let errMsg = `HTTP ${resp.status}`
        try {
          const err = await resp.json()
          errMsg = err.error || errMsg
        } catch { /* ignore */ }
        throw new Error(errMsg)
      }

      const reader = resp.body?.getReader()
      if (!reader) throw new Error('浏览器不支持流式响应')

      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        receivedBytes = true
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          const ev = parseSseBlock(part)
          if (ev) onEvent(ev)
        }
      }

      if (buffer.trim()) {
        const ev = parseSseBlock(buffer)
        if (ev) onEvent(ev)
      }
      return
    } catch (e) {
      if (signal?.aborted) throw e
      if (receivedBytes) throw e
      attempt += 1
      if (attempt > retries) throw e
      await sleep(800 * attempt)
    }
  }
}

export function extractStreamDisplay(raw) {
  const text = String(raw || '')
  let reasoning = ''
  const rm = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/i)
  if (rm) reasoning = rm[1].trim()
  else {
    const partial = text.match(/<reasoning>([\s\S]*)/i)
    if (partial && !text.includes('</reasoning>')) reasoning = partial[1].trim()
  }

  let answer = text
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<reasoning>[\s\S]*/gi, '')
    .replace(/<suggestions>[\s\S]*$/gi, '')
    .replace(/<\/?answer>/gi, '')
    .trim()
  return { reasoning, answer }
}
