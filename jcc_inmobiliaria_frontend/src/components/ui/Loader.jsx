import React from 'react';

const Loader = ({ label = 'Cargando...' }) => (
  <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1rem' }}>
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="18" stroke="#1976d2" strokeWidth="4" opacity="0.2" />
      <circle cx="20" cy="20" r="18" stroke="#1976d2" strokeWidth="4" strokeDasharray="90 60" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
    <span style={{ marginTop: '0.5rem', fontSize: '1rem' }}>{label}</span>
  </div>
);

export default Loader; 