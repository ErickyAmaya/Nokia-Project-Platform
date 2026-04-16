import { useState, useCallback } from 'react'
import Modal from './Modal'

/**
 * Imperative confirm dialog.
 *
 * Usage:
 *   const { ConfirmModalUI, confirm } = useConfirm()
 *   // In render: <ConfirmModalUI />
 *   // To open:
 *   const ok = await confirm('Título', '¿Estás seguro?')
 *   if (ok) { ... }
 */
export function useConfirm() {
  const [state, setState] = useState({ open: false, title: '', msg: '', resolve: null })

  const confirm = useCallback((title, msg) => {
    return new Promise(resolve => {
      setState({ open: true, title, msg, resolve })
    })
  }, [])

  function handleClose(result) {
    state.resolve?.(result)
    setState(s => ({ ...s, open: false, resolve: null }))
  }

  function ConfirmModalUI() {
    return (
      <Modal
        open={state.open}
        onClose={() => handleClose(false)}
        title={state.title}
        maxWidth={420}
        footer={
          <>
            <button className="btn bou" onClick={() => handleClose(false)}>No</button>
            <button className="btn bp"  onClick={() => handleClose(true)}>Sí</button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>{state.msg}</p>
      </Modal>
    )
  }

  return { confirm, ConfirmModalUI }
}
