import { useState } from 'react'

const SyntaxCheck = ({ content, setContent, fileType, setFileType, result, onCheck, onFileUpload }) => {
  return (
    <div className="syntax-check">
      <h1>Syntax Check</h1>
      <div className="controls">
        <input type="file" onChange={onFileUpload} />
        <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
          <option value="text">Text</option>
          <option value="json">JSON</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="xml">XML</option>
          <option value="javascript">JavaScript</option>
          <option value="yaml">YAML</option>
        </select>
        <button onClick={onCheck}>Check Syntax</button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste your code here or upload a file..."
      />
      {result && (
        <div className="result">
          {result.valid ? (
            <p className="valid">✅ Valid syntax</p>
          ) : (
            <div className="errors">
              <p className="invalid">❌ Syntax errors found:</p>
              <ul>
                {result.errors.map((error, idx) => (
                  <li key={idx}>
                    Line {error.line}, Column {error.col}: {error.msg}
                  </li>
                ))}
              </ul>
              <p className="note">Note: Python reports multiple syntax errors. Other languages report the first error for efficiency. Fix errors and check again for additional issues.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SyntaxCheck