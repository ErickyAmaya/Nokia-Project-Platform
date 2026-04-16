export default function PlaceholderPage({ title }) {
  return (
    <div style={{ padding: 32, textAlign: 'center', color: '#9ca89c' }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
      <h2 style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 24, fontWeight: 700, color: '#555f55', letterSpacing: 1,
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 13, marginTop: 8 }}>En construcción — próxima fase de migración</p>
    </div>
  )
}
