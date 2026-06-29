import crxLogo from '@/assets/crx.svg'
import reactLogo from '@/assets/react.svg'
import viteLogo from '@/assets/vite.svg'
import HelloWorld from '@/components/HelloWorld'
import './App.css'

export default function App() {
  const openSidePanel = async () => {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!activeTab?.windowId) return

    await chrome.sidePanel.open({ windowId: activeTab.windowId })
    window.close()
  }

  return (
    <div className="popup-shell">
      <div className="popup-actions">
        <button type="button" className="open-sidepanel-button" onClick={openSidePanel}>
          Open Sidepanel
        </button>
      </div>
      <HelloWorld />
    </div>
  )
}
