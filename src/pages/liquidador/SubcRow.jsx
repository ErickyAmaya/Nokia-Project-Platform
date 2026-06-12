import { cop } from '../../lib/catalog'
import { btnDel } from './helpers'

export default function SubcRow({ act, actIdx, onExclCR, isViewer, isFinal }) {
  return (
    <tr>
      <td style={{ fontSize: 10, fontWeight: 600 }}>{act.nombre || act.id}</td>
      <td style={{ fontSize: 9, color: '#777' }}>{act.def?.unidad || '—'}</td>
      <td className="num fw6">{act.cant}</td>
      <td className="num" style={{ color: '#b45309' }}>{cop(act.preSubc)}</td>
      <td className="num fw7" style={{ color: '#b45309' }}>{cop(act.totalSubc)}</td>
      {!isViewer && !isFinal && (
        <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
          {act.tipo === 'CR' && (
            <button
              style={btnDel}
              onClick={() => onExclCR(actIdx)}
              title="Excluir solo del costo SubC (permanece en Nokia)"
            >
              × SubC
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
