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
      fetch(`/api/get-history?email=${encodeURIComponent(currentUser.email)}`)
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
        // Use mammoth to convert Docx to HTML
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

  const handleCompare = async () => {
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('input1', leftContent)
      formData.append('input2', rightContent)
      formData.append('input_mode', 'content')
      formData.append('file_type', fileType)
      const response = await fetch('/api/compare', {
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
        fetch('/api/save-history', {
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
      setDiffResult({ error: 'Failed to compare' })
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
      const response = await fetch('/api/validate', {
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
      setSyntaxResult({ valid: false, errors: [{ line: 0, col: 0, msg: 'Failed to check syntax' }] })
    }
  }

  const renderHighlightedPanel = (content, html, side) => {
    if (html) {
      // For HTML content, show HTML without highlighting for now
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
              <textarea
                value={leftContent}
                onChange={(e) => {
                  setLeftContent(e.target.value)
                  setLeftFileType(detectFileType(e.target.value))
                }}
                placeholder={leftFileType === 'json' ? "Paste or load JSON content..." : "Paste or load text content..."}
              />
              {diffResult && renderHighlightedPanel(leftContent, leftHtml, 'left')}
            </div>
            <div className="panel">
              <h2>Right / Modified</h2>
              <input type="file" onChange={(e) => handleFileUpload(e, 'right')} />
              <textarea
                value={rightContent}
                onChange={(e) => {
                  setRightContent(e.target.value)
                  setRightFileType(detectFileType(e.target.value))
                }}
                placeholder={rightFileType === 'json' ? "Paste or load JSON content..." : "Paste or load text content..."}
              />
              {diffResult && renderHighlightedPanel(rightContent, rightHtml, 'right')}
            </div>
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