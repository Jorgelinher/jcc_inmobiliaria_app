// src/components/forms/PresenciaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../../services/apiService';
import formBaseStyles from './FormStyles.module.css'; // Estilos base para todos los formularios
import styles from './PresenciaForm.module.css'; // Estilos específicos para PresenciaForm
import VentaForm from './VentaForm';
import ClienteForm from './ClienteForm';
import LoteSelector from '../ui/LoteSelector';
import ClienteSearch from '../ui/ClienteSearch';
import AsesorAutocomplete from '../ui/AsesorAutocomplete';
import Loader from '../ui/Loader';

const MEDIO_CAPTACION_CHOICES = [
    { value: 'campo_opc', label: 'Campo OPC' }, { value: 'redes_facebook', label: 'Redes Facebook' },
    { value: 'redes_instagram', label: 'Redes Instagram' }, { value: 'redes_tiktok', label: 'Redes TikTok' },
    { value: 'referido', label: 'Referido' }, { value: 'web', label: 'Página Web' }, { value: 'otro', label: 'Otro' },
];
const MODALIDAD_PRESENCIA_CHOICES = [ { value: 'presencial', label: 'Presencial' }, { value: 'virtual', label: 'Virtual' }];
const STATUS_PRESENCIA_CHOICES = [
    { value: 'agendada', label: 'Agendada' }, { value: 'realizada', label: 'Realizada' },
    { value: 'reprogramada', label: 'Reprogramada' }, { value: 'cancelada_cliente', label: 'Cancelada por Cliente' },
    { value: 'no_asistio', label: 'No Asistió' }, { value: 'caida_proceso', label: 'Caída en Proceso' },
];
const RESULTADO_INTERACCION_CHOICES = [
    { value: '', label: 'Seleccione Resultado'},
    { value: 'interesado_seguimiento', label: 'Interesado - Programar Seguimiento' },
    { value: 'interesado_separacion', label: 'Interesado - Realizó Separación' },
    { value: 'interesado_venta_directa', label: 'Interesado - Venta Directa' },
    { value: 'no_interesado_objecion', label: 'No Interesado - Objeción' },
    { value: 'no_interesado_precio', label: 'No Interesado - Precio' },
    { value: 'no_interesado_otro', label: 'No Interesado - Otro' },
];
const TIPO_TOUR_CHOICES = [
    { value: 'tour', label: 'Tour (Presencia Real)' },
    { value: 'no_tour', label: 'No Tour (Cita Confirmada, No Presencia)' },
];

function PresenciaForm({ show, onClose, onSubmit, initialData }) {
    const getInitialFormState = useCallback(() => ({
        cliente: '',
        fecha_hora_presencia: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16),
        proyecto_interes: '',
        lote_interes_inicial: '', 
        lote_interes_display_text: '', 
        asesor_captacion_opc: '',
        medio_captacion: MEDIO_CAPTACION_CHOICES[0]?.value || '',
        asesor_call_agenda: '',
        asesor_liner: '',
        asesor_closer: '',
        modalidad: MODALIDAD_PRESENCIA_CHOICES[0]?.value || '',
        status_presencia: 'agendada',
        resultado_interaccion: '',
        venta_asociada: '', 
        observaciones: '',
        tipo_tour: 'tour',
    }), []);

    const [formData, setFormData] = useState(getInitialFormState());
    const [clientesList, setClientesList] = useState([]);
    const [asesoresList, setAsesoresList] = useState([]);
    const [ventasList, setVentasList] = useState([]); 
    const [loadingRelatedData, setLoadingRelatedData] = useState(false);
    const [formError, setFormError] = useState('');
    const [crearNuevaVenta, setCrearNuevaVenta] = useState(false);
    const [isVentaModalOpen, setIsVentaModalOpen] = useState(false);
    const [nuevaVentaData, setNuevaVentaData] = useState(null); 
    const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
    const [clienteFormError, setClienteFormError] = useState('');
    const [isLoteSelectorModalOpen, setIsLoteSelectorModalOpen] = useState(false);
    const [selectedClienteInfo, setSelectedClienteInfo] = useState(null);
    const [internalFormError, setInternalFormError] = useState('');
    const [errorsByField, setErrorsByField] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const fetchDropdownData = useCallback(async () => {
        setLoadingRelatedData(true);
        setFormError(''); // Limpiar error previo
        try {
            console.log("[PresenciaForm] Fetching dropdown data (asesores, ventas)...");
            const [asesoresRes, ventasRes] = await Promise.all([
                apiService.getAsesores('page_size=1000'),
                // --- CAMBIO TEMPORAL PARA DEPURACIÓN: Fetch todas las ventas o un conjunto más amplio ---
                // apiService.getVentas("status_venta=separacion&status_venta=procesable") // Original
                apiService.getVentas() // Prueba sin filtro de estado o con un filtro menos restrictivo
                                      // Ejemplo: "status_venta__in=separacion,procesable" si tu backend lo soporta,
                                      // o simplemente "" para traer todas y filtrar en frontend si son pocas.
            ]);
            
            console.log("[PresenciaForm] Asesores response:", asesoresRes.data);
            setAsesoresList(asesoresRes.data.results || asesoresRes.data || []);
            
            console.log("[PresenciaForm] Ventas response (para dropdown 'venta_asociada'):", ventasRes.data);
            const fetchedVentas = ventasRes.data.results || ventasRes.data || [];
            setVentasList(fetchedVentas);

            if (fetchedVentas.length === 0) {
                console.warn("[PresenciaForm] No se recibieron ventas para el dropdown 'venta_asociada'.");
            }

        } catch (error) {
            console.error("[PresenciaForm] Error cargando datos para selects (asesores/ventas):", error);
            setFormError("Error cargando datos necesarios para el formulario.");
        } finally {
            setLoadingRelatedData(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            fetchDropdownData();
            setFormError('');
            setClienteFormError('');
            setCrearNuevaVenta(false);
            setNuevaVentaData(null);
        }
    }, [show, fetchDropdownData]);

    useEffect(() => {
        if (show) {
            if (initialData && initialData.id_presencia) {
                const loteInteresId = initialData.lote_interes_inicial?.id_lote || initialData.lote_interes_inicial;
                setFormData({
                    ...getInitialFormState(), 
                    ...initialData,
                    cliente: initialData.cliente?.id_cliente || initialData.cliente || '',
                    fecha_hora_presencia: initialData.fecha_hora_presencia ? new Date(new Date(initialData.fecha_hora_presencia).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : getInitialFormState().fecha_hora_presencia,
                    lote_interes_inicial: loteInteresId || '',
                    lote_interes_display_text: initialData.lote_interes_inicial_id_str || (loteInteresId ? `Cargando Lote ${loteInteresId}...` : ''),
                    asesor_captacion_opc: initialData.asesor_captacion_opc?.id_asesor || initialData.asesor_captacion_opc || '',
                    asesor_call_agenda: initialData.asesor_call_agenda?.id_asesor || initialData.asesor_call_agenda || '',
                    asesor_liner: initialData.asesor_liner?.id_asesor || initialData.asesor_liner || '',
                    asesor_closer: initialData.asesor_closer?.id_asesor || initialData.asesor_closer || '',
                    venta_asociada: initialData.venta_asociada?.id_venta || initialData.venta_asociada || '',
                    tipo_tour: initialData.tipo_tour || 'tour',
                    // Los campos como medio_captacion, modalidad, status_presencia, etc., ya se toman de initialData si existen
                });

                if (loteInteresId && !initialData.lote_interes_inicial_id_str) {
                    apiService.getLoteById(loteInteresId)
                        .then(res => {
                            if (res.data) {
                                setFormData(prev => ({...prev, lote_interes_display_text: `${res.data.id_lote} (${res.data.ubicacion_proyecto} Mz:${res.data.manzana || 'S/M'} Lt:${res.data.numero_lote || 'S/N'})` }));
                            }
                        })
                        .catch(err => {
                            console.error("Error fetching initial lote_interes_inicial details", err);
                            setFormData(prev => ({...prev, lote_interes_display_text: 'Error al cargar lote'}));
                        });
                }
            } else {
                setFormData(getInitialFormState());
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, show, getInitialFormState]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormError('');
        if (name === "crearNuevaVenta") {
            setCrearNuevaVenta(checked);
            if (checked) {
                setFormData(prev => ({ ...prev, venta_asociada: '' }));
                setNuevaVentaData(null);
                setIsVentaModalOpen(true);
            } else {
                setIsVentaModalOpen(false);
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
        }
    };

    const handleClienteSelect = (cliente) => {
        console.log("[PresenciaForm] Cliente seleccionado:", cliente);
        setFormData(prev => ({ ...prev, cliente: cliente.id_cliente }));
    };

    const handleClienteSearchChange = (clienteId) => {
        if (clienteId === '_CREAR_NUEVO_') {
            setClienteFormError('');
            setIsClienteModalOpen(true);
        } else {
            setFormData(prev => ({ ...prev, cliente: clienteId }));
        }
    };

    const handleLoteInteresSelected = (lote) => {
        console.log("[PresenciaForm] Lote de interés seleccionado:", lote);
        if (lote) {
            setFormData(prev => ({
                ...prev,
                lote_interes_inicial: lote.id_lote,
                lote_interes_display_text: `${lote.id_lote} (${lote.ubicacion_proyecto} Mz:${lote.manzana || 'S/M'} Lt:${lote.numero_lote || 'S/N'})`
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                lote_interes_inicial: '',
                lote_interes_display_text: ''
            }));
        }
        setIsLoteSelectorModalOpen(false);
    };

    const handleClienteFormSubmit = async (clienteDataDelModal) => {
        // ... (lógica como estaba) ...
        setClienteFormError('');
        try {
            const response = await apiService.createCliente(clienteDataDelModal);
            const nuevoCliente = response.data;
            alert(`Cliente "${nuevoCliente.nombres_completos_razon_social}" creado con ID: ${nuevoCliente.id_cliente}`);
            setFormData(prev => ({ ...prev, cliente: nuevoCliente.id_cliente }));
            setSelectedClienteInfo({
                id_cliente: nuevoCliente.id_cliente,
                nombres_completos_razon_social: nuevoCliente.nombres_completos_razon_social,
                telefono_principal: nuevoCliente.telefono_principal,
                display_text: `${nuevoCliente.nombres_completos_razon_social} (${nuevoCliente.telefono_principal || 'Sin teléfono'})`
            });
            setIsClienteModalOpen(false);
        } catch (err) {
            console.error("[PresenciaForm] Error al crear cliente:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al crear cliente.";
            if (errorData) {
                if (typeof errorData === 'string') {
                    errorMsg = errorData;
                } else if (errorData.error) {
                    errorMsg = errorData.error;
                } else if (errorData.detail) {
                    errorMsg = errorData.detail;
                } else if (errorData.errors) {
                    const errorFields = Object.keys(errorData.errors);
                    errorMsg = `Errores en campos: ${errorFields.join(', ')}`;
                }
            }
            setClienteFormError(errorMsg);
        }
    };

    const handleVentaFormSubmit = async (ventaFormDataFromModal) => {
        // ... (lógica como estaba) ...
        setFormError('');
        try {
            console.log("[PresenciaForm] Creando nueva venta desde modal:", ventaFormDataFromModal);
            const response = await apiService.createVenta(ventaFormDataFromModal);
            const nuevaVenta = response.data;
            console.log("[PresenciaForm] Nueva venta creada:", nuevaVenta);
            
            alert(`Venta "${nuevaVenta.id_venta}" creada exitosamente para cliente "${nuevaVenta.cliente_detalle?.nombres_completos_razon_social || 'Cliente'}"`);
            
            setNuevaVentaData(nuevaVenta);
            setFormData(prev => ({ ...prev, venta_asociada: nuevaVenta.id_venta }));
            setIsVentaModalOpen(false);
            setCrearNuevaVenta(false);
            
            // Actualizar lista de ventas
            setVentasList(prevList => [nuevaVenta, ...prevList]);
            
        } catch (err) {
            console.error("[PresenciaForm] Error al crear venta:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al crear venta.";
            if (errorData) {
                if (typeof errorData === 'string') {
                    errorMsg = errorData;
                } else if (errorData.error) {
                    errorMsg = errorData.error;
                } else if (errorData.detail) {
                    errorMsg = errorData.detail;
                } else if (errorData.errors) {
                    const errorFields = Object.keys(errorData.errors);
                    errorMsg = `Errores en campos: ${errorFields.join(', ')}`;
                }
            }
            setFormError(errorMsg);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setInternalFormError('');
        setErrorsByField({});
        if (formError) setFormError(''); // Limpiar error general si hay uno
        if (clienteFormError) setClienteFormError(''); // Limpiar error de cliente si hay uno
        
        if (!formData.cliente) {
            setInternalFormError('Debe seleccionar un cliente.');
            setErrorsByField({ cliente: 'Debe seleccionar un cliente.' });
            return;
        }

        if (!formData.fecha_hora_presencia) {
            setInternalFormError('Debe especificar fecha y hora de presencia.');
            setErrorsByField({ fecha_hora_presencia: 'Debe especificar fecha y hora de presencia.' });
            return;
        }

        if (!formData.proyecto_interes) {
            setInternalFormError('Debe especificar el proyecto de interés.');
            setErrorsByField({ proyecto_interes: 'Debe especificar el proyecto de interés.' });
            return;
        }

        if (!formData.medio_captacion) {
            setInternalFormError('Debe especificar el medio de captación.');
            setErrorsByField({ medio_captacion: 'Debe especificar el medio de captación.' });
            return;
        }

        if (!formData.modalidad) {
            setInternalFormError('Debe especificar la modalidad.');
            setErrorsByField({ modalidad: 'Debe especificar la modalidad.' });
            return;
        }

        if (!formData.status_presencia) {
            setInternalFormError('Debe especificar el estado de la presencia.');
            setErrorsByField({ status_presencia: 'Debe especificar el estado de la presencia.' });
            return;
        }

        const ventaAsociadaId = crearNuevaVenta && nuevaVentaData ? nuevaVentaData.id_venta : formData.venta_asociada;

        const dataToSubmit = {
            cliente: formData.cliente,
            fecha_hora_presencia: formData.fecha_hora_presencia,
            proyecto_interes: formData.proyecto_interes,
            lote_interes_inicial: formData.lote_interes_inicial || null,
            asesor_captacion_opc: formData.asesor_captacion_opc || null,
            medio_captacion: formData.medio_captacion,
            asesor_call_agenda: formData.asesor_call_agenda || null,
            asesor_liner: formData.asesor_liner || null,
            asesor_closer: formData.asesor_closer || null,
            modalidad: formData.modalidad,
            status_presencia: formData.status_presencia,
            resultado_interaccion: formData.resultado_interaccion || null,
            venta_asociada: ventaAsociadaId || null,
            observaciones: formData.observaciones,
            tipo_tour: formData.tipo_tour,
        };
        // No es necesario enviar lote_interes_display_text
        
        console.log("[PresenciaForm] Datos finales a enviar (dataToSubmit):", dataToSubmit);
        try {
            onSubmit(dataToSubmit, initialData?.id_presencia);
        } catch (err) {
            let fieldErrors = {};
            let msg = 'Error al guardar la presencia.';
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

    if (!show) return null;

    return (
        <>
            <div className={formBaseStyles.modalOverlay}>
                <div className={`${formBaseStyles.modalContent} ${styles.presenciaFormModalContent}`}>
                    <h2>{initialData?.id_presencia ? 'Editar Presencia' : 'Registrar Nueva Presencia'}</h2>
                    {loadingRelatedData && <p className={formBaseStyles.loadingText}>Cargando datos...</p>}
                    {formError && <p className={formBaseStyles.errorMessageForm}>{formError}</p>}
                    {internalFormError && <p className={formBaseStyles.errorMessageForm}>{internalFormError}</p>}
                    {isLoading && <Loader label="Guardando presencia..." />}

                    {!loadingRelatedData && (
                        <form onSubmit={handleSubmit}>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup} style={{flex: 1.5}}>
                                    <label htmlFor="cliente">Cliente <span className={formBaseStyles.required}>*</span></label>
                                    <ClienteSearch
                                        value={formData.cliente}
                                        onChange={handleClienteSearchChange}
                                        onClienteSelect={handleClienteSelect}
                                        placeholder="Buscar cliente por nombre, teléfono o DNI..."
                                        required={true}
                                        showCreateOption={true}
                                        context="presencias"
                                    />
                                    {errorsByField['cliente'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['cliente']}</div>}
                                    {clienteFormError && <div className={formBaseStyles.errorMessageField}>{clienteFormError}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup} style={{flex: 1}}>
                                    <label htmlFor="fecha_hora_presencia">Fecha y Hora Presencia <span className={formBaseStyles.required}>*</span></label>
                                    <input type="datetime-local" id="fecha_hora_presencia" name="fecha_hora_presencia" value={formData.fecha_hora_presencia} onChange={handleChange} required />
                                    {errorsByField['fecha_hora_presencia'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['fecha_hora_presencia']}</div>}
                                </div>
                            </div>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup} style={{flex: 2}}>
                                    <label htmlFor="proyecto_interes">Proyecto de Interés <span className={formBaseStyles.required}>*</span></label>
                                    <input type="text" id="proyecto_interes" name="proyecto_interes" value={formData.proyecto_interes} onChange={handleChange} required />
                                    {errorsByField['proyecto_interes'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['proyecto_interes']}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup} style={{flex: 3}}>
                                    <label htmlFor="lote_interes_display_text">Lote de Interés Inicial</label>
                                    <div className={formBaseStyles.inputWithButton}>
                                        <input
                                            type="text"
                                            id="lote_interes_display_text"
                                            value={formData.lote_interes_display_text}
                                            readOnly
                                            placeholder="Seleccione un lote (opcional)..."
                                            className={`${formBaseStyles.readOnlyInput} ${formBaseStyles.loteDisplayInput}`}
                                            onClick={() => setIsLoteSelectorModalOpen(true)}
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setIsLoteSelectorModalOpen(true)}
                                            className={formBaseStyles.selectButton}
                                        >
                                            {formData.lote_interes_inicial ? 'Cambiar' : 'Seleccionar'}
                                        </button>
                                    </div>
                                    {errorsByField['lote_interes_inicial'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['lote_interes_inicial']}</div>}
                                </div>
                            </div>
                            
                            <hr className={formBaseStyles.formSeparator}/>
                            <h3 className={formBaseStyles.subHeader}>Asesores Involucrados</h3>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="medio_captacion">Medio de Captación <span className={formBaseStyles.required}>*</span></label>
                                    <select id="medio_captacion" name="medio_captacion" value={formData.medio_captacion} onChange={handleChange} required>
                                        {MEDIO_CAPTACION_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    {errorsByField['medio_captacion'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['medio_captacion']}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_captacion_opc">Asesor Captación (OPC/Redes)</label>
                                    <AsesorAutocomplete
                                        value={formData.asesor_captacion_opc}
                                        onChange={(value) => setFormData(prev => ({ ...prev, asesor_captacion_opc: value }))}
                                        placeholder="Buscar asesor captación..."
                                        name="asesor_captacion_opc"
                                        asesoresList={asesoresList}
                                    />
                                    {errorsByField['asesor_captacion_opc'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['asesor_captacion_opc']}</div>}
                                </div>
                            </div>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_call_agenda">Asesor Call (Agendó)</label>
                                    <AsesorAutocomplete
                                        value={formData.asesor_call_agenda}
                                        onChange={(value) => setFormData(prev => ({ ...prev, asesor_call_agenda: value }))}
                                        placeholder="Buscar asesor call..."
                                        name="asesor_call_agenda"
                                        asesoresList={asesoresList}
                                    />
                                    {errorsByField['asesor_call_agenda'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['asesor_call_agenda']}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_liner">Asesor Liner (Presentación)</label>
                                    <AsesorAutocomplete
                                        value={formData.asesor_liner}
                                        onChange={(value) => setFormData(prev => ({ ...prev, asesor_liner: value }))}
                                        placeholder="Buscar asesor liner..."
                                        name="asesor_liner"
                                        asesoresList={asesoresList}
                                    />
                                    {errorsByField['asesor_liner'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['asesor_liner']}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_closer">Asesor Closer (Cierre)</label>
                                    <AsesorAutocomplete
                                        value={formData.asesor_closer}
                                        onChange={(value) => setFormData(prev => ({ ...prev, asesor_closer: value }))}
                                        placeholder="Buscar asesor closer..."
                                        name="asesor_closer"
                                        asesoresList={asesoresList}
                                    />
                                    {errorsByField['asesor_closer'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['asesor_closer']}</div>}
                                </div>
                            </div>

                            <hr className={formBaseStyles.formSeparator}/>
                            <h3 className={formBaseStyles.subHeader}>Resultado de la Presencia</h3>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="modalidad">Modalidad <span className={formBaseStyles.required}>*</span></label>
                                    <select id="modalidad" name="modalidad" value={formData.modalidad} onChange={handleChange} required>
                                        {MODALIDAD_PRESENCIA_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    {errorsByField['modalidad'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['modalidad']}</div>}
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="status_presencia" aria-label="Estado de la presencia" title="Estado actual de la presencia">Estado</label>
                                    <select id="status_presencia" name="status_presencia" value={formData.status_presencia} onChange={handleChange} required>
                                        {STATUS_PRESENCIA_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                    {errorsByField['status_presencia'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['status_presencia']}</div>}
                                </div>
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="tipo_tour">Tipo de Presencia <span className={formBaseStyles.required}>*</span></label>
                                <select id="tipo_tour" name="tipo_tour" value={formData.tipo_tour} onChange={handleChange} required>
                                    {TIPO_TOUR_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                {errorsByField['tipo_tour'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['tipo_tour']}</div>}
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="resultado_interaccion">Resultado de la Interacción</label>
                                <select id="resultado_interaccion" name="resultado_interaccion" value={formData.resultado_interaccion} onChange={handleChange}>
                                    {RESULTADO_INTERACCION_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
                                {errorsByField['resultado_interaccion'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['resultado_interaccion']}</div>}
                            </div>
                            
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="venta_asociada">Venta Asociada</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <select 
                                        id="venta_asociada" name="venta_asociada" value={formData.venta_asociada} 
                                        onChange={handleChange} disabled={crearNuevaVenta} style={{ flexGrow: 1 }}
                                    >
                                        <option value="">Ninguna existente</option>
                                        {ventasList.map(v => (<option key={v.id_venta} value={v.id_venta}>{v.id_venta} (Cliente: {v.cliente_detalle?.nombres_completos_razon_social || v.cliente_info || v.cliente}, Lote: {v.lote_info || v.lote})</option>))}
                                    </select>
                                    <label htmlFor="crearNuevaVenta" style={{display: 'flex', alignItems: 'center', marginBottom: 0, fontSize: '0.9em', whiteSpace: 'nowrap'}}>
                                        <input type="checkbox" id="crearNuevaVenta" name="crearNuevaVenta"
                                            checked={crearNuevaVenta} onChange={handleChange}
                                            style={{marginRight: '5px', width: 'auto'}}
                                        />
                                        Crear Nueva Venta
                                    </label>
                                </div>
                                {errorsByField['venta_asociada'] && <div className={formBaseStyles.errorMessageField}>{errorsByField['venta_asociada']}</div>}
                            </div>

                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="observaciones">Observaciones</label>
                                <textarea id="observaciones" name="observaciones" value={formData.observaciones} onChange={handleChange} rows="3"></textarea>
                            </div>

                            <div className={formBaseStyles.formActions}>
                                <button type="submit" aria-label="Guardar presencia" title="Guardar presencia" role="button" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`} disabled={loadingRelatedData}>
                                    {initialData?.id_presencia ? 'Actualizar Presencia' : 'Guardar Presencia'}
                                </button>
                                <button type="button" onClick={onClose} className={`${formBaseStyles.button} ${formBaseStyles.buttonSecondary}`}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <ClienteForm
                show={isClienteModalOpen}
                onClose={() => { setIsClienteModalOpen(false); if (formData.cliente === "_CREAR_NUEVO_") setFormData(prev => ({ ...prev, cliente: '' })); }}
                onSubmit={handleClienteFormSubmit}
                formError={clienteFormError}
                clearExternalError={() => setClienteFormError('')}
            />

            {isVentaModalOpen && (
                <VentaForm
                    show={isVentaModalOpen}
                    onClose={() => { setIsVentaModalOpen(false); if (!nuevaVentaData) { setCrearNuevaVenta(false); }}}
                    onSubmit={handleVentaFormSubmit}
                    isModalForPresencia={true}
                    clientePredefinidoPresencia={formData.cliente}
                    initialData={{ 
                        lote: formData.lote_interes_inicial,
                        lote_info: formData.lote_interes_display_text, // Pasar el display text
                    }}
                    asesoresInvolucradosPresencia={[
                        formData.asesor_captacion_opc ? { asesor: formData.asesor_captacion_opc, rol: 'captacion_opc' } : null,
                        formData.asesor_call_agenda ? { asesor: formData.asesor_call_agenda, rol: 'call' } : null,
                        formData.asesor_liner ? { asesor: formData.asesor_liner, rol: 'liner' } : null,
                        formData.asesor_closer ? { asesor: formData.asesor_closer, rol: 'closer' } : null,
                    ].filter(Boolean)}
                />
            )}

            <LoteSelector
                show={isLoteSelectorModalOpen}
                onClose={() => setIsLoteSelectorModalOpen(false)}
                onLoteSelected={handleLoteInteresSelected}
                currentLoteId={formData.lote_interes_inicial}
            />
        </>
    );
}

export default PresenciaForm;