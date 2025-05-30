// src/components/forms/ActividadDiariaForm.jsx
import React, { useState, useEffect } from 'react';
import * as apiService from '../../services/apiService';
import formBaseStyles from './FormStyles.module.css'; // Estilos base de formulario
import styles from './ActividadDiariaForm.module.css'; // Estilos específicos para este formulario

const METODO_PAGO_CHOICES = [ // Esta constante no se usa en este formulario, la quitaré.
    // { value: 'efectivo', label: 'Efectivo' }, ...
];

function ActividadDiariaForm({ show, onClose, onSubmit, initialData }) {
    const getInitialFormData = () => ({
        fecha_actividad: new Date().toISOString().split('T')[0],
        asesor: '',
        datos_captados_opc: initialData?.datos_captados_opc || 0, // Mantener el valor si es edición
        llamadas_realizadas: initialData?.llamadas_realizadas || 0,
        presencias_generadas: initialData?.presencias_generadas || 0, // Este campo es usualmente de solo lectura
        notas_actividad: initialData?.notas_actividad || '',
    });

    const [formData, setFormData] = useState(getInitialFormData());
    const [asesoresList, setAsesoresList] = useState([]);
    const [loadingRelatedData, setLoadingRelatedData] = useState(false);
    const [formError, setFormError] = useState('');

    useEffect(() => {
        if (show) {
            setLoadingRelatedData(true);
            setFormError('');
            apiService.getAsesores()
                .then(response => {
                    setAsesoresList(response.data.results || response.data || []);
                })
                .catch(error => {
                    console.error("Error cargando lista de asesores:", error);
                    setFormError("No se pudo cargar la lista de asesores.");
                })
                .finally(() => setLoadingRelatedData(false));
        }
    }, [show]);

    useEffect(() => {
        if (show) {
            if (initialData) {
                setFormData({
                    fecha_actividad: initialData.fecha_actividad ? initialData.fecha_actividad.split('T')[0] : new Date().toISOString().split('T')[0],
                    asesor: initialData.asesor?.id_asesor || initialData.asesor || '',
                    datos_captados_opc: initialData.datos_captados_opc !== undefined ? initialData.datos_captados_opc : 0,
                    llamadas_realizadas: initialData.llamadas_realizadas !== undefined ? initialData.llamadas_realizadas : 0,
                    presencias_generadas: initialData.presencias_generadas !== undefined ? initialData.presencias_generadas : 0,
                    notas_actividad: initialData.notas_actividad || '',
                });
            } else {
                setFormData(getInitialFormData()); // Llama a la función para resetear
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, show]); // getInitialFormData puede quitarse si no cambia o se usa como ref

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            // Para inputs numéricos, permitir string vacío para borrar, convertir a número al hacer submit
            [name]: type === 'number' && value === '' ? '' : value 
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.asesor) {
            setFormError("Por favor, seleccione un asesor.");
            return;
        }
        setFormError('');

        const dataToSubmit = {
            ...formData,
            // Asegurar que los campos numéricos sean enteros o 0 si están vacíos
            datos_captados_opc: formData.datos_captados_opc === '' ? 0 : parseInt(formData.datos_captados_opc, 10),
            llamadas_realizadas: formData.llamadas_realizadas === '' ? 0 : parseInt(formData.llamadas_realizadas, 10),
            // presencias_generadas es usualmente un campo de solo lectura, actualizado por el backend
            // Si es editable, incluirlo. Si no, excluirlo del submit.
            // presencias_generadas: formData.presencias_generadas === '' ? 0 : parseInt(formData.presencias_generadas, 10),
        };
        // Si presencias_generadas no debe ser enviado por el usuario (porque es calculado):
        if (initialData && initialData.presencias_generadas !== undefined && !formData.hasOwnProperty('presencias_generadas_manual')) {
             // No enviar presencias_generadas si no es un campo que el usuario deba modificar directamente
             // a menos que tengas un campo específico para edición manual.
             // Por ahora, lo enviamos si está en formData. El backend decidirá si lo usa.
             dataToSubmit.presencias_generadas = formData.presencias_generadas === '' ? 0 : parseInt(formData.presencias_generadas, 10)
        }


        onSubmit(dataToSubmit, initialData?.id_actividad); // Pasar ID si es edición
    };

    return (
        <div className={formBaseStyles.modalOverlay}>
            {/* Aplicar clase específica para el ancho de este modal */}
            <div className={`${formBaseStyles.modalContent} ${styles.actividadModalContent}`}>
                <h2>{initialData?.id_actividad ? 'Editar Actividad Diaria' : 'Registrar Actividad Diaria'}</h2>
                {loadingRelatedData && <p className={formBaseStyles.loadingText}>Cargando lista de asesores...</p>}
                {formError && <p className={formBaseStyles.errorMessageForm}>{formError}</p>}
                
                {!loadingRelatedData && (
                    <form onSubmit={handleSubmit}>
                        <div className={formBaseStyles.formRow}>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="fecha_actividad">Fecha de Actividad <span className={formBaseStyles.required}>*</span></label>
                                <input type="date" id="fecha_actividad" name="fecha_actividad" value={formData.fecha_actividad} onChange={handleChange} required />
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="asesor">Asesor <span className={formBaseStyles.required}>*</span></label>
                                <select id="asesor" name="asesor" value={formData.asesor} onChange={handleChange} required disabled={loadingRelatedData}>
                                    <option value="">Seleccione un Asesor</option>
                                    {asesoresList.map(asesor => (
                                        <option key={asesor.id_asesor} value={asesor.id_asesor}>
                                            {asesor.nombre_asesor} ({asesor.id_asesor})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={formBaseStyles.formRow}>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="datos_captados_opc">Datos Captados OPC</label>
                                <input type="number" id="datos_captados_opc" name="datos_captados_opc" value={formData.datos_captados_opc} onChange={handleChange} min="0" />
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="llamadas_realizadas">Datos Gestionados</label>
                                <input type="number" id="llamadas_realizadas" name="llamadas_realizadas" value={formData.llamadas_realizadas} onChange={handleChange} min="0" />
                            </div>
                        </div>
                        
                        {/* Presencias Generadas usualmente es de solo lectura y se calcula en backend,
                            pero si necesitas editarlo manualmente, mantenlo. Sino, coméntalo o quítalo. */}
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="presencias_generadas">Presencias Generadas (Manual)</label>
                            <input type="number" id="presencias_generadas" name="presencias_generadas" value={formData.presencias_generadas} onChange={handleChange} min="0" />
                        </div>

                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="notas_actividad">Notas de la Actividad</label>
                            <textarea id="notas_actividad" name="notas_actividad" value={formData.notas_actividad} onChange={handleChange} rows="3"></textarea>
                        </div>

                        <div className={formBaseStyles.formActions}>
                            <button type="submit" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`} disabled={loadingRelatedData}>
                                {initialData?.id_actividad ? 'Actualizar Actividad' : 'Guardar Actividad'}
                            </button>
                            <button type="button" onClick={onClose} className={`${formBaseStyles.button} ${formBaseStyles.buttonSecondary}`}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ActividadDiariaForm;