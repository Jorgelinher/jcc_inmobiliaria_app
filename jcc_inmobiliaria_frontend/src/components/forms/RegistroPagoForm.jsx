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
    montoSugerido,
    esDolares = false // Nuevo prop para indicar si la venta/cuota es en dólares
}) {
    
    const getInitialFormData = useCallback(() => ({
        venta: ventaId,
        fecha_pago: new Date().toISOString().split('T')[0],
        monto_pago: montoSugerido !== null && montoSugerido !== undefined && !initialData ? parseFloat(montoSugerido).toFixed(2) : '',
        monto_pago_dolares: '',
        tipo_cambio_pago: '',
        metodo_pago: 'transferencia',
        referencia_pago: '',
        notas_pago: cuotaTarget && !initialData ? `Pago para cuota N° ${cuotaTarget.numero_cuota}` : '',
    }), [ventaId, montoSugerido, cuotaTarget, initialData]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [formError, setFormError] = useState('');
    const [montoSolesCalculado, setMontoSolesCalculado] = useState('');

    useEffect(() => {
        if (show) {
            setFormError('');
            if (initialData) {
                setFormData({
                    venta: initialData.venta || ventaId,
                    fecha_pago: initialData.fecha_pago ? initialData.fecha_pago.split('T')[0] : new Date().toISOString().split('T')[0],
                    monto_pago: initialData.monto_pago || '',
                    monto_pago_dolares: initialData.monto_pago_dolares || '',
                    tipo_cambio_pago: initialData.tipo_cambio_pago || '',
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

    useEffect(() => {
        if (esDolares) {
            const montoUSD = parseFloat(formData.monto_pago_dolares || '');
            const tc = parseFloat(formData.tipo_cambio_pago || '');
            if (!isNaN(montoUSD) && !isNaN(tc) && tc > 0) {
                setMontoSolesCalculado((montoUSD * tc).toFixed(2));
            } else {
                setMontoSolesCalculado('');
            }
        }
    }, [formData.monto_pago_dolares, formData.tipo_cambio_pago, esDolares]);

    // Autocompletar monto sugerido al abrir modal para pagar cuota
    useEffect(() => {
        if (show && cuotaTarget && !initialData) {
            if (esDolares) {
                const saldo = Number(cuotaTarget.saldo_cuota_display?.dolares ?? 0);
                setFormData(prev => ({ ...prev, monto_pago_dolares: saldo > 0 ? saldo : '' }));
            } else {
                const saldo = Number(cuotaTarget.saldo_cuota_display?.soles ?? 0);
                setFormData(prev => ({ ...prev, monto_pago: saldo > 0 ? saldo : '' }));
            }
        }
    }, [show, cuotaTarget, esDolares, initialData]);

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
        if (esDolares) {
            const montoUSD = parseFloat(formData.monto_pago_dolares);
            const tc = parseFloat(formData.tipo_cambio_pago);
            if (isNaN(montoUSD) || montoUSD <= 0) {
                setFormError("El monto del pago en dólares debe ser un número positivo mayor a cero.");
                return;
            }
            if (isNaN(tc) || tc <= 0) {
                setFormError("Debe ingresar un tipo de cambio válido.");
                return;
            }
            const dataToSubmit = {
                ...formData,
                monto_pago_dolares: montoUSD,
                tipo_cambio_pago: tc,
                monto_pago_soles: montoSolesCalculado ? parseFloat(montoSolesCalculado) : null,
            };
            if (!dataToSubmit.monto_pago) {
                delete dataToSubmit.monto_pago;
            }
            onSubmit(dataToSubmit);
            return;
        }
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
                <div>
                    <h3>Venta ID: {ventaId}</h3>
                    {cuotaTarget && (
                        <>
                            <div>Aplicando pago a Cuota N° {cuotaTarget.numero_cuota}</div>
                            <div>Vencimiento: {displayDate(cuotaTarget.fecha_vencimiento)}</div>
                            <div>Saldo Actual de Cuota: <strong>{esDolares
                                ? `$${Number(cuotaTarget.saldo_cuota_display?.dolares ?? 0).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`
                                : `S/ ${Number(cuotaTarget.saldo_cuota_display?.soles ?? 0).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2})}`
                            }</strong></div>
                        </>
                    )}
                </div>
                {formError && <p className={formBaseStyles.errorMessageForm}>{formError}</p>}
                <form onSubmit={handleSubmit}>
                    {esDolares ? (
                        <>
                            <div className={formBaseStyles.formGroup}>
                                <label>Monto a Pagar ($)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    name="monto_pago_dolares"
                                    value={formData.monto_pago_dolares || ''}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label>Tipo de Cambio</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    min="0"
                                    name="tipo_cambio_pago"
                                    value={formData.tipo_cambio_pago || ''}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label>Equivalente en Soles</label>
                                <div>{montoSolesCalculado ? `S/ ${Number(montoSolesCalculado).toLocaleString('es-PE', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}</div>
                            </div>
                        </>
                    ) : (
                        <div className={formBaseStyles.formGroup}>
                            <label>Monto a Pagar (S/.)</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                name="monto_pago"
                                value={formData.monto_pago}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    )}
                    <div className={formBaseStyles.formRow}>
                        <div className={formBaseStyles.formGroup} style={{flex: 1, marginRight: 12}}>
                            <label>Método de Pago</label>
                            <select
                                name="metodo_pago"
                                value={formData.metodo_pago || ''}
                                onChange={handleChange}
                                required
                            >
                                <option value="">Seleccionar...</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="transferencia">Transferencia Bancaria</option>
                                <option value="tarjeta_credito">Tarjeta de Crédito</option>
                                <option value="tarjeta_debito">Tarjeta de Débito</option>
                                <option value="yape_plin">Yape/Plin</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div className={formBaseStyles.formGroup} style={{flex: 1}}>
                            <label>Referencia</label>
                            <input
                                type="text"
                                name="referencia_pago"
                                value={formData.referencia_pago || ''}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                    <div className={formBaseStyles.formGroup}>
                        <label>Notas</label>
                        <textarea
                            name="notas_pago"
                            value={formData.notas_pago || ''}
                            onChange={handleChange}
                            rows={2}
                        />
                    </div>
                    <div className={formBaseStyles.formActions}>
                        <button type="submit" className={formBaseStyles.button + ' ' + formBaseStyles.buttonPrimary}>Registrar Pago</button>
                        <button type="button" onClick={onClose} className={formBaseStyles.button + ' ' + formBaseStyles.buttonSecondary}>Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default RegistroPagoForm;