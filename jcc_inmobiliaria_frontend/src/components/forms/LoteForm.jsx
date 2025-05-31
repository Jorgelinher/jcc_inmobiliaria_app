// src/components/forms/LoteForm.jsx
import React, { useState, useEffect } from 'react';
import styles from './FormStyles.module.css'; //

const ESTADO_LOTE_CHOICES = [
    { value: 'Disponible', label: 'Disponible' },
    { value: 'Reservado', label: 'Reservado' },
    { value: 'Vendido', label: 'Vendido' },
];

// --- INICIO: Definir las opciones para la ubicación del proyecto ---
const UBICACION_PROYECTO_CHOICES = [
    { value: '', label: 'Seleccione un proyecto...' }, // Opción por defecto/invitación
    { value: 'OASIS 1 (HUACHO 1)', label: 'OASIS 1 (HUACHO 1)' },
    { value: 'OASIS 2 (AUCALLAMA)', label: 'OASIS 2 (AUCALLAMA)' },
    { value: 'OASIS 3 (HUACHO 2)', label: 'OASIS 3 (HUACHO 2)' },
    // Puedes añadir más proyectos aquí si es necesario
    // { value: 'Otro Proyecto', label: 'Otro Proyecto' }, // Si necesitas una opción "Otro"
];
// --- FIN: Definir las opciones para la ubicación del proyecto ---

function LoteForm({ show, onClose, onSubmit, initialData }) {
    const getInitialFormData = () => ({
        ubicacion_proyecto: '', // Valor inicial vacío para que se muestre "Seleccione un proyecto..."
        manzana: '',
        numero_lote: '',
        etapa: '',
        area_m2: '',
        precio_lista_soles: '', 
        precio_credito_12_meses_soles: '',
        precio_credito_24_meses_soles: '',
        precio_credito_36_meses_soles: '',
        precio_lista_dolares: '', 
        estado_lote: 'Disponible',
        colindancias: '',
        partida_registral: '',
        observaciones_lote: '',
    });

    const [formData, setFormData] = useState(getInitialFormData());

    useEffect(() => {
        if (show) {
            if (initialData) {
                setFormData({
                    ubicacion_proyecto: initialData.ubicacion_proyecto || '', // Usar '' si es null/undefined
                    manzana: initialData.manzana || '',
                    numero_lote: initialData.numero_lote || '',
                    etapa: initialData.etapa !== null && initialData.etapa !== undefined ? initialData.etapa : '',
                    area_m2: initialData.area_m2 || '',
                    precio_lista_soles: initialData.precio_lista_soles || '',
                    precio_credito_12_meses_soles: initialData.precio_credito_12_meses_soles || '',
                    precio_credito_24_meses_soles: initialData.precio_credito_24_meses_soles || '',
                    precio_credito_36_meses_soles: initialData.precio_credito_36_meses_soles || '',
                    precio_lista_dolares: initialData.precio_lista_dolares || '',
                    estado_lote: initialData.estado_lote || 'Disponible',
                    colindancias: initialData.colindancias || '',
                    partida_registral: initialData.partida_registral || '',
                    observaciones_lote: initialData.observaciones_lote || '',
                });
            } else {
                setFormData(getInitialFormData());
            }
        }
    }, [initialData, show]);

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: (type === 'number' && value === '') ? '' : value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validación para asegurar que se haya seleccionado un proyecto
        if (!formData.ubicacion_proyecto) {
            // Podrías manejar esto con un error en el estado del formulario si prefieres
            alert("Por favor, seleccione una ubicación del proyecto.");
            return;
        }
        const dataToSubmit = {
            ...formData,
            area_m2: formData.area_m2 === '' ? null : parseFloat(formData.area_m2),
            precio_lista_soles: formData.precio_lista_soles === '' ? null : parseFloat(formData.precio_lista_soles),
            precio_credito_12_meses_soles: formData.precio_credito_12_meses_soles === '' ? null : parseFloat(formData.precio_credito_12_meses_soles),
            precio_credito_24_meses_soles: formData.precio_credito_24_meses_soles === '' ? null : parseFloat(formData.precio_credito_24_meses_soles),
            precio_credito_36_meses_soles: formData.precio_credito_36_meses_soles === '' ? null : parseFloat(formData.precio_credito_36_meses_soles),
            precio_lista_dolares: formData.precio_lista_dolares === '' ? null : parseFloat(formData.precio_lista_dolares),
            etapa: formData.etapa === '' ? null : parseInt(formData.etapa, 10),
        };
        onSubmit(dataToSubmit);
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.modalContent} style={{maxWidth: '700px'}}>
                <h2>{initialData?.id_lote ? 'Editar Lote' : 'Crear Nuevo Lote'}</h2>
                <form onSubmit={handleSubmit}>
                    <div className={styles.formRow}>
                        <div className={styles.formGroup} style={{flex: 2}}>
                            <label htmlFor="ubicacion_proyecto">Ubicación del Proyecto <span className={styles.required}>*</span></label>
                            {/* --- INICIO: CAMBIO A SELECT --- */}
                            <select 
                                id="ubicacion_proyecto" 
                                name="ubicacion_proyecto" 
                                value={formData.ubicacion_proyecto} 
                                onChange={handleChange} 
                                required
                            >
                                {UBICACION_PROYECTO_CHOICES.map(opcion => (
                                    <option key={opcion.value} value={opcion.value}>
                                        {opcion.label}
                                    </option>
                                ))}
                            </select>
                            {/* --- FIN: CAMBIO A SELECT --- */}
                        </div>
                        <div className={styles.formGroup} style={{flex: 1}}>
                            <label htmlFor="etapa">Etapa (Número)</label>
                            <input type="number" id="etapa" name="etapa" value={formData.etapa} onChange={handleChange} min="0" placeholder="Ej: 1"/>
                        </div>
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label htmlFor="manzana">Manzana</label>
                            <input type="text" id="manzana" name="manzana" value={formData.manzana} onChange={handleChange} />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="numero_lote">Número de Lote</label>
                            <input type="text" id="numero_lote" name="numero_lote" value={formData.numero_lote} onChange={handleChange} />
                        </div>
                         <div className={styles.formGroup}>
                            <label htmlFor="area_m2">Área (m²) <span className={styles.required}>*</span></label>
                            <input type="number" id="area_m2" name="area_m2" value={formData.area_m2} onChange={handleChange} step="0.01" required placeholder="Ej: 120.50"/>
                        </div>
                    </div>
                    
                    <hr className={styles.formSeparator}/>
                    <h3 className={styles.subHeader}>Precios en Soles (S/.)</h3>
                    
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label htmlFor="precio_lista_soles">Precio Contado <span className={styles.required}>*</span></label>
                            <input type="number" id="precio_lista_soles" name="precio_lista_soles" value={formData.precio_lista_soles} onChange={handleChange} step="0.01" required placeholder="Ej: 50000.00"/>
                        </div>
                    </div>
                    
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label htmlFor="precio_credito_12_meses_soles">Precio Crédito 12 Meses</label>
                            <input type="number" id="precio_credito_12_meses_soles" name="precio_credito_12_meses_soles" value={formData.precio_credito_12_meses_soles} onChange={handleChange} step="0.01" placeholder="Ej: 55000.00"/>
                        </div>
                         <div className={styles.formGroup}>
                            <label htmlFor="precio_credito_24_meses_soles">Precio Crédito 24 Meses</label>
                            <input type="number" id="precio_credito_24_meses_soles" name="precio_credito_24_meses_soles" value={formData.precio_credito_24_meses_soles} onChange={handleChange} step="0.01" placeholder="Ej: 60000.00"/>
                        </div>
                         <div className={styles.formGroup}>
                            <label htmlFor="precio_credito_36_meses_soles">Precio Crédito 36 Meses</label>
                            <input type="number" id="precio_credito_36_meses_soles" name="precio_credito_36_meses_soles" value={formData.precio_credito_36_meses_soles} onChange={handleChange} step="0.01" placeholder="Ej: 65000.00"/>
                        </div>
                    </div>
                    
                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label htmlFor="precio_lista_dolares">Precio Contado ($) (Opcional)</label>
                            <input type="number" id="precio_lista_dolares" name="precio_lista_dolares" value={formData.precio_lista_dolares} onChange={handleChange} step="0.01" placeholder="Ej: 13500.00"/>
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="estado_lote">Estado del Lote <span className={styles.required}>*</span></label>
                            <select id="estado_lote" name="estado_lote" value={formData.estado_lote} onChange={handleChange} required>
                                {ESTADO_LOTE_CHOICES.map(opcion => (
                                    <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <hr className={styles.formSeparator}/>
                    <h3 className={styles.subHeader}>Detalles Adicionales</h3>

                    <div className={styles.formGroup}>
                        <label htmlFor="colindancias">Colindancias</label>
                        <textarea id="colindancias" name="colindancias" value={formData.colindancias} onChange={handleChange} rows="2"></textarea>
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="partida_registral">Partida Registral</label>
                        <input type="text" id="partida_registral" name="partida_registral" value={formData.partida_registral} onChange={handleChange} />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="observaciones_lote">Observaciones del Lote</label>
                        <textarea id="observaciones_lote" name="observaciones_lote" value={formData.observaciones_lote} onChange={handleChange} rows="2"></textarea>
                    </div>

                    <div className={styles.formActions}>
                        <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`}>
                            {initialData?.id_lote ? 'Actualizar Lote' : 'Guardar Lote'}
                        </button>
                        <button type="button" onClick={onClose} className={`${styles.button} ${styles.buttonSecondary}`}>
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LoteForm;