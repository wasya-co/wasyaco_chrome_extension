import { useEffect, useRef, useState } from 'react'
import SearchWidget from '@/components/SearchWidget'
import './App.scss'
import { logg } from '$shared'

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Ready. Give browser instructions; I can execute multi-step plans.' },
  ])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const historyRef = useRef(null)

  useEffect(() => {
    if (!historyRef.current) return
    historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [messages])

  const getActiveTab = async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return activeTab
  }

  const parseAiOutput = (rawText) => {
    const tryParse = (text) => {
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    }

    const direct = tryParse(rawText)
    if (direct) return direct

    const blockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (blockMatch?.[1]) {
      const fromBlock = tryParse(blockMatch[1].trim())
      if (fromBlock) return fromBlock
    }

    const arrayMatch = rawText.match(/\[[\s\S]*\]/)
    if (arrayMatch) {
      const fromArray = tryParse(arrayMatch[0])
      if (fromArray) return fromArray
    }

    const objectMatch = rawText.match(/\{[\s\S]*\}/)
    if (objectMatch) {
      const fromObject = tryParse(objectMatch[0])
      if (fromObject) return fromObject
    }

    return null
  }

  const normalizeActions = (parsed) => {
    if (Array.isArray(parsed)) return parsed
    if (Array.isArray(parsed?.actions)) return parsed.actions
    if (parsed && typeof parsed === 'object' && parsed.action) return [parsed]
    return []
  }

  const parseActions = (rawText) => normalizeActions(parseAiOutput(rawText))

  const getPageSnapshot = async (tabId) => {
    const [injected] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const visibleText = (document.body?.innerText ?? '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 4000)

        const interactive = Array.from(
          document.querySelectorAll('a, button, input, textarea, select, [role="button"]'),
        )
          .slice(0, 50)
          .map((el) => ({
            tag: el.tagName.toLowerCase(),
            id: el.id || null,
            name: el.getAttribute('name'),
            ariaLabel: el.getAttribute('aria-label'),
            text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            href: el.tagName.toLowerCase() === 'a' ? el.getAttribute('href') : null,
            type: el.getAttribute('type'),
          }))

        return {
          url: location.href,
          title: document.title,
          textExcerpt: visibleText,
          interactive,
        }
      },
    })

    return injected?.result ?? null
  }

  const callOpenAiForActions = async (instruction) => {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing VITE_OPENAI_API_KEY in .env.local')

    const activeTab = await getActiveTab()
    if (!activeTab?.id) throw new Error('No active tab found')
    const snapshot = await getPageSnapshot(activeTab.id)

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: 'Convert instruction + page snapshot into an executable browser action plan. Return JSON only.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: instruction,
              },
              {
                type: 'input_text',
                text: JSON.stringify({
                  page: snapshot,
                  response_shape: {
                    actions: [
                      { action: 'navigate', url: 'https://...' },
                      { action: 'click', selector: '...' },
                      { action: 'type', selector: '...', text: '...', submit: false },
                      { action: 'scroll', top: 600 },
                      { action: 'keypress', key: 'Enter' },
                      { action: 'back' },
                      { action: 'forward' },
                      { action: 'wait', ms: 1200 },
                      { action: 'script', code: '/* JS to run in page */' },
                    ],
                  },
                }),
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`OpenAI request failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    logg(data, 'data')

    const rawText = data.output[0].content[0].text ?? ''
    logg(rawText, 'rawText')

    const actions = parseActions(rawText)
    if (!actions.length) throw new Error(`Could not parse actions JSON: ${rawText}`)
    return actions
  }

  const executeInTab = async (tabId, action) => {
    const type = String(action.action || '').toLowerCase()

    if (type === 'click') {
      if (!action.selector) throw new Error('Missing "selector" for click action')
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [action.selector],
        func: (selector) => {
          const el = document.querySelector(selector)
          if (!el) throw new Error(`No element found for selector: ${selector}`)
          el.click()
        },
      })
      return `Clicked ${action.selector}`
    }

    if (type === 'type') {
      if (!action.selector) throw new Error('Missing "selector" for type action')
      if (typeof action.text !== 'string') throw new Error('Missing "text" for type action')
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [action.selector, action.text, Boolean(action.submit)],
        func: (selector, text, submit) => {
          const el = document.querySelector(selector)
          if (!el) throw new Error(`No element found for selector: ${selector}`)
          el.focus()
          el.value = text
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
          if (submit) {
            const form = el.closest('form')
            if (form) form.requestSubmit()
          }
        },
      })
      return `Typed into ${action.selector}`
    }

    if (type === 'scroll') {
      const top = Number.isFinite(action.top) ? action.top : 0
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [top],
        func: (scrollTop) => {
          window.scrollTo({ top: scrollTop, behavior: 'smooth' })
        },
      })
      return `Scrolled to y=${top}`
    }

    if (type === 'keypress') {
      if (!action.key) throw new Error('Missing "key" for keypress action')
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [String(action.key)],
        func: (key) => {
          const down = new KeyboardEvent('keydown', { key, bubbles: true })
          const up = new KeyboardEvent('keyup', { key, bubbles: true })
          document.dispatchEvent(down)
          document.dispatchEvent(up)
        },
      })
      return `Pressed key "${action.key}"`
    }

    if (type === 'script') {
      if (typeof action.code !== 'string') throw new Error('Missing "code" for script action')
      await chrome.scripting.executeScript({
        target: { tabId },
        args: [action.code],
        func: (code) => {
          // eslint-disable-next-line no-new-func
          return Function(code)()
        },
      })
      return 'Executed script'
    }

    throw new Error(`Unsupported in-page action: ${type}`)
  }

  const executeSingleAction = async (action) => {
    const type = String(action.action || '').toLowerCase()
    const activeTab = await getActiveTab()
    if (!activeTab?.id) throw new Error('No active tab found')

    if (type === 'navigate') {
      if (!action.url) throw new Error('Missing "url" for navigate action')
      await chrome.tabs.update(activeTab.id, { url: action.url })
      return `Navigating to ${action.url}`
    }

    if (type === 'back') {
      await chrome.tabs.goBack(activeTab.id)
      return 'Navigated back'
    }

    if (type === 'forward') {
      await chrome.tabs.goForward(activeTab.id)
      return 'Navigated forward'
    }

    if (type === 'wait') {
      const ms = Math.max(0, Number(action.ms) || 1000)
      await new Promise((resolve) => setTimeout(resolve, ms))
      return `Waited ${ms}ms`
    }

    return executeInTab(activeTab.id, action)
  }

  const executeActionPlan = async (actions) => {
    const results = []
    for (let i = 0; i < actions.length; i += 1) {
      const outcome = await executeSingleAction(actions[i])
      results.push(`Step ${i + 1}: ${outcome}`)
    }
    return results
  }

  const handleSend = async () => {
    const trimmed = draft.trim()
    if (!trimmed || isSending) return

    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setDraft('')
    setIsSending(true)

    try {
      const actions = await callOpenAiForActions(trimmed)
      const results = await executeActionPlan(actions)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Action plan: ${JSON.stringify(actions)}` },
        ...results.map((item) => ({ role: 'assistant', text: item })),
      ])
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `Error: ${error.message}` },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleCloseSidePanel = () => {
    window.close()
  }

  return (
    <div className="sidepanel-shell">
      <div className="sidepanel-header">
        <button
          type="button"
          className="close-sidepanel-button"
          onClick={handleCloseSidePanel}
          aria-label="Close sidepanel"
        >
          X
        </button>
      </div>
      <div className="search-tools">
        <SearchWidget name="Yandex" url={(q) => `https://yandex.ru/search/?text=${q}`} />
        <SearchWidget name="Yandex pics" url={(q) => `https://yandex.ru/images/search?text=${q}`} />
        <SearchWidget name="Youtube" url={(q) => `https://www.youtube.com/results?search_query=${q}`} />
        <SearchWidget name="Translate a Website" url={(q) => {
          q = q.replace('https://', '')
          const domain = q.split('/')[0]
          const path = q.replace(domain, '').split('?')[0]
          return `https://${domain.replaceAll('.', '-')}.translate.goog/${path}?_x_tr_sl=en&_x_tr_tl=es`
        }} />
      </div>

      <div className="chat-panel">
        <div className="chat-history" ref={historyRef}>
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>
              {message.text}
            </div>
          ))}
        </div>
        <div className="chat-composer">
          <input
            type="text"
            placeholder="Type your message..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSend()
            }}
            disabled={isSending}
          />
          <button type="button" onClick={handleSend} disabled={isSending}>
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
