// src/components/forms/AsesorForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import formBaseStyles from './FormStyles.module.css';
import styles from './AsesorForm.module.css'; // Para .asesorFormModalContent y .formGrid

const TIPO_ASESOR_CHOICES = [
    { value: 'Junior', label: 'Junior' },
    { value: 'Socio', label: 'Socio' },
    // { value: 'Otro', label: 'Otro' }, // Si lo tienes en el modelo
];

const ESTADO_CIVIL_ASESOR_CHOICES = [
    { value: '', label: '(No especificado)'},
    { value: 'Soltero(a)', label: 'Soltero(a)' },
    { value: 'Casado(a)', label: 'Casado(a)' },
    { value: 'Viudo(a)', label: 'Viudo(a)' },
    { value: 'Divorciado(a)', label: 'Divorciado(a)' },
    { value: 'Conviviente', label: 'Conviviente' },
];

const BANCO_OPTIONS = [
    { value: '', label: 'Seleccione un banco' },
    { value: 'BCP', label: 'Banco de Crédito BCP' },
    { value: 'Interbank', label: 'Interbank' },
    { value: 'Scotiabank', label: 'Scotiabank' },
    { value: 'BBVA', label: 'BBVA Continental' },
    { value: 'Otro', label: 'Otro Banco' },
];

function AsesorForm({ show, onClose, onSubmit, initialData, asesoresList = [], formError: externalError, clearExternalError }) {
    
    const getInitialFormData = useCallback(() => ({
        nombre_asesor: '',
        dni: '',
        fecha_nacimiento: '',
        estado_civil: '',
        numero_hijos: 0,
        direccion: '', 
        distrito: '',               
        telefono_personal: '',
        email_personal: '',
        banco: '',
        numero_cuenta_bancaria: '',
        cci_cuenta_bancaria: '',
        cuenta_bancaria_otros: '', 
        id_referidor: '', 
        fecha_ingreso: new Date().toISOString().split('T')[0],
        tipo_asesor_actual: 'Junior',
        fecha_cambio_socio: '', 
        observaciones_asesor: '',
        activo: true,
    }), []);

    const [formData, setFormData] = useState(getInitialFormData());
    const [internalFormError, setInternalFormError] = useState('');
    const [errorsByField, setErrorsByField] = useState({});

    const referidorOptions = asesoresList?.filter(a => !initialData || a.id_asesor !== initialData.id_asesor) || [];

    useEffect(() => {
        if (show) {
            setInternalFormError('');
            setErrorsByField({});
            if (clearExternalError) clearExternalError();

            if (initialData && initialData.id_asesor) {
                setFormData({
                    nombre_asesor: initialData.nombre_asesor || '',
                    dni: initialData.dni || '',
                    fecha_nacimiento: initialData.fecha_nacimiento ? initialData.fecha_nacimiento.split('T')[0] : '',
                    estado_civil: initialData.estado_civil || '',
                    numero_hijos: initialData.numero_hijos !== null && initialData.numero_hijos !== undefined ? initialData.numero_hijos : 0,
                    direccion: initialData.direccion_domiciliaria || initialData.direccion || '', // Priorizar direccion_domiciliaria si existe
                    distrito: initialData.distrito || '',   
                    telefono_personal: initialData.telefono_personal || '',
                    email_personal: initialData.email_personal || '',
                    banco: initialData.banco || '',
                    numero_cuenta_bancaria: initialData.numero_cuenta_bancaria || '',
                    cci_cuenta_bancaria: initialData.cci_cuenta_bancaria || '',
                    cuenta_bancaria_otros: initialData.cuenta_bancaria_otros || '',
                    id_referidor: initialData.id_referidor?.id_asesor || initialData.id_referidor || '',
                    fecha_ingreso: initialData.fecha_ingreso ? initialData.fecha_ingreso.split('T')[0] : new Date().toISOString().split('T')[0],
                    tipo_asesor_actual: initialData.tipo_asesor_actual || 'Junior',
                    fecha_cambio_socio: initialData.fecha_cambio_socio ? initialData.fecha_cambio_socio.split('T')[0] : '',
                    observaciones_asesor: initialData.observaciones_asesor || '',
                    activo: initialData.activo !== undefined ? initialData.activo : true,
                });
            } else {
                setFormData(getInitialFormData());
            }
        }
    }, [initialData, show, clearExternalError, getInitialFormData]);

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ 
            ...prev, 
            [name]: type === 'checkbox' ? checked : (type === 'number' ? (value === '' ? '' : parseInt(value, 10)) : value)
        }));
        if (internalFormError) setInternalFormError('');
        if (externalError && clearExternalError) clearExternalError();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setInternalFormError('');
        setErrorsByField({});
        if (clearExternalError) clearExternalError();

        if (!formData.nombre_asesor.trim() || !formData.fecha_ingreso) {
            setInternalFormError("Nombre y Fecha de Ingreso son campos requeridos.");
            return;
        }
        if (formData.dni && formData.dni.trim() !== '' && !/^\d{8}$/.test(formData.dni)) {
             setInternalFormError('El DNI debe tener 8 dígitos numéricos.');
             return;
        }
         if (formData.email_personal && formData.email_personal.trim() !== '' && !/\S+@\S+\.\S+/.test(formData.email_personal)) {
            setInternalFormError('Ingrese un email personal válido o déjelo vacío.');
            return;
        }

        const dataToSubmit = {
            ...formData,
            id_referidor: formData.id_referidor || null, 
            fecha_cambio_socio: formData.fecha_cambio_socio || null,
            fecha_nacimiento: formData.fecha_nacimiento || null,
            numero_hijos: formData.numero_hijos === '' || formData.numero_hijos === null ? null : parseInt(formData.numero_hijos, 10),
            dni: formData.dni || null,
            estado_civil: formData.estado_civil || null,
            // Asegurar que el nombre del campo de dirección coincida con el modelo/serializer
            direccion_domiciliaria: formData.direccion || null, // O formData.direccion_domiciliaria
            distrito: formData.distrito || null,
            telefono_personal: formData.telefono_personal || null,
            email_personal: formData.email_personal || null,
            banco: formData.banco || null,
            numero_cuenta_bancaria: formData.numero_cuenta_bancaria || null,
            cci_cuenta_bancaria: formData.cci_cuenta_bancaria || null,
            observaciones_asesor: formData.observaciones_asesor || null,
            cuenta_bancaria_otros: formData.cuenta_bancaria_otros || null,
        };
        // Eliminar 'direccion' si 'direccion_domiciliaria' es el campo correcto para el backend
        if ('direccion_domiciliaria' in dataToSubmit && dataToSubmit.direccion_domiciliaria === formData.direccion) {
            delete dataToSubmit.direccion; 
        }
        
        try {
            onSubmit(dataToSubmit);
        } catch (err) {
            let fieldErrors = {};
            let msg = 'Error al guardar el asesor.';
            if (err?.response?.data && typeof err.response.data === 'object') {
                Object.entries(err.response.data).forEach(([k, v]) => {
                    if (Array.isArray(v)) fieldErrors[k] = v.join(' ');
                    else fieldErrors[k] = v;
                });
                msg = Object.values(fieldErrors).join('; ');
            } else if (err?.message) {
                msg = err.message;
            }
            setInternalFormError(msg);
            setErrorsByField(fieldErrors);
        }
    };

    return (
        <div className={formBaseStyles.modalOverlay}>
            <div className={`${formBaseStyles.modalContent} ${styles.asesorFormModalContent || ''}`}>
                <h2>{initialData?.id_asesor ? 'Editar Asesor' : 'Registrar Nuevo Asesor'}</h2>
                {(internalFormError || externalError) && <p className={formBaseStyles.errorMessageForm}>{internalFormError || externalError}</p>}
                
                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}> 
                        
                        <div className={styles.formGroupSpanFull}>
                            <h3 className={formBaseStyles.subHeader}>Datos Personales</h3>
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="nombre_asesor">Nombre Completo <span className={formBaseStyles.required}>*</span></label>
                            <input type="text" id="nombre_asesor" name="nombre_asesor" value={formData.nombre_asesor} onChange={handleChange} required />
                            {errorsByField['nombre_asesor'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['nombre_asesor']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="dni">DNI</label>
                            <input type="text" id="dni" name="dni" value={formData.dni} onChange={handleChange} maxLength="8" />
                            {errorsByField['dni'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['dni']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="fecha_nacimiento">Fecha de Nacimiento</label>
                            <input type="date" id="fecha_nacimiento" name="fecha_nacimiento" value={formData.fecha_nacimiento} onChange={handleChange} />
                            {errorsByField['fecha_nacimiento'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['fecha_nacimiento']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="estado_civil">Estado Civil</label>
                            <select id="estado_civil" name="estado_civil" value={formData.estado_civil} onChange={handleChange}>
                                {ESTADO_CIVIL_ASESOR_CHOICES.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}
                            </select>
                            {errorsByField['estado_civil'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['estado_civil']}</div>}
                        </div>
                         <div className={formBaseStyles.formGroup}>
                            <label htmlFor="numero_hijos">N° de Hijos</label>
                            <input type="number" id="numero_hijos" name="numero_hijos" value={formData.numero_hijos} onChange={handleChange} min="0" />
                            {errorsByField['numero_hijos'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['numero_hijos']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="telefono_personal">Teléfono Personal</label>
                            <input type="tel" id="telefono_personal" name="telefono_personal" value={formData.telefono_personal} onChange={handleChange} />
                            {errorsByField['telefono_personal'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['telefono_personal']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="email_personal">Email Personal</label>
                            <input type="email" id="email_personal" name="email_personal" value={formData.email_personal} onChange={handleChange} />
                            {errorsByField['email_personal'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['email_personal']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}> {/* Dirección */}
                            <label htmlFor="direccion">Dirección Domiciliaria</label>
                            <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} />
                            {errorsByField['direccion'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['direccion']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}> {/* Distrito */}
                            <label htmlFor="distrito">Distrito</label>
                            <input type="text" id="distrito" name="distrito" value={formData.distrito} onChange={handleChange} />
                            {errorsByField['distrito'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['distrito']}</div>}
                        </div>

                        <div className={styles.formGroupSpanFull}>
                            <h3 className={formBaseStyles.subHeader}>Datos Laborales</h3>
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="fecha_ingreso">Fecha de Ingreso <span className={formBaseStyles.required}>*</span></label>
                            <input type="date" id="fecha_ingreso" name="fecha_ingreso" value={formData.fecha_ingreso} onChange={handleChange} required />
                            {errorsByField['fecha_ingreso'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['fecha_ingreso']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="id_referidor">Asesor Referidor (Líder)</label>
                            <select id="id_referidor" name="id_referidor" value={formData.id_referidor} onChange={handleChange}>
                                <option value="">Ninguno</option>
                                {referidorOptions.map(asesor => (<option key={asesor.id_asesor} value={asesor.id_asesor}>{asesor.nombre_asesor} ({asesor.id_asesor})</option>))}
                            </select>
                            {errorsByField['id_referidor'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['id_referidor']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="fecha_cambio_socio">Fecha Cambio a Socio</label>
                            <input type="date" id="fecha_cambio_socio" name="fecha_cambio_socio" value={formData.fecha_cambio_socio} onChange={handleChange} />
                            {errorsByField['fecha_cambio_socio'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['fecha_cambio_socio']}</div>}
                        </div>

                        <div className={styles.formGroupSpanFull}>
                            <h3 className={formBaseStyles.subHeader}>Datos Bancarios</h3>
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="banco">Banco Principal</label>
                            <select id="banco" name="banco" value={formData.banco} onChange={handleChange}>
                                {/* CORRECCIÓN: Usar una variable consistente para el map, ej. 'option' o 'opt' */}
                                {BANCO_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                            </select>
                            {errorsByField['banco'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['banco']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="numero_cuenta_bancaria">Número de Cuenta</label>
                            <input type="text" id="numero_cuenta_bancaria" name="numero_cuenta_bancaria" value={formData.numero_cuenta_bancaria} onChange={handleChange} />
                            {errorsByField['numero_cuenta_bancaria'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['numero_cuenta_bancaria']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="cci_cuenta_bancaria">CCI de Cuenta</label>
                            <input type="text" id="cci_cuenta_bancaria" name="cci_cuenta_bancaria" value={formData.cci_cuenta_bancaria} onChange={handleChange} />
                            {errorsByField['cci_cuenta_bancaria'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['cci_cuenta_bancaria']}</div>}
                        </div>
                        <div className={`${formBaseStyles.formGroup} ${styles.formGroupSpanFull}`}>
                            <label htmlFor="cuenta_bancaria_otros">Otras Cuentas / Detalles Adicionales</label>
                            <textarea id="cuenta_bancaria_otros" name="cuenta_bancaria_otros" value={formData.cuenta_bancaria_otros} onChange={handleChange} rows="2"></textarea>
                            {errorsByField['cuenta_bancaria_otros'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['cuenta_bancaria_otros']}</div>}
                        </div>
                        
                        <div className={`${formBaseStyles.formGroup} ${styles.formGroupSpanFull}`}>
                            <label htmlFor="observaciones_asesor">Observaciones Generales del Asesor</label>
                            <textarea id="observaciones_asesor" name="observaciones_asesor" value={formData.observaciones_asesor} onChange={handleChange} rows="3"></textarea>
                            {errorsByField['observaciones_asesor'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['observaciones_asesor']}</div>}
                        </div>

                    </div> {/* Fin de formGrid */}

                    <div className={`${formBaseStyles.formActions} ${styles.formGroupSpanFull}`}>
                        <button type="submit" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`}>
                            {initialData?.id_asesor ? 'Actualizar Asesor' : 'Guardar Asesor'}
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

export default AsesorForm;