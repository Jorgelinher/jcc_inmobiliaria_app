import React, { useEffect, useState } from 'react';
import formStyles from './FormStyles.module.css';
import * as apiService from '../../services/apiService';
// import modalStyles from './GestionCobranzaForm.module.css'; // Ya no se usará para el modal ni botones

function GestionCobranzaForm({ cuota, onClose, onGestionGuardada }) {
  const [historial, setHistorial] = useState([]);
  const [form, setForm] = useState({ tipo_contacto: '', resultado: '', proximo_seguimiento: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistorial();
  }, [cuota]);

  const fetchHistorial = async () => {
    try {
      const res = await apiService.get(`/gestion/cobranzas/gestiones/?cuota=${cuota.id_cuota}`);
      setHistorial(res.data);
    } catch (err) {
      setHistorial([]);
    }
  };

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Validar fecha de próximo seguimiento
    if (form.proximo_seguimiento) {
      const hoy = new Date();
      const prox = new Date(form.proximo_seguimiento);
      hoy.setHours(0,0,0,0);
      prox.setHours(0,0,0,0);
      if (prox < hoy) {
        setError('La fecha de Próximo Seguimiento no puede ser anterior a hoy.');
        setLoading(false);
        return;
      }
    }
    try {
      console.log('Enviando datos:', {
        cuota: cuota.id_cuota,
        tipo_contacto: form.tipo_contacto,
        resultado: form.resultado,
        proximo_seguimiento: form.proximo_seguimiento || null,
      });
      await apiService.post('/gestion/cobranzas/gestiones/', {
        cuota: cuota.id_cuota,
        tipo_contacto: form.tipo_contacto,
        resultado: form.resultado,
        proximo_seguimiento: form.proximo_seguimiento || null,
      });
      setForm({ tipo_contacto: '', resultado: '', proximo_seguimiento: '' });
      if (onGestionGuardada) onGestionGuardada();
      // No cerrar el modal automáticamente
    } catch (err) {
      console.error('Error en submit:', err);
      setError('Error al registrar la gestión.');
    }
    setLoading(false);
  };

  return (
    <div className={formStyles.modalOverlay}>
      <div className={formStyles.modalContent} style={{ maxWidth: 500 }}>
        <h2>Gestión de Cobranza - Cuota N°{cuota.numero_cuota}</h2>
        <form onSubmit={handleSubmit}>
          <h4 className={formStyles.subHeader}>Registrar Nueva Gestión</h4>
          <div className={formStyles.formGroup}>
            <label>Tipo de Contacto</label>
            <select name="tipo_contacto" value={form.tipo_contacto} onChange={handleChange} required>
              <option value="">Seleccione...</option>
              <option value="LLAMADA">Llamada Telefónica</option>
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Correo Electrónico</option>
              <option value="CARTA">Carta Notarial</option>
            </select>
          </div>
          <div className={formStyles.formGroup}>
            <label>Resultado</label>
            <textarea name="resultado" value={form.resultado} onChange={handleChange} required rows={2} />
          </div>
          <div className={formStyles.formGroup}>
            <label>Próximo Seguimiento</label>
            <input type="date" name="proximo_seguimiento" value={form.proximo_seguimiento} onChange={handleChange} />
          </div>
          {error && <div className={formStyles.errorMessageForm}>{error}</div>}
          <div className={formStyles.formActions}>
            <button type="submit" className={`${formStyles.button} ${formStyles.buttonPrimary}`} disabled={loading}>{loading ? 'Guardando...' : 'Registrar Gestión'}</button>
            <button type="button" onClick={onClose} className={`${formStyles.button} ${formStyles.buttonSecondary}`}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default GestionCobranzaForm; 