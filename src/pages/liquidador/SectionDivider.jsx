export default function SectionDivider({ label, colSpan, variant = 'nokia' }) {
  const isSubc = variant === 'subc'
  return (
    <tr>
      <td colSpan={colSpan} style={{
        background:    isSubc ? '#fffbeb'              : '#f0f7f0',
        fontWeight:    700,
        fontSize:      9,
        color:         isSubc ? '#92400e'              : '#144E4A',
        padding:       '4px 8px',
        letterSpacing: 1,
        textTransform: 'uppercase',
        borderTop:     isSubc ? '2px solid #fde68a'   : '2px solid #d4e4d4',
      }}>
        {label}
      </td>
    </tr>
  )
}
