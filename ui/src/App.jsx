import { useState } from 'react'
import './App.css'

function App() {
  const [leftContent, setLeftContent] = useState('')
  const [rightContent, setRightContent] = useState('')
  const [diffResult, setDiffResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleFileUpload = (e, side) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        if (side === 'left') {
          setLeftContent(event.target.result)
        } else {
          setRightContent(event.target.result)
        }
      }
      reader.readAsText(file)
    }
  }

  const handleCompare = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input1: leftContent,
          input2: rightContent,
          input_mode: 'content'
          // file_type omitted for auto
        })
      })
      const result = await response.json()
      setDiffResult(result)
    } catch (error) {
      console.error('Error:', error)
      setDiffResult({ error: 'Failed to compare' })
    }
    setLoading(false)
  }

  const renderHighlightedPanel = (content, side) => {
    if (!diffResult || !diffResult.diffs) {
      return <pre>{content}</pre>
    }
    const lines = content.split('\n')
    return (
      <div>
        {lines.map((line, idx) => {
          const lineNum = idx + 1
          let bgColor = 'transparent'
          const matchingDiff = diffResult.diffs.find(d => 
            d.location.includes(`Line ${lineNum}`) && 
            (side === 'left' || true) // simplistic, match both for now
          )
          if (matchingDiff) {
            if (matchingDiff.level === 'WARNING') bgColor = 'yellow'
            else if (matchingDiff.level === 'ERROR') bgColor = 'orange'
            else if (matchingDiff.level === 'CRITICAL') bgColor = 'red'
          }
          return (
            <div key={idx} style={{ backgroundColor: bgColor }}>
              {line}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="app">
      <h1>Compare Docs</h1>
      <div className="panels">
        <div className="panel">
          <h2>Left / Original</h2>
          <input type="file" onChange={(e) => handleFileUpload(e, 'left')} />
          <textarea 
            value={leftContent} 
            onChange={(e) => setLeftContent(e.target.value)}
            placeholder="Paste or load left content..."
          />
          {diffResult && renderHighlightedPanel(leftContent, 'left')}
        </div>
        <div className="panel">
          <h2>Right / Modified</h2>
          <input type="file" onChange={(e) => handleFileUpload(e, 'right')} />
          <textarea 
            value={rightContent} 
            onChange={(e) => setRightContent(e.target.value)}
            placeholder="Paste or load right content..."
          />
          {diffResult && renderHighlightedPanel(rightContent, 'right')}
        </div>
      </div>
      <button onClick={handleCompare} disabled={loading}>
        {loading ? 'Comparing...' : 'Compare'}
      </button>
      {diffResult && diffResult.error && <p style={{color: 'red'}}>{diffResult.error}</p>}
    </div>
  )
}

export default App