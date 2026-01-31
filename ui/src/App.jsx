import { useState, useEffect } from 'react'
import './App.css'
import mammoth from 'mammoth'
import Login from './components/Login'
import Profile from './components/Profile'
import SyntaxCheck from './components/SyntaxCheck'
import History from './components/History'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('login')
  const [leftContent, setLeftContent] = useState('')
  const [rightContent, setRightContent] = useState('')
  const [leftHtml, setLeftHtml] = useState('')
  const [rightHtml, setRightHtml] = useState('')
  const [leftFile, setLeftFile] = useState(null)
  const [rightFile, setRightFile] = useState(null)
  const [leftFileType, setLeftFileType] = useState('text')
  const [rightFileType, setRightFileType] = useState('text')
  const [diffResult, setDiffResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [histories, setHistories] = useState([])
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [syntaxContent, setSyntaxContent] = useState('')
  const [syntaxFileType, setSyntaxFileType] = useState('text')
  const [syntaxResult, setSyntaxResult] = useState(null)
  const [syntaxFile, setSyntaxFile] = useState(null)
  const [fileType, setFileType] = useState('text')

  const stripHtml = (html) => {
    const tmp = document.createElement('DIV')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  const parseStyledText = (text) => {
    const lines = text.split('\n')
    return lines.map((line, idx) => {
      if (line.startsWith('[Images:')) {
        const images = line.slice(9, -2).split(', ')
        return (
          <div key={idx} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
            <strong>Images:</strong>
            <ul>
              {images.map((img, i) => <li key={i}>📷 {img}</li>)}
            </ul>
          </div>
        )
      } else if (line.startsWith('[Charts:')) {
        const charts = line.slice(9, -2).split(', ')
        return (
          <div key={idx} style={{ margin: '10px 0', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}>
            <strong>Charts:</strong>
            <ul>
              {charts.map((chart, i) => <li key={i}>📊 {chart}</li>)}
            </ul>
          </div>
        )
      }
      let paraStyle = {}
      let paraTag = 'p'
      let align = null
      if (line.startsWith('[Title]')) {
        paraTag = 'h1'
        line = line.slice(7)
      } else if (line.startsWith('[Heading 1]')) {
        paraTag = 'h1'
        line = line.slice(11)
      } else if (line.startsWith('[Heading 2]')) {
        paraTag = 'h2'
        line = line.slice(11)
      }
      // Check for alignment
      if (line.startsWith('[align:')) {
        const end = line.indexOf('] ')
        if (end > 6) {
          align = line.slice(7, end)
          line = line.slice(end + 2)
        }
      }
      if (align === 0) paraStyle.textAlign = 'left'
      else if (align === 1) paraStyle.textAlign = 'center'
      else if (align === 2) paraStyle.textAlign = 'right'
      else if (align === 3) paraStyle.textAlign = 'justify'

      const elements = []
      let currentText = ''
      let i = 0
      while (i < line.length) {
        if (line.startsWith('[/style]', i)) {
          elements.push(currentText)
          currentText = ''
          i += 8
        } else if (line[i] === '[' && line.indexOf(']', i) > i) {
          const end = line.indexOf(']', i)
          const styleStr = line.slice(i + 1, end)
          elements.push(currentText)
          currentText = ''
          const style = {}
          styleStr.split('; ').forEach(s => {
            if (s === 'bold') style.fontWeight = 'bold'
            else if (s === 'italic') style.fontStyle = 'italic'
            else if (s === 'underline') style.textDecoration = 'underline'
            else if (s.startsWith('color:')) style.color = '#' + s.slice(6)
            else if (s.startsWith('size:')) style.fontSize = s.slice(5) + 'pt'
            else if (s.startsWith('font:')) style.fontFamily = s.slice(5)
          })
          i = end + 1
          let textStart = i
          const endStyle = line.indexOf('[/style]', i)
          if (endStyle > i) {
            const runText = line.slice(i, endStyle)
            elements.push(<span key={`${idx}-${elements.length}`} style={style}>{runText}</span>)
            i = endStyle
          }
        } else {
          currentText += line[i]
          i++
        }
      }
      elements.push(currentText)
      const ParaTag = paraTag
      return <ParaTag key={idx} style={paraStyle}>{elements}</ParaTag>
    })
  }

  useEffect(() => {
    const user = localStorage.getItem('currentUser')
    if (user) {
      const parsedUser = JSON.parse(user)
      setCurrentUser(parsedUser)
      setCurrentView('compare')
    } else {
      // For debugging, start with compare
      setCurrentView('compare')
    }
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchWithRetry(`/api/get-history?email=${encodeURIComponent(currentUser.email)}`)
        .then(res => res.json())
        .then(h => setHistories(h))
        .catch(err => console.error('Error loading history:', err))
      const p = localStorage.getItem(`profile_${currentUser.email}`) || JSON.stringify({ name: currentUser.name, email: currentUser.email })
      setProfile(JSON.parse(p))
    }
  }, [currentUser])



  const handleLogin = (user) => {
    setCurrentUser(user)
    localStorage.setItem('currentUser', JSON.stringify(user))
    setCurrentView('compare')
  }

  const handleLogout = () => {
    setCurrentUser(null)
    localStorage.removeItem('currentUser')
    setCurrentView('login')
  }

  const handleFileUpload = (e, side) => {
    const file = e.target.files[0]
    if (file) {
      if (side === 'left') {
        setLeftFile(file)
      } else {
        setRightFile(file)
      }
      if (file.name.toLowerCase().endsWith('.docx')) {
        // Use mammoth to convert to HTML with images
        file.arrayBuffer().then(arrayBuffer => {
          mammoth.convertToHtml({ arrayBuffer }).then(result => {
            const html = result.value
            const text = stripHtml(html)
            if (side === 'left') {
              setLeftContent(text)  // For diff
              setLeftHtml(html)
            } else {
              setRightContent(text)
              setRightHtml(html)
            }
          }).catch(err => {
            console.error('Error converting Docx:', err)
            if (side === 'left') {
              setLeftContent('Error converting Docx')
            } else {
              setRightContent('Error converting Docx')
            }
          })
        }).catch(err => {
          console.error('Error reading file:', err)
          if (side === 'left') {
            setLeftContent('Error reading file')
          } else {
            setRightContent('Error reading file')
          }
        })
        if (side === 'left') {
          setLeftFile(file)
        } else {
          setRightFile(file)
        }
      } else {
        const reader = new FileReader()
        reader.onload = (event) => {
          const content = event.target.result
          const fileType = detectFileType(content, file.name)
          if (side === 'left') {
            setLeftContent(content)
            setLeftFileType(fileType)
          } else {
            setRightContent(content)
            setRightFileType(fileType)
          }
        }
        reader.readAsText(file)
      }
    }
  }

  const detectFileType = (content, fileName = null) => {
    if (fileName) {
      const lower = fileName.toLowerCase()
      if (lower.endsWith('.json')) return 'json'
      if (lower.endsWith('.docx')) return 'docx'
    }
    try {
      JSON.parse(content)
      return 'json'
    } catch {
      return 'text'
    }
  }

  const fetchWithRetry = async (url, options, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options)
        return response
      } catch (error) {
        if (i === retries - 1) throw error
        console.log(`Retry ${i + 1} for ${url}`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  const handleCompare = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('input1', leftContent)
      formData.append('input2', rightContent)
      formData.append('input_mode', 'content')
      formData.append('file_type', fileType)
      const response = await fetchWithRetry('/api/compare', {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      setDiffResult(result)
      // Save to history
      if (currentUser) {
        const newHistory = {
          leftContent,
          rightContent,
          result,
          timestamp: new Date().toISOString()
        }
        fetchWithRetry('/api/save-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            history: newHistory
          })
        })
        .then(() => {
          const updated = [newHistory, ...histories]
          setHistories(updated)
        })
        .catch(err => console.error('Error saving history:', err))
      }
    } catch (error) {
      console.error('Error:', error)
      setDiffResult({ error: 'Failed to compare - Backend not available. Please try again.' })
    }
    setLoading(false)
  }

  const handleSyntaxFileUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      setSyntaxFile(file)
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target.result
        setSyntaxContent(content)
        const detectedType = detectFileType(content, file.name)
        setSyntaxFileType(detectedType)
      }
      reader.readAsText(file)
    }
  }

  const handleSyntaxCheck = async () => {
    try {
      const response = await fetchWithRetry('/api/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: syntaxContent,
          file_type: syntaxFileType
        })
      })
      const result = await response.json()
      setSyntaxResult(result)
    } catch (error) {
      console.error('Error:', error)
      setSyntaxResult({ valid: false, errors: [{ line: 0, col: 0, msg: 'Failed to check syntax - Backend not available.' }] })
    }
  }

  const renderHighlightedPanel = (content, html, side, fileType) => {
    if (fileType === 'docx' && html) {
      return <div dangerouslySetInnerHTML={{ __html: html }} />
    }
    if (!diffResult || !diffResult.diffs) {
      return <pre>{content}</pre>
    }
    const lines = content.split('\n')
    return (
      <div>
        {lines.map((line, idx) => {
          const lineNum = idx + 1
          let bgColor = 'transparent'
          const matchingDiff = diffResult.diffs.find(d => {
            if (d.location.startsWith('Left Line') && side === 'left' && d.location.includes(`Line ${lineNum}`)) return true
            if (d.location.startsWith('Right Line') && side === 'right' && d.location.includes(`Line ${lineNum}`)) return true
            if (d.location.startsWith('Line ') && d.location.includes(`Line ${lineNum}`)) return true
            return false
          })
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











  if (currentView === 'login') {
    return <Login onLogin={handleLogin} />
  }

  return (
    <div className="app">
      <nav className="nav">
        <button onClick={() => setCurrentView('compare')}>Compare</button>
        <button onClick={() => setCurrentView('syntax')}>Syntax Check</button>
        <button onClick={() => setCurrentView('profile')}>Profile</button>
        <button onClick={() => setCurrentView('history')}>History</button>
        <button onClick={handleLogout}>Logout</button>
      </nav>
      {currentView === 'compare' && (
        <>
          <h1>Compare Docs</h1>
          <div className="file-type-selector">
            <label>File Type: </label>
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="text">Text</option>
              <option value="json">JSON</option>
              <option value="docx">Docx</option>
            </select>
          </div>
          <div className="panels">
            <div className="panel">
              <h2>Left / Original</h2>
              <input type="file" onChange={(e) => handleFileUpload(e, 'left')} />
              {leftFileType !== 'docx' && (
                <textarea
                  value={leftContent}
                  onChange={(e) => {
                    setLeftContent(e.target.value)
                    setLeftFileType(detectFileType(e.target.value))
                  }}
                  placeholder={leftFileType === 'json' ? "Paste or load JSON content..." : "Paste or load text content..."}
                />
              )}
              {renderHighlightedPanel(leftContent, leftHtml, 'left', leftFileType)}
            </div>
            <div className="panel">
              <h2>Right / Modified</h2>
              <input type="file" onChange={(e) => handleFileUpload(e, 'right')} />
              {rightFileType !== 'docx' && (
                <textarea
                  value={rightContent}
                  onChange={(e) => {
                    setRightContent(e.target.value)
                    setRightFileType(detectFileType(e.target.value))
                  }}
                  placeholder={rightFileType === 'json' ? "Paste or load JSON content..." : "Paste or load text content..."}
                />
              )}
              {renderHighlightedPanel(rightContent, rightHtml, 'right', rightFileType)}
            </div>
            {loading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Comparing documents...</p>
              </div>
            )}
          </div>
          <button onClick={handleCompare} disabled={loading}>
            {loading ? 'Comparing...' : 'Compare'}
          </button>
          {diffResult && diffResult.error && <p style={{ color: 'red' }}>{diffResult.error}</p>}
          {diffResult && !diffResult.identical && !diffResult.error && (
            <div className="diff-summary">
              <h3>Differences Found</h3>
              <ul>
                {diffResult.diffs.map((d, i) => (
                  <li key={i}><strong>{d.location}</strong>: {d.level} - {d.desc}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {currentView === 'syntax' && (
        <SyntaxCheck
          content={syntaxContent}
          setContent={setSyntaxContent}
          fileType={syntaxFileType}
          setFileType={setSyntaxFileType}
          result={syntaxResult}
          onCheck={handleSyntaxCheck}
          onFileUpload={handleSyntaxFileUpload}
        />
      )}
      {currentView === 'profile' && <Profile profile={profile} setProfile={setProfile} currentUser={currentUser} />}
      {currentView === 'history' && <History histories={histories} />}
    </div>
  )
}

export default App