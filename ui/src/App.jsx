import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)
  const [currentView, setCurrentView] = useState('login')
  const [leftContent, setLeftContent] = useState('')
  const [rightContent, setRightContent] = useState('')
  const [diffResult, setDiffResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [histories, setHistories] = useState([])
  const [profile, setProfile] = useState({ name: '', email: '' })

  useEffect(() => {
    const user = localStorage.getItem('currentUser')
    if (user) {
      const parsedUser = JSON.parse(user)
      setCurrentUser(parsedUser)
      setCurrentView('compare')
    } else {
      setCurrentView('login')
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
            ...newHistory
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

  const EyeOpen = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )

  const EyeClosed = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2.99902 3L20.999 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1 12C1 12 5 4 12 4C19 4 23 12 23 12C23 12 19 20 12 20C5 20 1 12 1 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )

  const Login = ({ onLogin }) => {
    const [currentView, setCurrentView] = useState('login')
    const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
    const [errors, setErrors] = useState({})
    const [passwordVisible, setPasswordVisible] = useState(false)
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)

    const validateForm = () => {
      const newErrors = {}
      if (currentView === 'signup') {
        if (!form.name.trim()) newErrors.name = 'Name is required'
        if (form.password.length < 6) newErrors.password = 'Password must be at least 6 characters'
        if (!/[A-Z]/.test(form.password)) newErrors.password = 'Must contain uppercase letter'
        if (!/[a-z]/.test(form.password)) newErrors.password = 'Must contain lowercase letter'
        if (!/[0-9]/.test(form.password)) newErrors.password = 'Must contain number'
        if (form.password !== form.confirmPassword) newErrors.confirmPassword = 'Passwords do not match'
      }
      if (!form.email.includes('@')) newErrors.email = 'Invalid email'
      return newErrors
    }

    const handleSubmit = (e) => {
      e.preventDefault()
      const newErrors = validateForm()
      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }
      setErrors({})
      if (currentView === 'signup') {
        fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
        })
        .then(res => res.json())
        .then(data => {
          if (data.message) {
            handleLogin({ name: form.name, email: form.email })
          } else {
            setErrors({ general: data.detail || 'Error' })
          }
        })
        .catch(err => setErrors({ general: 'Network error' }))
      } else if (currentView === 'login') {
        fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password })
        })
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            handleLogin(data.user)
          } else {
            setErrors({ general: data.detail || 'Error' })
          }
        })
        .catch(err => setErrors({ general: 'Network error' }))
      } else if (currentView === 'forgot') {
        if (form.password !== form.confirmPassword) {
          setErrors({ confirmPassword: 'Passwords do not match' })
          return
        }
        fetch('/api/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, new_password: form.password })
        })
        .then(res => res.json())
        .then(data => {
          if (data.message) {
            alert('Password reset successfully!')
            setCurrentView('login')
          } else {
            setErrors({ email: data.detail || 'Error' })
          }
        })
        .catch(err => setErrors({ general: 'Network error' }))
      }
    }

    const renderForm = () => {
      if (currentView === 'signup') {
        return (
          <>
            <div className="input-group">
              <input
                placeholder="Full Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={errors.name ? 'error' : ''}
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>
            <div className="input-group">
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div className="input-group password-group">
              <input
                placeholder="Password"
                type={passwordVisible ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="password-toggle"
              >
                {passwordVisible ? <EyeClosed /> : <EyeOpen />}
              </button>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
            <div className="input-group password-group">
              <input
                placeholder="Confirm Password"
                type={confirmPasswordVisible ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={errors.confirmPassword ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                className="password-toggle"
              >
                {confirmPasswordVisible ? <EyeClosed /> : <EyeOpen />}
              </button>
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>
            <button type="submit" className="signup-btn">Sign Up</button>
            <button type="button" onClick={() => setCurrentView('login')} className="back-btn">
              Already have an account? Log in
            </button>
          </>
        )
      } else if (currentView === 'forgot') {
        return (
          <>
            <h2 className="forgot-title">Reset Password</h2>
            <p className="forgot-subtitle">Enter your email and set a new password.</p>
            <div className="input-group">
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div className="input-group password-group">
              <input
                placeholder="New Password"
                type={passwordVisible ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="password-toggle"
              >
                {passwordVisible ? <EyeClosed /> : <EyeOpen />}
              </button>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
            <div className="input-group password-group">
              <input
                placeholder="Confirm New Password"
                type={confirmPasswordVisible ? 'text' : 'password'}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className={errors.confirmPassword ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                className="password-toggle"
              >
                {confirmPasswordVisible ? <EyeClosed /> : <EyeOpen />}
              </button>
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>
            <button type="submit" className="reset-btn">Reset Password</button>
            <button type="button" onClick={() => setCurrentView('login')} className="back-btn">
              Back to Login
            </button>
          </>
        )
      } else {
        return (
          <>
            <div className="input-group">
              <input
                placeholder="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>
            <div className="input-group password-group">
              <input
                placeholder="Password"
                type={passwordVisible ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={errors.password ? 'error' : ''}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible(!passwordVisible)}
                className="password-toggle"
              >
                {passwordVisible ? <EyeClosed /> : <EyeOpen />}
              </button>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>
            {errors.general && <span className="error-text general">{errors.general}</span>}
            <button type="submit" className="login-btn">Log In</button>
            <div className="forgot-link">
              <button type="button" onClick={() => setCurrentView('forgot')} className="forgot-btn">
                Forgot Password?
              </button>
            </div>
            <button type="button" onClick={() => setCurrentView('signup')} className="signup-btn">
              Create New Account
            </button>
          </>
        )
      }
    }

    return (
      <div className="login-container">
        <div className="login-card">
          <div className="logo">
            <h1>Compare Docs</h1>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            {renderForm()}
          </form>
        </div>
      </div>
    )
  }

  const Profile = ({ profile, setProfile, currentUser }) => {
    const [edit, setEdit] = useState(false)
    const [tempProfile, setTempProfile] = useState(profile)

    const handleSave = () => {
      setProfile(tempProfile)
      localStorage.setItem(`profile_${currentUser.email}`, JSON.stringify(tempProfile))
      setEdit(false)
    }

    return (
      <div className="profile">
        <h2>Profile</h2>
        {edit ? (
          <div>
            <input value={tempProfile.name} onChange={(e) => setTempProfile({ ...tempProfile, name: e.target.value })} placeholder="Name" />
            <input value={tempProfile.email} onChange={(e) => setTempProfile({ ...tempProfile, email: e.target.value })} placeholder="Email" />
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setEdit(false)}>Cancel</button>
          </div>
        ) : (
          <div>
            <p>Name: {profile.name}</p>
            <p>Email: {profile.email}</p>
            <button onClick={() => setEdit(true)}>Edit</button>
          </div>
        )}
      </div>
    )
  }

  const History = ({ histories }) => {
    return (
      <div className="history">
        <h2>History</h2>
        {histories.length === 0 && <p>No history yet.</p>}
        {histories.map(h => (
          <div key={h.id} className="history-item">
            <p>{new Date(h.timestamp).toLocaleString()}</p>
            <details>
              <summary>View Comparison</summary>
              <div>
                <h4>Left</h4>
                <pre>{h.leftContent}</pre>
                <h4>Right</h4>
                <pre>{h.rightContent}</pre>
                <h4>Result</h4>
                <pre>{JSON.stringify(h.result, null, 2)}</pre>
              </div>
            </details>
          </div>
        ))}
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
        <button onClick={() => setCurrentView('profile')}>Profile</button>
        <button onClick={() => setCurrentView('history')}>History</button>
        <button onClick={handleLogout}>Logout</button>
      </nav>
      {currentView === 'compare' && (
        <>
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
          {diffResult && diffResult.error && <p style={{ color: 'red' }}>{diffResult.error}</p>}
        </>
      )}
      {currentView === 'profile' && <Profile profile={profile} setProfile={setProfile} currentUser={currentUser} />}
      {currentView === 'history' && <History histories={histories} />}
    </div>
  )
}

export default App