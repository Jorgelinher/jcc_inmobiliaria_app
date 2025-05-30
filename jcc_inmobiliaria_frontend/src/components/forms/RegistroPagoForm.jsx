// src/components/forms/RegistroPagoForm.jsx
import React, { useState, useEffect, useCallback } from 'react'; // <--- useCallback AÑADIDO AQUÍ
import formBaseStyles from './FormStyles.module.css';
import styles from './RegistroPagoForm.module.css'; // Asegúrate que este archivo exista si lo usas

const METODO_PAGO_CHOICES = [
    { value: 'efectivo', label: 'Efectivo' },
    { value: 'transferencia', label: 'Transferencia Bancaria' },
    { value: 'tarjeta_credito', label: 'Tarjeta de Crédito' },
    { value: 'tarjeta_debito', label: 'Tarjeta de Débito' },
    { value: 'yape_plin', label: 'Yape/Plin' },
    { value: 'otro', label: 'Otro' },
];

function RegistroPagoForm({ 
    show, 
    onClose, 
    onSubmit, 
    ventaId, 
    initialData, 
    cuotaTarget, 
    montoSugerido 
}) {
    
    const getInitialFormData = useCallback(() => ({
        venta: ventaId,
        fecha_pago: new Date().toISOString().split('T')[0],
        monto_pago: montoSugerido !== null && montoSugerido !== undefined && !initialData ? parseFloat(montoSugerido).toFixed(2) : '',
        metodo_pago: 'transferencia',
        referencia_pago: '',
        notas_pago: cuotaTarget && !initialData ? `Pago para cuota N° ${cuotaTarget.numero_cuota}` : '',
    }), [ventaId, montoSugerido, cuotaTarget, initialData]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (show) {
            setFormError('');
            if (initialData) {
                setFormData({
                    venta: initialData.venta || ventaId,
                    fecha_pago: initialData.fecha_pago ? initialData.fecha_pago.split('T')[0] : new Date().toISOString().split('T')[0],
                    monto_pago: initialData.monto_pago || '',
                    metodo_pago: initialData.metodo_pago || 'transferencia',
                    referencia_pago: initialData.referencia_pago || '',
                    notas_pago: initialData.notas_pago || '',
                    cuota_plan_pago_cubierta: initialData.cuota_plan_pago_cubierta || (cuotaTarget ? cuotaTarget.id_cuota : null)
                });
            } else {
                setFormData(getInitialFormData());
            }
        }
    }, [initialData, show, ventaId, cuotaTarget, montoSugerido, getInitialFormData]);

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value 
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');
        
        const monto = parseFloat(formData.monto_pago);
        if (isNaN(monto) || monto <= 0) {
            setFormError("El monto del pago debe ser un número positivo mayor a cero.");
            return;
        }
        if (cuotaTarget && montoSugerido !== null && monto > parseFloat(montoSugerido) + 0.01) {
             if (!window.confirm(`El monto ingresado (S/. ${monto.toFixed(2)}) es mayor al saldo de la cuota (S/. ${parseFloat(montoSugerido).toFixed(2)}). ¿Desea continuar?`)) {
                 return;
             }
        }

        const dataToSubmit = {
            ...formData,
            monto_pago: monto,
        };
        onSubmit(dataToSubmit);
    };
    
    const displayCurrency = (value) => (value !== null && value !== undefined) ? parseFloat(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }) : '-';
    const displayDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }) : '-';

    return (
        <div className={formBaseStyles.modalOverlay}>
            <div className={`${formBaseStyles.modalContent} ${styles.pagoModalContent}`}>
                <h2>{initialData ? 'Editar Pago' : 'Registrar Nuevo Pago'}</h2>

                {cuotaTarget && !initialData && (
                    <div className={styles.infoBoxSmall}>
                        <p><strong>Venta ID:</strong> {ventaId}</p>
                        <p>Aplicando pago a <strong>Cuota N° {cuotaTarget.numero_cuota}</strong></p>
                        <p>Vencimiento: {displayDate(cuotaTarget.fecha_vencimiento)}</p>
                        <p>Saldo Actual de Cuota: <strong>{displayCurrency(cuotaTarget.saldo_cuota)}</strong></p>
                    </div>
                )}

                {formError && <p className={formBaseStyles.errorMessageForm}>{formError}</p>}
                <form onSubmit={handleSubmit}>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="fecha_pago">Fecha del Pago <span className={formBaseStyles.required}>*</span></label>
                        <input type="date" id="fecha_pago" name="fecha_pago" value={formData.fecha_pago} onChange={handleChange} required />
                    </div>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="monto_pago">Monto del Pago (S/.) <span className={formBaseStyles.required}>*</span></label>
                        <input 
                            type="number" 
                            id="monto_pago" 
                            name="monto_pago" 
                            value={formData.monto_pago} 
                            onChange={handleChange} 
                            step="0.01" 
                            required 
                            placeholder="Ej: 500.00"
                        />
                    </div>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="metodo_pago">Método de Pago</label>
                        <select id="metodo_pago" name="metodo_pago" value={formData.metodo_pago} onChange={handleChange}>
                            {METODO_PAGO_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="referencia_pago">Referencia del Pago</label>
                        <input type="text" id="referencia_pago" name="referencia_pago" value={formData.referencia_pago} onChange={handleChange} placeholder="N° Op, Código, etc."/>
                    </div>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="notas_pago">Notas Adicionales</label>
                        <textarea id="notas_pago" name="notas_pago" value={formData.notas_pago} onChange={handleChange} rows="2"></textarea>
                    </div>
                    <div className={formBaseStyles.formActions}>
                        <button type="submit" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`}>
                            {initialData ? 'Actualizar Pago' : 'Guardar Pago'}
                        </button>
                        <button type="button" onClick={onClose} className={`${formBaseStyles.button} ${formBaseStyles.buttonSecondary}`}>
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RegistroPagoForm;