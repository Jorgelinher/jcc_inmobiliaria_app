// src/components/forms/ClienteForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import formBaseStyles from './FormStyles.module.css';
import styles from './ClienteForm.module.css'; // Si tienes estilos específicos
import Loader from '../ui/Loader';

const TIPO_DOCUMENTO_CHOICES = [
    { value: 'DNI', label: 'DNI' }, { value: 'RUC', label: 'RUC' },
    { value: 'CE', label: 'Carnet de Extranjería' }, { value: 'Pasaporte', label: 'Pasaporte' },
    { value: 'Otro', label: 'Otro' },
];
const ESTADO_CIVIL_CHOICES = [
    { value: '', label: '(No especificado)'}, { value: 'Soltero(a)', label: 'Soltero(a)' },
    { value: 'Casado(a)', label: 'Casado(a)' }, { value: 'Viudo(a)', label: 'Viudo(a)' },
    { value: 'Divorciado(a)', label: 'Divorciado(a)' }, { value: 'Conviviente', label: 'Conviviente' },
];

function ClienteForm({ show, onClose, onSubmit, initialData, formError: externalError, clearExternalError }) {
    
    const getInitialFormData = useCallback(() => ({
        nombres_completos_razon_social: '',
        tipo_documento: 'DNI',
        numero_documento: '',
        email_principal: '',
        telefono_principal: '',
        telefono_secundario: '',
        direccion: '',
        estado_civil: '',
        edad: '', // NUEVO CAMPO PARA LA EDAD
        fecha_nacimiento_constitucion: '', // Se mantiene para enviar al backend, pero no es primario en UI
        distrito: '',
        provincia: '',
        departamento: '',
        profesion_ocupacion: '',
    }), []);

    const [formData, setFormData] = useState(getInitialFormData());
    const [internalFormError, setInternalFormError] = useState('');
    const [errorsByField, setErrorsByField] = useState({});

    useEffect(() => {
        if (show) {
            setInternalFormError('');
            setErrorsByField({});
            if (clearExternalError) clearExternalError();
            if (initialData) {
                let calculatedAge = '';
                if (initialData.fecha_nacimiento_constitucion) {
                    try {
                        const birthYear = new Date(initialData.fecha_nacimiento_constitucion + 'T00:00:00Z').getUTCFullYear();
                        const currentYear = new Date().getUTCFullYear();
                        const age = currentYear - birthYear;
                        if (age > 0 && age < 100) {
                            calculatedAge = age.toString();
                        }
                    } catch (e) { console.warn("No se pudo calcular la edad desde la fecha de nacimiento", e); }
                }

                setFormData({
                    nombres_completos_razon_social: initialData.nombres_completos_razon_social || '',
                    tipo_documento: initialData.tipo_documento || 'DNI',
                    numero_documento: initialData.numero_documento || '',
                    email_principal: initialData.email_principal || '',
                    telefono_principal: initialData.telefono_principal || '',
                    telefono_secundario: initialData.telefono_secundario || '',
                    direccion: initialData.direccion || '',
                    estado_civil: initialData.estado_civil || '',
                    edad: calculatedAge, // Establecer edad calculada
                    fecha_nacimiento_constitucion: initialData.fecha_nacimiento_constitucion ? initialData.fecha_nacimiento_constitucion.split('T')[0] : '',
                    distrito: initialData.distrito || '',
                    provincia: initialData.provincia || '',
                    departamento: initialData.departamento || '',
                    profesion_ocupacion: initialData.profesion_ocupacion || '',
                });
            } else {
                setFormData(getInitialFormData());
            }
        }
    }, [initialData, show, clearExternalError, getInitialFormData]);

    if (!show) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (internalFormError) setInternalFormError('');
        if (externalError && clearExternalError) clearExternalError();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setInternalFormError('');
        setErrorsByField({});
        if (clearExternalError) clearExternalError();

        // Validaciones básicas del frontend
        if (!formData.nombres_completos_razon_social.trim() || 
            !formData.numero_documento.trim() || 
            !formData.telefono_principal.trim() || 
            !formData.direccion.trim()) {
            setInternalFormError('Nombre, N° Documento, Teléfono Principal y Dirección son obligatorios.');
            return;
        }
        if (formData.email_principal && !/\S+@\S+\.\S+/.test(formData.email_principal)) {
            setInternalFormError('Por favor, ingrese un correo electrónico válido o déjelo vacío.');
            return;
        }

        let calculatedBirthDate = null;
        if (formData.edad && formData.edad.trim() !== '') {
            const age = parseInt(formData.edad, 10);
            if (isNaN(age) || age <= 0 || age >= 100) {
                setInternalFormError('Por favor, ingrese una edad válida (entre 1 y 99).');
                return;
            }
            const currentYear = new Date().getUTCFullYear();
            const birthYear = currentYear - age;
            calculatedBirthDate = `${birthYear}-01-01`; // Asumir 1ero de Enero
        } else if (formData.fecha_nacimiento_constitucion) {
            // Si el usuario ingresó una fecha directamente y no la edad
            calculatedBirthDate = formData.fecha_nacimiento_constitucion;
        }
        
        const { edad, ...dataForBackend } = formData; // Excluir 'edad' del objeto a enviar
        dataForBackend.fecha_nacimiento_constitucion = calculatedBirthDate; // Asignar la fecha calculada o la ingresada

        try {
            onSubmit(dataForBackend);
        } catch (err) {
            let fieldErrors = {};
            let msg = 'Error al guardar el cliente.';
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
            <div className={`${formBaseStyles.modalContent} ${styles.clienteModalContent || ''}`}>
                <h2>{initialData?.id_cliente ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h2>
                {(internalFormError || externalError) && <p className={formBaseStyles.errorMessageForm}>{internalFormError || externalError}</p>}
                <form onSubmit={handleSubmit}>
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="nombres_completos_razon_social">Nombres/Razón Social <span className={formBaseStyles.required}>*</span></label>
                        <input type="text" id="nombres_completos_razon_social" name="nombres_completos_razon_social" value={formData.nombres_completos_razon_social} onChange={handleChange} required />
                        {errorsByField['nombres_completos_razon_social'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['nombres_completos_razon_social']}</div>}
                    </div>

                    <div className={`${formBaseStyles.formRow} ${styles.documentoRow || ''}`}> 
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="tipo_documento">Tipo de Documento <span className={formBaseStyles.required}>*</span></label>
                            <select id="tipo_documento" name="tipo_documento" value={formData.tipo_documento} onChange={handleChange} required >
                                {TIPO_DOCUMENTO_CHOICES.map(opcion => ( <option key={opcion.value} value={opcion.value}> {opcion.label} </option> ))}
                            </select>
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="numero_documento" aria-label="Número de documento" title="Número de documento único">N° Documento</label>
                            <input type="text" id="numero_documento" name="numero_documento" value={formData.numero_documento} onChange={handleChange} required />
                            {errorsByField['numero_documento'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['numero_documento']}</div>}
                        </div>
                    </div>
                    
                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="email_principal">Email Principal</label>
                        <input type="email" id="email_principal" name="email_principal" value={formData.email_principal} onChange={handleChange} />
                    </div>

                    <div className={`${formBaseStyles.formRow} ${styles.telefonosRow || ''}`}>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="telefono_principal">Teléfono Principal <span className={formBaseStyles.required}>*</span></label>
                            <input type="tel" id="telefono_principal" name="telefono_principal" value={formData.telefono_principal} onChange={handleChange} required />
                            {errorsByField['telefono_principal'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['telefono_principal']}</div>}
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="telefono_secundario">Teléfono Secundario</label>
                            <input type="tel" id="telefono_secundario" name="telefono_secundario" value={formData.telefono_secundario} onChange={handleChange} />
                        </div>
                    </div>

                    <div className={formBaseStyles.formGroup}>
                        <label htmlFor="direccion">Dirección <span className={formBaseStyles.required}>*</span></label>
                        <input type="text" id="direccion" name="direccion" value={formData.direccion} onChange={handleChange} required />
                        {errorsByField['direccion'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['direccion']}</div>}
                    </div>
                    
                    <div className={formBaseStyles.formRow}>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="distrito">Distrito</label>
                            <input type="text" id="distrito" name="distrito" value={formData.distrito} onChange={handleChange} />
                        </div>
                        <div className={formBaseStyles.formGroup}>
                            <label htmlFor="provincia">Provincia</label>
                            <input type="text" id="provincia" name="provincia" value={formData.provincia} onChange={handleChange} />
                        </div>
                         <div className={formBaseStyles.formGroup}>
                            <label htmlFor="departamento">Departamento</label>
                            <input type="text" id="departamento" name="departamento" value={formData.departamento} onChange={handleChange} />
                        </div>
                    </div>
                    
                    <div className={formBaseStyles.formRow}>
                        {/* --- CAMPO EDAD (REEMPLAZA VISUALMENTE A FECHA DE NACIMIENTO COMO PRIMARIO) --- */}
                        <div className={formBaseStyles.formGroup} style={{flex: 0.5}}> {/* Menor espacio para edad */}
                            <label htmlFor="edad">Edad (años)</label>
                            <input 
                                type="number" 
                                id="edad" 
                                name="edad" 
                                value={formData.edad} 
                                onChange={handleChange} 
                                min="1" 
                                max="99"
                                placeholder="Ej: 30"
                            />
                        </div>
                        <div className={formBaseStyles.formGroup} style={{flex: 1.5}}> {/* Más espacio para estado civil */}
                            <label htmlFor="estado_civil">Estado Civil</label>
                            <select id="estado_civil" name="estado_civil" value={formData.estado_civil} onChange={handleChange} >
                                {ESTADO_CIVIL_CHOICES.map(opcion => ( <option key={opcion.value} value={opcion.value}> {opcion.label} </option> ))}
                            </select>
                        </div>
                    </div>
                    <div className={formBaseStyles.formRow}>
                        <div className={formBaseStyles.formGroup} style={{flex: 1.5}}>
                            <label htmlFor="profesion_ocupacion">Profesión/Ocupación</label>
                            <input type="text" id="profesion_ocupacion" name="profesion_ocupacion" value={formData.profesion_ocupacion} onChange={handleChange} />
                        </div>
                        {/* --- CAMPO FECHA DE NACIMIENTO (AHORA OPCIONAL Y MENOS PROMINENTE) --- */}
                        <div className={formBaseStyles.formGroup} style={{flex: 1}}>
                            <label htmlFor="fecha_nacimiento_constitucion">F. Nacimiento (Opcional)</label>
                            <input 
                                type="date" 
                                id="fecha_nacimiento_constitucion" 
                                name="fecha_nacimiento_constitucion" 
                                value={formData.fecha_nacimiento_constitucion} 
                                onChange={handleChange} 
                                title="Si ingresa la edad, este campo puede dejarse vacío."
                            />
                        </div>
                    </div>

                    <div className={formBaseStyles.formActions}>
                        <button type="submit" aria-label="Guardar cliente" title="Guardar cliente" role="button" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`}>
                            {initialData?.id_cliente ? 'Actualizar Cliente' : 'Guardar Cliente'}
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

export default ClienteForm;