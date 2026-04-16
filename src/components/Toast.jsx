import { useState, useCallback, useEffect, useRef } from 'react'

let _showFn = null

/** Call this from anywhere: showToast('mensaje') or showToast('error!', 'err') */
export function showToast(msg, type = 'ok') {
  if (_showFn) _showFn(msg, type)
}

export default function Toast() {
  const [state, setState] = useState({ msg: '', type: 'ok', visible: false })
  const timer = useRef(null)

  const show = useCallback((msg, type) => {
    clearTimeout(timer.current)
    setState({ msg, type, visible: true })
    timer.current = setTimeout(() => setState(s => ({ ...s, visible: false })), 2800)
  }, [])

  useEffect(() => { _showFn = show; return () => { _showFn = null } }, [show])

  return (
    <div id="toast" className={state.visible ? 'show' : ''} style={{
      borderLeftColor: state.type === 'err' ? '#c0392b' : '#1a9c1a',
    }}>
      {state.msg}
    </div>
  )
}
