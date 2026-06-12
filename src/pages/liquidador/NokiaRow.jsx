import { useState } from 'react'
import { cop } from '../../lib/catalog'
import { IconEdit, btnEdit, btnConfirm, btnDel } from './helpers'

export default function NokiaRow({ act, actIdx, onCantChange, onDelete, isViewer, isFinal }) {
  const [editing, setEditing]   = useState(false)
  const [tempCant, setTempCant] = useState(act.cant)

  function startEdit()   { setTempCant(act.cant); setEditing(true) }
  function confirmEdit() { onCantChange(actIdx, Math.max(0, parseInt(tempCant) || 0)); setEditing(false) }
  function cancelEdit()  { setEditing(false) }

  return (
    <tr>
      <td style={{ fontSize: 10, fontWeight: 600 }}>{act.nombre || act.id}</td>
      <td style={{ fontSize: 9, color: '#777' }}>{act.def?.unidad || '—'}</td>
      <td className="num">
        {editing ? (
          <input
            autoFocus
            type="number" min="0"
            style={{ width: 50, textAlign: 'right', border: '1px solid #93c5fd', borderRadius: 4, padding: '2px 4px', fontSize: 11, background: '#fff' }}
            value={tempCant}
            onChange={e => setTempCant(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmEdit(); if (e.key === 'Escape') cancelEdit() }}
          />
        ) : (
          <span>{act.cant}</span>
        )}
      </td>
      <td className="num" style={{ color: '#144E4A' }}>{cop(act.preNokia)}</td>
      <td className="num fw7" style={{ color: '#144E4A' }}>{cop(act.totalNokia)}</td>
      {!isViewer && !isFinal && (
        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
          {editing ? (
            <>
              <button style={btnConfirm} onClick={confirmEdit} title="Confirmar">✓</button>
              {' '}
              <button style={btnDel} onClick={cancelEdit} title="Cancelar">✕</button>
            </>
          ) : (
            <>
              <button style={btnEdit} onClick={startEdit} title="Editar cantidad"><IconEdit /></button>
              {' '}
              <button style={btnDel} onClick={() => onDelete(actIdx)} title="Eliminar actividad">✕</button>
            </>
          )}
        </td>
      )}
    </tr>
  )
}
