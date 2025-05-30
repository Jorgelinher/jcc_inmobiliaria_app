// src/components/forms/VentaForm.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../../services/apiService';
import styles from './FormStyles.module.css'; // Estilos generales del formulario
import customStyles from './VentaForm.module.css'; // Estilos específicos para VentaForm si son necesarios (opcional)
import ClienteForm from './ClienteForm';
import LoteSelector from '../ui/LoteSelector'; // Asegúrate que la ruta sea correcta

const TIPO_VENTA_CHOICES = [
    { value: 'contado', label: 'Contado' },
    { value: 'credito', label: 'Crédito' },
];

const PLAN_PAGO_CREDITO_CHOICES = [
    { value: 12, label: '12 Meses' },
    { value: 24, label: '24 Meses' },
    { value: 36, label: '36 Meses' },
];

const STATUS_VENTA_CHOICES = [
    { value: 'separacion', label: 'Separación' },
    { value: 'procesable', label: 'Procesable' },
    { value: 'anulado', label: 'Anulado' },
];

const PARTICIPACION_JUNIOR_CHOICES_OPTIONS = [
    { value: 'N/A', label: 'No Aplica' },
    { value: 'opc y call', label: 'OPC y Call' },
    { value: 'opc, call y línea', label: 'OPC, Call y Línea' },
    { value: 'opc, call, front', label: 'OPC, Call, Front' },
];

const PARTICIPACION_SOCIO_CHOICES_OPTIONS = [
    { value: 'N/A', label: 'No Aplica' },
    { value: 'front', label: 'Front' },
    { value: 'cierre', label: 'Cierre' },
    { value: 'no participa', label: 'No Participa' },
];

function VentaForm({ show, onClose, onSubmit, initialData, isModalForPresencia = false, clientePredefinidoPresencia = null }) {
    const getInitialFormData = useCallback(() => ({
        fecha_venta: new Date().toISOString().split('T')[0],
        lote: '', // ID del lote
        lote_display_text: '', // Texto para mostrar del lote seleccionado
        cliente: clientePredefinidoPresencia || '',
        valor_lote_venta: '',
        tipo_venta: 'contado',
        plazo_meses_credito: 0,
        cuota_inicial_requerida: '0.00',
        status_venta: 'separacion',
        vendedor_principal: '',
        participacion_junior_venta: 'N/A',
        id_socio_participante: '',
        participacion_socio_venta: 'N/A',
        modalidad_presentacion: '',
        notas: '',
        porcentaje_comision_vendedor_principal_personalizado: '',
        porcentaje_comision_socio_personalizado: '',
    }), [clientePredefinidoPresencia]);

    const [formData, setFormData] = useState(getInitialFormData());
    const [selectedLoteDetails, setSelectedLoteDetails] = useState(null);
    const [clientesList, setClientesList] = useState([]);
    const [asesoresList, setAsesoresList] = useState([]);
    const [loadingRelatedData, setLoadingRelatedData] = useState(false);
    const [formError, setFormError] = useState('');
    const [tipoVendedorPrincipal, setTipoVendedorPrincipal] = useState(null);
    const [defaultCommissionVP, setDefaultCommissionVP] = useState(null);
    const [defaultCommissionSocio, setDefaultCommissionSocio] = useState(null);
    const [loadingCommissionVP, setLoadingCommissionVP] = useState(false);
    const [loadingCommissionSocio, setLoadingCommissionSocio] = useState(false);
    const [isClienteModalOpen, setIsClienteModalOpen] = useState(false);
    const [clienteFormError, setClienteFormError] = useState('');
    const [isLoteSelectorModalOpen, setIsLoteSelectorModalOpen] = useState(false);

    const fetchInitialDropdownData = useCallback(async () => {
        setLoadingRelatedData(true);
        try {
            const [clientesRes, asesoresRes] = await Promise.all([
                apiService.getClientes(),
                apiService.getAsesores()
            ]);
            setClientesList(clientesRes.data.results || clientesRes.data || []);
            setAsesoresList(asesoresRes.data.results || asesoresRes.data || []);
        } catch (error) {
            console.error("Error cargando datos para selects (clientes/asesores):", error);
            setFormError("Error cargando datos necesarios para el formulario.");
        } finally {
            setLoadingRelatedData(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            fetchInitialDropdownData();
            setFormError('');
            setClienteFormError('');
            // setSelectedLoteDetails(null); // No resetear aquí si initialData lo va a poblar
        }
    }, [show, fetchInitialDropdownData]);

    useEffect(() => {
        if (show) {
            if (initialData) {
                const loteId = initialData.lote?.id_lote || initialData.lote;
                const newFormData = {
                    ...getInitialFormData(),
                    ...initialData,
                    fecha_venta: initialData.fecha_venta ? initialData.fecha_venta.split('T')[0] : new Date().toISOString().split('T')[0],
                    lote: loteId || '',
                    lote_display_text: initialData.lote_info || (loteId ? `Cargando info Lote ${loteId}...` : ''),
                    cliente: clientePredefinidoPresencia || initialData.cliente?.id_cliente || initialData.cliente || '',
                    vendedor_principal: initialData.vendedor_principal?.id_asesor || initialData.vendedor_principal || '',
                    id_socio_participante: initialData.id_socio_participante?.id_asesor || initialData.id_socio_participante || '',
                    porcentaje_comision_vendedor_principal_personalizado: initialData.porcentaje_comision_vendedor_principal_personalizado?.toString() || '',
                    porcentaje_comision_socio_personalizado: initialData.porcentaje_comision_socio_personalizado?.toString() || '',
                    tipo_venta: initialData.tipo_venta || 'contado',
                    plazo_meses_credito: initialData.plazo_meses_credito === null || initialData.plazo_meses_credito === undefined ? (initialData.tipo_venta === 'credito' ? '' : 0) : initialData.plazo_meses_credito, // Si es crédito y no hay plazo, dejar vacío para selección
                    valor_lote_venta: initialData.valor_lote_venta || '', // Se recalculará, pero tener un valor inicial puede ser útil
                };
                setFormData(newFormData);

                if (loteId) {
                    console.log("[VentaForm] initialData tiene lote ID:", loteId, ". Buscando detalles...");
                    apiService.getLoteById(loteId)
                        .then(res => {
                            console.log("[VentaForm] Detalles del lote inicial cargados:", res.data);
                            setSelectedLoteDetails(res.data);
                            // Actualizar lote_display_text con datos completos si es necesario
                            if (res.data) {
                                setFormData(prev => ({...prev, lote_display_text: `${res.data.id_lote} (${res.data.ubicacion_proyecto} Mz:${res.data.manzana || 'S/M'} Lt:${res.data.numero_lote || 'S/N'})` }));
                            }
                        })
                        .catch(err => {
                            console.error("Error fetching initial selected lote details", err);
                            setFormError("No se pudieron cargar los detalles del lote inicial.");
                            setSelectedLoteDetails(null);
                            setFormData(prev => ({...prev, lote_display_text: 'Error al cargar lote'}));
                        });
                } else {
                    setSelectedLoteDetails(null);
                }

                if (asesoresList.length > 0 && newFormData.vendedor_principal) {
                    const vendedor = asesoresList.find(a => a.id_asesor === newFormData.vendedor_principal);
                    if (vendedor) setTipoVendedorPrincipal(vendedor.tipo_asesor_actual);
                }

            } else { 
                setFormData({...getInitialFormData(), cliente: clientePredefinidoPresencia || ''});
                setSelectedLoteDetails(null);
                setTipoVendedorPrincipal(null);
                setDefaultCommissionVP(null);
                setDefaultCommissionSocio(null);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData, show, clientePredefinidoPresencia, getInitialFormData, asesoresList]); // Removido lotesList porque LoteSelector lo maneja

    useEffect(() => {
        if (selectedLoteDetails) {
            let nuevoValorVenta = '';
            if (formData.tipo_venta === 'contado') {
                nuevoValorVenta = selectedLoteDetails.precio_lista_soles || '';
            } else if (formData.tipo_venta === 'credito') {
                const plazo = parseInt(formData.plazo_meses_credito, 10);
                if (plazo === 12) nuevoValorVenta = selectedLoteDetails.precio_credito_12_meses_soles || '';
                else if (plazo === 24) nuevoValorVenta = selectedLoteDetails.precio_credito_24_meses_soles || '';
                else if (plazo === 36) nuevoValorVenta = selectedLoteDetails.precio_credito_36_meses_soles || '';
                else nuevoValorVenta = ''; 
            }
            setFormData(prev => ({ ...prev, valor_lote_venta: nuevoValorVenta }));
        } else {
            setFormData(prev => ({ ...prev, valor_lote_venta: '' }));
        }
    }, [selectedLoteDetails, formData.tipo_venta, formData.plazo_meses_credito]);
    
    const fetchDefaultCommissionVPCallback = useCallback(async () => {
        if (formData.vendedor_principal && formData.tipo_venta && asesoresList.length > 0) {
            const asesorVP = asesoresList.find(a => a.id_asesor === formData.vendedor_principal);
            if (!asesorVP) return;
            setLoadingCommissionVP(true);
            setDefaultCommissionVP(null);
            let params = { asesor_id: asesorVP.id_asesor, tipo_venta: formData.tipo_venta };
            if (asesorVP.tipo_asesor_actual === 'Junior') {
                params.rol_asesor_en_venta = 'JUNIOR_VENDEDOR_PRINCIPAL';
                params.participacion_en_venta_aplicable = formData.participacion_junior_venta || 'N/A';
            } else if (asesorVP.tipo_asesor_actual === 'Socio') {
                params.rol_asesor_en_venta = 'SOCIO_VENDEDOR_PRINCIPAL';
                params.participacion_en_venta_aplicable = 'N/A';
            } else { setLoadingCommissionVP(false); return; }
            try {
                const response = await apiService.getDefaultCommissionRate(params);
                if (response.data.success) setDefaultCommissionVP(response.data.porcentaje_comision_default);
                else { console.warn("VP Default Comm Fetch:", response.data.message); setDefaultCommissionVP(null); }
            } catch (error) { console.error("Error fetching default commission for VP:", error.response?.data || error.message); setDefaultCommissionVP(null);
            } finally { setLoadingCommissionVP(false); }
        } else { setDefaultCommissionVP(null); }
    }, [asesoresList, formData.vendedor_principal, formData.tipo_venta, formData.participacion_junior_venta]);

    useEffect(() => { if (show) fetchDefaultCommissionVPCallback(); }, [show, fetchDefaultCommissionVPCallback]);

    const fetchDefaultCommissionSocioCallback = useCallback(async () => {
        if (formData.id_socio_participante && formData.tipo_venta && asesoresList.length > 0) {
            const asesorSocio = asesoresList.find(a => a.id_asesor === formData.id_socio_participante);
            if (!asesorSocio || asesorSocio.tipo_asesor_actual !== 'Socio') { setDefaultCommissionSocio(null); return; }
            setLoadingCommissionSocio(true);
            setDefaultCommissionSocio(null);
            const params = { asesor_id: asesorSocio.id_asesor, tipo_venta: formData.tipo_venta, rol_asesor_en_venta: 'SOCIO_PARTICIPANTE', participacion_en_venta_aplicable: formData.participacion_socio_venta || 'N/A' };
            try {
                const response = await apiService.getDefaultCommissionRate(params);
                if (response.data.success) setDefaultCommissionSocio(response.data.porcentaje_comision_default);
                else { console.warn("Socio Default Comm Fetch:", response.data.message); setDefaultCommissionSocio(null); }
            } catch (error) { console.error("Error fetching default commission for Socio:", error.response?.data || error.message); setDefaultCommissionSocio(null);
            } finally { setLoadingCommissionSocio(false); }
        } else { setDefaultCommissionSocio(null); }
    }, [asesoresList, formData.id_socio_participante, formData.tipo_venta, formData.participacion_socio_venta]);

    useEffect(() => { if (show) fetchDefaultCommissionSocioCallback(); }, [show, fetchDefaultCommissionSocioCallback]);
    
    useEffect(() => {
        if (formData.vendedor_principal && asesoresList.length > 0) {
            const vendedor = asesoresList.find(a => a.id_asesor === formData.vendedor_principal);
            if (vendedor) {
                setTipoVendedorPrincipal(vendedor.tipo_asesor_actual);
                if (vendedor.tipo_asesor_actual === 'Socio') {
                    setFormData(prev => ({ ...prev, participacion_junior_venta: 'N/A' }));
                }
            } else { setTipoVendedorPrincipal(null); }
        } else { setTipoVendedorPrincipal(null); }
    }, [formData.vendedor_principal, asesoresList]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormError(''); 
        let newFormDataState = { ...formData, [name]: value };

        if (name === "cliente" && value === "_CREAR_NUEVO_") {
            setClienteFormError('');
            setIsClienteModalOpen(true);
            return; 
        } else if (name === "tipo_venta") {
            newFormDataState.plazo_meses_credito = value === 'contado' ? 0 : ''; 
            newFormDataState.valor_lote_venta = ''; // Se recalculará
            if (value === 'contado' && selectedLoteDetails) {
                newFormDataState.cuota_inicial_requerida = selectedLoteDetails.precio_lista_soles || '0.00';
            } else if (value === 'credito') {
                newFormDataState.cuota_inicial_requerida = '0.00'; // Resetear o pedir que se ingrese
            }
        }
        setFormData(newFormDataState);
    };

    const handleLoteSelectedFromModal = (lote) => {
        console.log("[VentaForm] Lote seleccionado desde modal:", lote);
        if (lote) {
            const loteDisplayText = `${lote.id_lote} (${lote.ubicacion_proyecto} Mz:${lote.manzana || 'S/M'} Lt:${lote.numero_lote || 'S/N'})`;
            setFormData(prev => ({
                ...prev,
                lote: lote.id_lote,
                lote_display_text: loteDisplayText,
                tipo_venta: 'contado', // Resetear a contado por defecto al cambiar de lote
                plazo_meses_credito: 0,
                valor_lote_venta: lote.precio_lista_soles || '',
                cuota_inicial_requerida: lote.precio_lista_soles || '0.00', // Por defecto la cuota inicial es el total si es contado
            }));
            setSelectedLoteDetails(lote);
        } else { // Si se deselecciona o no se elige nada
             setFormData(prev => ({
                ...prev,
                lote: '',
                lote_display_text: '',
                valor_lote_venta: '',
             }));
             setSelectedLoteDetails(null);
        }
        setIsLoteSelectorModalOpen(false);
    };

    const handleClienteFormSubmit = async (clienteDataDelModal) => {
        setClienteFormError('');
        try {
            const response = await apiService.createCliente(clienteDataDelModal);
            const nuevoCliente = response.data;
            alert(`Cliente "${nuevoCliente.nombres_completos_razon_social}" creado con ID: ${nuevoCliente.id_cliente}`);
            setClientesList(prevList => [nuevoCliente, ...prevList].sort((a, b) => a.nombres_completos_razon_social.localeCompare(b.nombres_completos_razon_social)));
            setFormData(prev => ({ ...prev, cliente: nuevoCliente.id_cliente }));
            setIsClienteModalOpen(false);
        } catch (err) {
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al crear cliente.";
            if (errorData) {
                if (errorData.numero_documento) errorMsg = `N° Documento: ${errorData.numero_documento.join(', ')}`;
                else if (typeof errorData === 'string') errorMsg = errorData;
                else if (errorData.detail) errorMsg = errorData.detail;
                else if (typeof errorData === 'object') errorMsg = Object.entries(errorData).map(([key,value])=> `${key}: ${Array.isArray(value) ? value.join(',') : value}`).join('; ');
            } else if (err.message) { errorMsg = err.message; }
            setClienteFormError(errorMsg);
        }
    };
    
    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError('');
        if (!formData.lote) { setFormError("Debe seleccionar un Lote."); return; }
        if (!formData.cliente) { setFormError("Debe seleccionar o crear un Cliente."); return; }
        if (!formData.vendedor_principal) { setFormError("Debe seleccionar un Vendedor Principal."); return; }
        
        if (formData.tipo_venta === 'credito' && (!formData.plazo_meses_credito || parseInt(formData.plazo_meses_credito, 10) === 0)) {
            setFormError("Para ventas a crédito, por favor seleccione un plazo válido (12, 24, o 36 meses).");
            return;
        }
        if (formData.valor_lote_venta === '' || parseFloat(formData.valor_lote_venta) <= 0) {
            setFormError("El valor de venta del lote no es válido o no se ha calculado. Verifique el lote y el plan de pagos seleccionado.");
            return;
        }
        
        const valPorcentajeVP = parseFloat(formData.porcentaje_comision_vendedor_principal_personalizado);
        if (formData.porcentaje_comision_vendedor_principal_personalizado && (isNaN(valPorcentajeVP) || valPorcentajeVP < 0 || valPorcentajeVP > 100)) {
            setFormError("El porcentaje de comisión del Vendedor Principal debe ser un número entre 0 y 100.");
            return;
        }
        const valPorcentajeSocio = parseFloat(formData.porcentaje_comision_socio_personalizado);
        if (formData.porcentaje_comision_socio_personalizado && (isNaN(valPorcentajeSocio) || valPorcentajeSocio < 0 || valPorcentajeSocio > 100)) {
            setFormError("El porcentaje de comisión del Socio Participante debe ser un número entre 0 y 100.");
            return;
        }

        const dataToSubmit = {
            ...formData,
            valor_lote_venta: parseFloat(formData.valor_lote_venta),
            cuota_inicial_requerida: parseFloat(formData.cuota_inicial_requerida) || 0,
            plazo_meses_credito: formData.tipo_venta === 'contado' ? 0 : parseInt(formData.plazo_meses_credito, 10),
            id_socio_participante: formData.id_socio_participante || null,
            participacion_socio_venta: formData.id_socio_participante ? formData.participacion_socio_venta : 'N/A',
            porcentaje_comision_vendedor_principal_personalizado: formData.porcentaje_comision_vendedor_principal_personalizado ? parseFloat(formData.porcentaje_comision_vendedor_principal_personalizado) : null,
            porcentaje_comision_socio_personalizado: formData.porcentaje_comision_socio_personalizado && formData.id_socio_participante ? parseFloat(formData.porcentaje_comision_socio_personalizado) : null,
        };
        delete dataToSubmit.lote_display_text; // No enviar este campo al backend
        
        console.log("[VentaForm] Data a enviar para Venta:", dataToSubmit);
        onSubmit(dataToSubmit, initialData?.id_venta);
    };

    if (!show) return null;

    return (
        <>
            <div className={styles.modalOverlay}>
                <div className={`${styles.modalContent} ${customStyles.ventaFormModalContent}`}> {/* Usar customStyles si es necesario */}
                    <h2>{isModalForPresencia ? 'Registrar Venta para Presencia' : (initialData?.id_venta ? 'Editar Venta' : 'Registrar Nueva Venta')}</h2>
                    {loadingRelatedData && <p className={styles.loadingText}>Cargando datos...</p>}
                    {formError && <p className={styles.errorMessageForm}>{formError}</p>}

                    {!loadingRelatedData && (
                        <form onSubmit={handleSubmit}>
                            <div className={styles.formRow}>
                                <div className={styles.formGroup} style={{flex: 1}}>
                                    <label htmlFor="fecha_venta">Fecha de Venta <span className={styles.required}>*</span></label>
                                    <input type="date" id="fecha_venta" name="fecha_venta" value={formData.fecha_venta} onChange={handleChange} required />
                                </div>
                                <div className={styles.formGroup} style={{flex: 2}}>
                                    <label htmlFor="lote_display_text">Lote <span className={styles.required}>*</span></label>
                                    <div className={styles.inputWithButton}>
                                        <input
                                            type="text"
                                            id="lote_display_text"
                                            name="lote_display_text"
                                            value={formData.lote_display_text}
                                            readOnly
                                            placeholder="Seleccione un lote..."
                                            className={styles.readOnlyInput}
                                            onClick={() => setIsLoteSelectorModalOpen(true)} // Permitir abrir al hacer clic en el input
                                        />
                                        <button 
                                            type="button" 
                                            onClick={() => setIsLoteSelectorModalOpen(true)}
                                            className={styles.selectButton} // Usar la clase de FormStyles si existe o definir una nueva
                                            disabled={!!initialData?.id_venta && (initialData?.status_venta === 'procesable' || initialData?.status_venta === 'anulado')}
                                        >
                                            {formData.lote ? 'Cambiar' : 'Seleccionar'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label htmlFor="cliente">Cliente <span className={styles.required}>*</span></label>
                                <select 
                                    id="cliente" 
                                    name="cliente" 
                                    value={formData.cliente} 
                                    onChange={handleChange} 
                                    required
                                    disabled={isModalForPresencia && !!clientePredefinidoPresencia}
                                >
                                    <option value="">Seleccione Cliente</option>
                                    {!(isModalForPresencia && !!clientePredefinidoPresencia) && 
                                        <option value="_CREAR_NUEVO_">--- Crear Nuevo Cliente ---</option> 
                                    }
                                    {clientesList.map(c => (<option key={c.id_cliente} value={c.id_cliente}>{c.nombres_completos_razon_social} ({c.numero_documento})</option>))}
                                </select>
                            </div>
                            
                            <hr className={styles.formSeparator}/>
                            <h3 className={styles.subHeader}>Condiciones de Venta</h3>

                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="tipo_venta">Tipo de Venta <span className={styles.required}>*</span></label>
                                    <select id="tipo_venta" name="tipo_venta" value={formData.tipo_venta} onChange={handleChange} required>
                                        {TIPO_VENTA_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                {formData.tipo_venta === 'credito' && (
                                    <div className={styles.formGroup}>
                                        <label htmlFor="plazo_meses_credito">Plazo de Crédito <span className={styles.required}>*</span></label>
                                        <select id="plazo_meses_credito" name="plazo_meses_credito" value={formData.plazo_meses_credito} onChange={handleChange} required={formData.tipo_venta === 'credito'}>
                                            <option value="">Seleccione Plazo</option>
                                            {PLAN_PAGO_CREDITO_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            
                            <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="valor_lote_venta">Valor de Venta (S/.) <span className={styles.required}>*</span></label>
                                    <input type="number" id="valor_lote_venta" name="valor_lote_venta" 
                                           value={formData.valor_lote_venta} 
                                           readOnly 
                                           className={styles.readOnlyInput}
                                           placeholder="Se calculará automáticamente"
                                    />
                                </div>
                                {formData.tipo_venta === 'credito' && (
                                    <div className={styles.formGroup}>
                                        <label htmlFor="cuota_inicial_requerida">Cuota Inicial Requerida (S/.) <span className={styles.required}>*</span></label>
                                        <input type="number" id="cuota_inicial_requerida" name="cuota_inicial_requerida" value={formData.cuota_inicial_requerida} onChange={handleChange} step="0.01" placeholder="Ej: 5000.00" required={formData.tipo_venta === 'credito'}/>
                                    </div>
                                )}
                            </div>
                             <div className={styles.formRow}>
                                <div className={styles.formGroup}>
                                    <label htmlFor="status_venta">Status de Venta <span className={styles.required}>*</span></label>
                                    <select id="status_venta" name="status_venta" value={formData.status_venta} onChange={handleChange} required>
                                        {STATUS_VENTA_CHOICES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup}> {/* Espacio vacío para alinear o añadir otro campo si es necesario */}
                                </div>
                            </div>
                            
                            <hr className={styles.formSeparator}/>
                            <h3 className={styles.subHeader}>Asesores y Comisiones</h3>
                            
                            <div className={styles.formRow}>
                                <div className={styles.formGroup} style={{flex: 2}}>
                                    <label htmlFor="vendedor_principal">Vendedor Principal <span className={styles.required}>*</span></label>
                                    <select id="vendedor_principal" name="vendedor_principal" value={formData.vendedor_principal} onChange={handleChange} required>
                                        <option value="">Seleccione Vendedor</option>
                                        {asesoresList.map(a => <option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor} ({a.tipo_asesor_actual})</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{flex: 1.5}}>
                                    <label htmlFor="participacion_junior_venta">Participación Junior</label>
                                    <select 
                                        id="participacion_junior_venta" 
                                        name="participacion_junior_venta" 
                                        value={formData.participacion_junior_venta} 
                                        onChange={handleChange}
                                        disabled={tipoVendedorPrincipal === 'Socio'}
                                    >
                                        {PARTICIPACION_JUNIOR_CHOICES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{flex: 1}}>
                                    <label htmlFor="porcentaje_comision_vendedor_principal_personalizado">Comisión VP (%)</label>
                                    <input 
                                        type="number" 
                                        id="porcentaje_comision_vendedor_principal_personalizado" 
                                        name="porcentaje_comision_vendedor_principal_personalizado" 
                                        value={formData.porcentaje_comision_vendedor_principal_personalizado} 
                                        onChange={handleChange} 
                                        step="0.01" min="0" max="100"
                                        placeholder={loadingCommissionVP ? "Cargando..." : (defaultCommissionVP !== null ? `${defaultCommissionVP}% (Def.)` : "Tabla")}
                                        disabled={!formData.vendedor_principal}
                                    />
                                    {defaultCommissionVP !== null && formData.porcentaje_comision_vendedor_principal_personalizado === '' && <small className={styles.helpText}>Predeterminado: {defaultCommissionVP}%</small>}
                                </div>
                            </div>
                            
                            <div className={styles.formRow}>
                                <div className={styles.formGroup} style={{flex: 2}}>
                                    <label htmlFor="id_socio_participante">Socio Participante (Opcional)</label>
                                    <select id="id_socio_participante" name="id_socio_participante" value={formData.id_socio_participante} onChange={handleChange}>
                                        <option value="">Ninguno</option>
                                        {asesoresList.filter(a => a.tipo_asesor_actual === 'Socio' && a.id_asesor !== formData.vendedor_principal).map(a => (
                                            <option key={a.id_asesor} value={a.id_asesor}>{a.nombre_asesor}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{flex: 1.5}}>
                                    <label htmlFor="participacion_socio_venta">Participación Socio</label>
                                    <select 
                                        id="participacion_socio_venta" 
                                        name="participacion_socio_venta" 
                                        value={formData.participacion_socio_venta} 
                                        onChange={handleChange}
                                        disabled={!formData.id_socio_participante && tipoVendedorPrincipal !== 'Socio'}
                                    >
                                        {PARTICIPACION_SOCIO_CHOICES_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{flex: 1}}>
                                    <label htmlFor="porcentaje_comision_socio_personalizado">Comisión Socio (%)</label>
                                    <input 
                                        type="number" 
                                        id="porcentaje_comision_socio_personalizado" 
                                        name="porcentaje_comision_socio_personalizado" 
                                        value={formData.porcentaje_comision_socio_personalizado} 
                                        onChange={handleChange} 
                                        step="0.01" min="0" max="100"
                                        placeholder={loadingCommissionSocio ? "Cargando..." : (defaultCommissionSocio !== null ? `${defaultCommissionSocio}% (Def.)` : "Tabla")}
                                        disabled={!formData.id_socio_participante}
                                    />
                                     {defaultCommissionSocio !== null && formData.porcentaje_comision_socio_personalizado === '' && <small className={styles.helpText}>Predeterminado: {defaultCommissionSocio}%</small>}
                                </div>
                            </div>
                            <hr className={styles.formSeparator}/>
                            <div className={styles.formGroup}>
                                <label htmlFor="modalidad_presentacion">Modalidad Presentación</label>
                                <input type="text" id="modalidad_presentacion" name="modalidad_presentacion" value={formData.modalidad_presentacion} onChange={handleChange} />
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="notas">Notas</label>
                                <textarea id="notas" name="notas" value={formData.notas} onChange={handleChange} rows="2"></textarea>
                            </div>

                            <div className={styles.formActions}>
                                <button type="submit" className={`${styles.button} ${styles.buttonPrimary}`} disabled={loadingRelatedData || loadingCommissionVP || loadingCommissionSocio}>
                                    {initialData?.id_venta ? 'Actualizar Venta' : 'Guardar Venta'}
                                </button>
                                <button type="button" onClick={onClose} className={`${styles.button} ${styles.buttonSecondary}`}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>

            <ClienteForm
                show={isClienteModalOpen}
                onClose={() => {
                    setIsClienteModalOpen(false);
                    if (formData.cliente === "_CREAR_NUEVO_") {
                        setFormData(prev => ({ ...prev, cliente: '' }));
                    }
                }}
                onSubmit={handleClienteFormSubmit}
                formError={clienteFormError}
                clearExternalError={() => setClienteFormError('')}
            />

            <LoteSelector
                show={isLoteSelectorModalOpen}
                onClose={() => setIsLoteSelectorModalOpen(false)}
                onLoteSelected={handleLoteSelectedFromModal}
                currentLoteId={formData.lote} // Pasar el ID del lote actualmente seleccionado
            />
        </>
    );
}

export default VentaForm;