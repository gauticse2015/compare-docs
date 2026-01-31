import { useState } from 'react'

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
          onLogin({ name: form.name, email: form.email })
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
          onLogin(data.user)
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

export default Login