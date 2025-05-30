// src/components/forms/PresenciaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../../services/apiService';
import formBaseStyles from './FormStyles.module.css'; // Estilos base para todos los formularios
import styles from './PresenciaForm.module.css'; // Estilos específicos para PresenciaForm
import VentaForm from './VentaForm';
import ClienteForm from './ClienteForm';
import LoteSelector from '../ui/LoteSelector';

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

    const fetchDropdownData = useCallback(async () => {
        setLoadingRelatedData(true);
        setFormError(''); // Limpiar error previo
        try {
            console.log("[PresenciaForm] Fetching dropdown data (clientes, asesores, ventas)...");
            const [clientesRes, asesoresRes, ventasRes] = await Promise.all([
                apiService.getClientes(),
                apiService.getAsesores(),
                // --- CAMBIO TEMPORAL PARA DEPURACIÓN: Fetch todas las ventas o un conjunto más amplio ---
                // apiService.getVentas("status_venta=separacion&status_venta=procesable") // Original
                apiService.getVentas() // Prueba sin filtro de estado o con un filtro menos restrictivo
                                      // Ejemplo: "status_venta__in=separacion,procesable" si tu backend lo soporta,
                                      // o simplemente "" para traer todas y filtrar en frontend si son pocas.
            ]);
            
            console.log("[PresenciaForm] Clientes response:", clientesRes.data);
            setClientesList(clientesRes.data.results || clientesRes.data || []);
            
            console.log("[PresenciaForm] Asesores response:", asesoresRes.data);
            setAsesoresList(asesoresRes.data.results || asesoresRes.data || []);
            
            console.log("[PresenciaForm] Ventas response (para dropdown 'venta_asociada'):", ventasRes.data);
            const fetchedVentas = ventasRes.data.results || ventasRes.data || [];
            setVentasList(fetchedVentas);

            if (fetchedVentas.length === 0) {
                console.warn("[PresenciaForm] No se recibieron ventas para el dropdown 'venta_asociada'.");
            }

        } catch (error) {
            console.error("[PresenciaForm] Error cargando datos para selects (clientes/asesores/ventas):", error);
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
        } else if (name === "cliente" && value === "_CREAR_NUEVO_") {
            setClienteFormError('');
            setIsClienteModalOpen(true);
        } else {
            setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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
            setClientesList(prevList => [nuevoCliente, ...prevList].sort((a,b) => a.nombres_completos_razon_social.localeCompare(b.nombres_completos_razon_social)));
            setFormData(prev => ({ ...prev, cliente: nuevoCliente.id_cliente }));
            setIsClienteModalOpen(false);
        } catch (err) {
            console.error("[PresenciaForm] Error al crear cliente:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al crear cliente.";
            if (errorData) {
                if (errorData.numero_documento) errorMsg = `N° Documento: ${errorData.numero_documento.join(', ')}`;
                else if (typeof errorData === 'string') errorMsg = errorData;
                else if (errorData.detail) errorMsg = errorData.detail;
                else if (typeof errorData === 'object') errorMsg = Object.values(errorData).flat().join('; ');
            }
            setClienteFormError(errorMsg);
        }
    };
    
    const handleVentaFormSubmit = async (ventaFormDataFromModal) => {
        // ... (lógica como estaba) ...
        setFormError(''); 
        if (!formData.cliente) {
            alert("Por favor, primero seleccione o cree un cliente para la presencia antes de asociar una venta.");
            setIsVentaModalOpen(false); 
            setCrearNuevaVenta(false);  
            return;
        }
        try {
            const ventaPrellenada = {
                ...ventaFormDataFromModal, 
                cliente: formData.cliente, 
                // El VentaForm seleccionará el lote, pero podemos pre-sugerir el lote de interés si está en el form de venta
                // y el usuario no lo ha cambiado.
            };
            console.log("[PresenciaForm] Enviando para crear venta desde presencia:", ventaPrellenada);
            const response = await apiService.createVenta(ventaPrellenada);
            const ventaCreada = response.data;
            alert('Nueva venta registrada con éxito! ID: ' + ventaCreada.id_venta);
            setNuevaVentaData(ventaCreada); 
            setFormData(prev => ({ ...prev, venta_asociada: ventaCreada.id_venta })); 
            setVentasList(prev => [ventaCreada, ...prev].sort((a,b) => (a.id_venta || '').localeCompare(b.id_venta || '')));
            setIsVentaModalOpen(false);
            setCrearNuevaVenta(true); // Mantener el checkbox marcado para indicar que se creó una venta
        } catch (err) {
            console.error("[PresenciaForm] Error al crear la venta:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al crear la venta asociada.";
            if (errorData) {
                if (typeof errorData === 'string') errorMsg = errorData;
                else if (errorData.detail) errorMsg = errorData.detail;
                else if (typeof errorData === 'object') errorMsg = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
            }
            alert(`Error al crear la venta: ${errorMsg}`);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError('');
        console.log("[PresenciaForm] Iniciando handleSubmit con formData:", formData);

        if (!formData.cliente || formData.cliente === "_CREAR_NUEVO_") {
            setFormError("Por favor, seleccione o cree un cliente.");
            return;
        }
        if (!formData.proyecto_interes || !formData.modalidad || !formData.medio_captacion || !formData.fecha_hora_presencia) {
            setFormError("Cliente, Fecha/Hora, Proyecto, Modalidad y Medio de Captación son requeridos.");
            return;
        }
        
        let ventaAsociadaId = formData.venta_asociada;
        // Si se marcó crear nueva venta Y se guardó exitosamente (nuevaVentaData tiene ID)
        if (crearNuevaVenta && nuevaVentaData && nuevaVentaData.id_venta) {
            ventaAsociadaId = nuevaVentaData.id_venta;
        } else if (crearNuevaVenta && !nuevaVentaData) {
            // Si se marcó crear pero el modal de venta se cerró sin crearla, no enviar venta_asociada
            ventaAsociadaId = null; 
        }
        
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
        };
        // No es necesario enviar lote_interes_display_text
        
        console.log("[PresenciaForm] Datos finales a enviar (dataToSubmit):", dataToSubmit);
        onSubmit(dataToSubmit, initialData?.id_presencia);
    };

    if (!show) return null;

    return (
        <>
            <div className={formBaseStyles.modalOverlay}>
                <div className={`${formBaseStyles.modalContent} ${styles.presenciaFormModalContent}`}>
                    <h2>{initialData?.id_presencia ? 'Editar Presencia' : 'Registrar Nueva Presencia'}</h2>
                    {loadingRelatedData && <p className={formBaseStyles.loadingText}>Cargando datos...</p>}
                    {formError && <p className={formBaseStyles.errorMessageForm}>{formError}</p>}

                    {!loadingRelatedData && (
                        <form onSubmit={handleSubmit}>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup} style={{flex: 1.5}}>
                                    <label htmlFor="cliente">Cliente <span className={formBaseStyles.required}>*</span></label>
                                    <select id="cliente" name="cliente" value={formData.cliente} onChange={handleChange} required>
                                        <option value="">Seleccione Cliente</option>
                                        <option value="_CREAR_NUEVO_">--- Crear Nuevo Cliente ---</option>
                                        {clientesList.map(c => (<option key={c.id_cliente} value={c.id_cliente}>{c.nombres_completos_razon_social} ({c.numero_documento})</option>))}
                                    </select>
                                </div>
                                <div className={formBaseStyles.formGroup} style={{flex: 1}}>
                                    <label htmlFor="fecha_hora_presencia">Fecha y Hora Presencia <span className={formBaseStyles.required}>*</span></label>
                                    <input type="datetime-local" id="fecha_hora_presencia" name="fecha_hora_presencia" value={formData.fecha_hora_presencia} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup} style={{flex: 2}}>
                                    <label htmlFor="proyecto_interes">Proyecto de Interés <span className={formBaseStyles.required}>*</span></label>
                                    <input type="text" id="proyecto_interes" name="proyecto_interes" value={formData.proyecto_interes} onChange={handleChange} required />
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
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_captacion_opc">Asesor Captación (OPC/Redes)</label>
                                    <select id="asesor_captacion_opc" name="asesor_captacion_opc" value={formData.asesor_captacion_opc} onChange={handleChange}>
                                        <option value="">Seleccione Asesor</option>
                                        {asesoresList.map(a => (<option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor}</option>))}
                                    </select>
                                </div>
                            </div>
                            <div className={formBaseStyles.formRow}>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_call_agenda">Asesor Call (Agendó)</label>
                                    <select id="asesor_call_agenda" name="asesor_call_agenda" value={formData.asesor_call_agenda} onChange={handleChange}>
                                        <option value="">Seleccione Asesor</option>
                                        {asesoresList.map(a => (<option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor}</option>))}
                                    </select>
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_liner">Asesor Liner (Presentación)</label>
                                    <select id="asesor_liner" name="asesor_liner" value={formData.asesor_liner} onChange={handleChange}>
                                        <option value="">Seleccione Asesor</option>
                                        {asesoresList.map(a => (<option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor}</option>))}
                                    </select>
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="asesor_closer">Asesor Closer (Cierre)</label>
                                    <select id="asesor_closer" name="asesor_closer" value={formData.asesor_closer} onChange={handleChange}>
                                        <option value="">Seleccione Asesor</option>
                                        {asesoresList.map(a => (<option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor}</option>))}
                                    </select>
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
                                </div>
                                <div className={formBaseStyles.formGroup}>
                                    <label htmlFor="status_presencia">Estado de la Cita <span className={formBaseStyles.required}>*</span></label>
                                    <select id="status_presencia" name="status_presencia" value={formData.status_presencia} onChange={handleChange} required>
                                        {STATUS_PRESENCIA_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="resultado_interaccion">Resultado de la Interacción</label>
                                <select id="resultado_interaccion" name="resultado_interaccion" value={formData.resultado_interaccion} onChange={handleChange}>
                                    {RESULTADO_INTERACCION_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                </select>
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
                            </div>

                            <div className={formBaseStyles.formGroup}>
                                <label htmlFor="observaciones">Observaciones</label>
                                <textarea id="observaciones" name="observaciones" value={formData.observaciones} onChange={handleChange} rows="3"></textarea>
                            </div>

                            <div className={formBaseStyles.formActions}>
                                <button type="submit" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`} disabled={loadingRelatedData}>
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
                        vendedor_principal: formData.asesor_closer || formData.asesor_liner || formData.asesor_call_agenda || formData.asesor_captacion_opc || '',
                    }} 
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