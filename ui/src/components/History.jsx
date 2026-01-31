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

export default History