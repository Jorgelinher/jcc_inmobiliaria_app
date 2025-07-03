// ============================================================================
// PROTECCIÓN CRÍTICA - NO ELIMINAR NI MODIFICAR SIN AUTORIZACIÓN
// ============================================================================
// 
// Este archivo contiene funcionalidad CRÍTICA para el manejo de ventas en dólares
// (Aucallama/Oasis 2) y soles. Los siguientes elementos NO DEBEN ser eliminados
// ni modificados sin autorización explícita:
//
// 1. Lógica de detección de proyectos en dólares (esDolares)
// 2. Cálculos y visualización de montos en dólares vs soles
// 3. Campos monto_total_credito_dolares y saldo_total_dolares en cabecera
// 4. Eliminación condicional de columna "Saldo" para proyectos en dólares
// 5. Manejo de pagos en dólares con tipo de cambio
// 6. Refresco automático tras operaciones de pago
// 7. Cualquier hook o función relacionada con la lógica de monedas
//
// ÚLTIMA ACTUALIZACIÓN: 26/Jun/2025 - Sistema robusto para Aucallama/Oasis 2
// ============================================================================

// src/pages/VentaDetailPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService';
import RegistroPagoForm from '../components/forms/RegistroPagoForm';
import styles from './DetailPage.module.css';
import tableStyles from './VentasPage.module.css'; // Asumiendo que aquí están tus estilos de tabla
import { Decimal } from 'decimal.js'; // Importar Decimal.js para cálculos precisos

// Definición de PLAN_PAGO_CHOICES para mostrar el label del plazo
const PLAN_PAGO_CHOICES_MAP = {
    0: 'Contado / Sin Plan',
    12: 'Crédito 12 Meses',
    24: 'Crédito 24 Meses',
    36: 'Crédito 36 Meses',
};

// Simulación de Venta.TIPO_VENTA_CHOICES si no lo importas de otro lado
const TIPO_VENTA_CHOICES_FRONTEND = [
    { value: 'contado', label: 'Contado' },
    { value: 'credito', label: 'Crédito' },
];

// Mover aquí la función getProyectoKey para que esté disponible antes de los hooks
const getProyectoKey = (ubicacionProyecto) => {
    if (!ubicacionProyecto) return '';
    const val = ubicacionProyecto.trim().toLowerCase();
    if (val.includes('aucallama')) return 'aucallama';
    if (val.includes('oasis 2')) return 'oasis 2';
    return val;
};

function VentaDetailPage() {
    const { idVenta } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [venta, setVenta] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    
    const [isPagoModalOpen, setIsPagoModalOpen] = useState(false);
    // const [editingPago, setEditingPago] = useState(null); // Comentado ya que no se usa para edición aún
    const [cuotaParaPago, setCuotaParaPago] = useState(null);
    const [montoSugeridoParaPago, setMontoSugeridoParaPago] = useState(null);
    const [isConfirmingFirma, setIsConfirmingFirma] = useState(false); // Estado para feedback del botón de firma

    // Mover aquí la declaración de esDolares
    const esDolares = useMemo(() => {
        if (!venta || !venta.lote_info) return false;
        const proyectoKey = getProyectoKey(venta.lote_info);
        return proyectoKey === 'aucallama' || proyectoKey === 'oasis 2';
    }, [venta]);

    const fetchVentaDetalle = useCallback(async () => {
        if (!idVenta) {
            setError("ID de Venta no proporcionado.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        console.log(`[VentaDetailPage] Intentando cargar detalle para Venta ID: ${idVenta}`);
        try {
            const response = await apiService.getVentaById(idVenta);
            console.log("[VentaDetailPage] Respuesta del API getVentaById:", response);
            if (response.data) {
                setVenta(response.data);
            } else {
                setError("La respuesta del API para el detalle de la venta no tiene el formato esperado.");
                setVenta(null);
            }
        } catch (err) {
            console.error("Error cargando detalle de la venta:", err.response?.data || err.message);
            setError(err.response?.data?.detail || err.message || "No se pudo cargar el detalle de la venta.");
            setVenta(null);
        } finally {
            setLoading(false);
        }
    }, [idVenta]);

    useEffect(() => {
        fetchVentaDetalle();
    }, [fetchVentaDetalle]);

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        if (queryParams.get('accion') === 'registrarPago') {
            setCuotaParaPago(null); 
            setMontoSugeridoParaPago(null);
            setIsPagoModalOpen(true);
            navigate(location.pathname, { replace: true }); 
        }
    }, [location, navigate]);

    const handleOpenPagoModal = (cuota = null, monto = null) => {
        // setEditingPago(null); // No se usa para edición de pagos por ahora
        setCuotaParaPago(cuota);
        setMontoSugeridoParaPago(monto);
        setIsPagoModalOpen(true);
    };
    
    const handleClosePagoModal = () => {
        console.log("[VentaDetailPage] handleClosePagoModal llamado."); // DEBUG
        setIsPagoModalOpen(false);
        // setEditingPago(null); // Ya estaba comentado, mantenlo así por ahora
        setCuotaParaPago(null);
        setMontoSugeridoParaPago(null);
    };

    const handleSubmitPago = async (pagoDataFromForm) => {
        console.log("[VentaDetailPage] handleSubmitPago iniciado con datos del form:", pagoDataFromForm); // DEBUG
        try {
            const dataToSend = {
                ...pagoDataFromForm,
                venta: idVenta, 
                cuota_plan_pago_cubierta: cuotaParaPago ? cuotaParaPago.id_cuota : null,
            };
            console.log("[VentaDetailPage] Datos listos para enviar a createRegistroPago:", dataToSend); // DEBUG
            
            const response = await apiService.createRegistroPago(dataToSend); // Esperar la respuesta
            console.log("[VentaDetailPage] Respuesta de createRegistroPago API:", response); // DEBUG

            // Verificar si la respuesta es la esperada para un 201 Created
            // DRF usualmente devuelve el objeto creado y un status 201.
            // Axios envuelve esto en un objeto response que tiene 'data' y 'status'.
            if (response && response.status === 201 && response.data) {
                alert('Pago registrado con éxito! ID: ' + response.data.id_pago + '\n\nEl sistema está recalculando automáticamente las cuotas...'); // Asumiendo que el API devuelve el pago creado con su ID
                console.log("[VentaDetailPage] Llamando a handleClosePagoModal después de éxito."); // DEBUG
                handleClosePagoModal();
                console.log("[VentaDetailPage] Llamando a fetchVentaDetalle después de cerrar modal."); // DEBUG
                
                // Mostrar indicador de carga mientras se procesa
                setLoading(true);
                
                // Aumentar el delay para asegurar que el backend haya procesado completamente los signals y recálculos
                setTimeout(async () => {
                    try {
                        await fetchVentaDetalle();
                        console.log("[VentaDetailPage] Datos actualizados después del pago.");
                    } catch (error) {
                        console.error("[VentaDetailPage] Error al refrescar datos:", error);
                        alert("El pago se registró correctamente, pero hubo un problema al actualizar la vista. Por favor, recarga la página.");
                    } finally {
                        setLoading(false);
                    }
                }, 2000); // Aumentado a 2 segundos para dar más tiempo al backend
            } else {
                // Esto podría pasar si el API devuelve 200 OK pero no el contenido esperado, o un status inesperado.
                console.warn("[VentaDetailPage] Respuesta de createRegistroPago no fue 201 o no contiene data esperada:", response);
                alert('El pago podría haberse registrado, pero la respuesta del servidor no fue la esperada. Por favor, verifique.');
                // Igualmente cerrar el modal y recargar para que el usuario vea el estado actual
                handleClosePagoModal();
                setLoading(true);
                setTimeout(async () => {
                    try {
                        await fetchVentaDetalle();
                    } catch (error) {
                        console.error("[VentaDetailPage] Error al refrescar datos:", error);
                    } finally {
                        setLoading(false);
                    }
                }, 2000);
            }
        } catch (err) {
            console.error("[VentaDetailPage] Error en catch de handleSubmitPago:", err.response?.data || err.message || err); // DEBUG
            const errorDetail = err.response?.data;
            let errorMessage = "Error al guardar el pago: ";
            if (typeof errorDetail === 'string') { errorMessage += errorDetail; }
            else if (errorDetail) { errorMessage += Object.entries(errorDetail).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join("; ");}
            else { errorMessage += err.message || "Error desconocido." }
            alert(errorMessage);
            // No cerrar el modal en caso de error de API para que el usuario no pierda los datos ingresados
            // handleClosePagoModal(); 
        }
    };
    
    const handleDeletePago = async (pagoId) => {
        if (window.confirm(`¿Está seguro de que quiere eliminar este pago (ID: ${pagoId})? Esta acción actualizará los saldos.`)) {
            try {
                setLoading(true);
                await apiService.deleteRegistroPago(pagoId);
                alert('Pago eliminado con éxito!\n\nEl sistema está recalculando automáticamente las cuotas...');
                
                // Aumentar el delay para asegurar que el backend haya procesado completamente los signals y recálculos
                setTimeout(async () => {
                    try {
                        await fetchVentaDetalle();
                        console.log("[VentaDetailPage] Datos actualizados después de eliminar pago.");
                    } catch (error) {
                        console.error("[VentaDetailPage] Error al refrescar datos:", error);
                        alert("El pago se eliminó correctamente, pero hubo un problema al actualizar la vista. Por favor, recarga la página.");
                    } finally {
                        setLoading(false);
                    }
                }, 2000);
            } catch (err) {
                setLoading(false);
                alert(`Error al eliminar el pago: ${err.message}`);
            }
        }
    };

    const handlePagarSaldoTotal = async () => {
        if (!venta) {
            alert("Datos de la venta no cargados.");
            return;
        }
        
        let saldoTotalDeudaDecimal = Decimal(0);
        if (venta.tipo_venta === 'contado') {
            saldoTotalDeudaDecimal = Decimal(venta.saldo_pendiente || 0);
        } else if (venta.plan_pago_detalle && venta.plan_pago_detalle.cuotas) {
            venta.plan_pago_detalle.cuotas.forEach(cuota => {
                // Sumar solo el saldo pendiente de las cuotas que no estén completamente pagadas
                let saldoCuota;
                if (esDolares && cuota.saldo_cuota_dolares != null) {
                    saldoCuota = Decimal(cuota.saldo_cuota_dolares);
                } else if (cuota.saldo_cuota_display && cuota.saldo_cuota_display.soles != null) {
                    saldoCuota = Decimal(cuota.saldo_cuota_display.soles);
                } else {
                    saldoCuota = Decimal(cuota.monto_programado).minus(Decimal(cuota.monto_pagado));
                }
                if (saldoCuota.greaterThan(0)) {
                    saldoTotalDeudaDecimal = saldoTotalDeudaDecimal.plus(saldoCuota);
                }
            });
        } else if (venta.tipo_venta === 'credito' && !venta.plan_pago_detalle) {
            // Si es a crédito pero no hay plan (ej. solo cuota inicial), tomar el saldo_pendiente general
            saldoTotalDeudaDecimal = Decimal(venta.saldo_pendiente || 0);
        }
    
        if (saldoTotalDeudaDecimal.lessThanOrEqualTo(0)) {
            alert("La deuda ya está completamente pagada o no hay saldo pendiente.");
            return;
        }
    
        const saldoDisplay = esDolares 
            ? `$${saldoTotalDeudaDecimal.toFixed(2)}`
            : displayCurrency(saldoTotalDeudaDecimal.toFixed(2));
            
        if (window.confirm(`El saldo total pendiente es ${saldoDisplay}. ¿Desea registrar un pago por este monto?`)) {
            handleOpenPagoModal(null, saldoTotalDeudaDecimal.toFixed(2)); 
        }
    };
    // --- INICIO: NUEVA FUNCIÓN PARA MARCAR CONTRATO FIRMADO ---
    const handleMarcarFirmaContrato = async () => {
        if (!venta) return;

        // Opcional: Pedir confirmación y/o fecha de firma
        const confirmar = window.confirm("¿Está seguro de que desea marcar este contrato como firmado por el cliente? Esta acción actualizará el estado del lote a 'Vendido' si la venta está 'Procesable'.");
        if (!confirmar) return;

        // Opcional: Permitir al usuario ingresar la fecha de firma
        // const fechaFirmaInput = prompt("Ingrese la fecha de firma (YYYY-MM-DD), o deje vacío para usar la fecha actual:", new Date().toISOString().split('T')[0]);
        // if (fechaFirmaInput === null) return; // Usuario canceló el prompt
        // const fechaFirma = fechaFirmaInput.trim() === '' ? null : fechaFirmaInput;
        
        // Por simplicidad, usaremos la fecha actual en el backend si no se envía.
        // Si quieres enviar una fecha específica, constrúyela aquí y pásala.
        const fechaFirma = null; // El backend usará timezone.now().date() si es null

        setIsConfirmingFirma(true);
        setError(null);
        try {
            const response = await apiService.marcarVentaComoFirmada(venta.id_venta, fechaFirma);
            alert('Contrato marcado como firmado exitosamente.');
            setVenta(response.data); // Actualizar la data de la venta con la respuesta del API
            await fetchVentaDetalle(); // Opcional: O simplemente actualizar estado local
        } catch (err) {
            console.error("Error al marcar contrato como firmado:", err.response?.data || err.message);
            setError(err.response?.data?.error || err.response?.data?.detail || err.message || "Error al marcar la firma.");
        } finally {
            setIsConfirmingFirma(false);
        }
    };

    const handleRevertirFirmaContrato = async () => {
        if (!venta) return;

        const confirmar = window.confirm("¿Está seguro de que desea revertir la firma del contrato? Esta acción cambiará el estado del lote de 'Vendido' a 'Reservado' si la venta está 'Procesable'.");
        if (!confirmar) return;

        setIsConfirmingFirma(true);
        setError(null);
        try {
            const response = await apiService.revertirFirmaContrato(venta.id_venta);
            alert('Firma del contrato revertida exitosamente.');
            setVenta(response.data);
            await fetchVentaDetalle();
        } catch (err) {
            console.error("Error al revertir firma del contrato:", err.response?.data || err.message);
            setError(err.response?.data?.error || err.response?.data?.detail || err.message || "Error al revertir la firma.");
        } finally {
            setIsConfirmingFirma(false);
        }
    };
    // --- FIN: NUEVA FUNCIÓN ---
    
    if (loading) return <div className={styles.loadingMessage}>Cargando detalle de la venta...</div>;
    if (error) return (<div className={styles.pageContainer}><h1 className={styles.title}>Error</h1><div className={styles.errorMessage}>{error}</div><Link to="/ventas" className={styles.backButton}>Volver al listado</Link></div>);
    if (!venta) return (<div className={styles.pageContainer}><h1 className={styles.title}>Venta no Encontrada</h1><div className={styles.noDataMessage}>No se encontró la venta.</div><Link to="/ventas" className={styles.backButton}>Volver al listado</Link></div>);

    const displayValue = (value, suffix = '') => (value !== null && value !== undefined && value !== '') ? `${value}${suffix}` : '-';
    const displayDate = (dateStr) => dateStr ? new Date(dateStr + 'T00:00:00Z').toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }) : '-';
    const displayCurrency = (value) => (value !== null && value !== undefined && !isNaN(parseFloat(value))) ? parseFloat(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }) : '-';
    const displayCommissionPercentage = (value) => (value !== null && value !== undefined) ? `${parseFloat(value).toFixed(2)}% (Personalizado)` : 'Según Tabla';
    
    const getTipoVentaLabel = (tipoVentaKey) => {
        const choice = TIPO_VENTA_CHOICES_FRONTEND.find(c => c.value === tipoVentaKey);
        return choice ? choice.label : tipoVentaKey;
    };
    const getPlazoLabel = (plazoKey) => PLAN_PAGO_CHOICES_MAP[plazoKey] || (plazoKey && parseInt(plazoKey,10) > 0 ? `${plazoKey} meses` : '-');

    let saldoTotalCalculadoParaBoton = Decimal(0);
    if (venta.tipo_venta === 'contado') {
        saldoTotalCalculadoParaBoton = Decimal(venta.saldo_pendiente || 0);
    } else if (venta.plan_pago_detalle && venta.plan_pago_detalle.cuotas) {
        venta.plan_pago_detalle.cuotas.forEach(cuota => {
            let saldoCuota;
            if (esDolares && cuota.saldo_cuota_dolares != null) {
                saldoCuota = Decimal(cuota.saldo_cuota_dolares);
            } else if (cuota.saldo_cuota_display && cuota.saldo_cuota_display.soles != null) {
                saldoCuota = Decimal(cuota.saldo_cuota_display.soles);
            } else {
                saldoCuota = Decimal(cuota.monto_programado).minus(Decimal(cuota.monto_pagado));
            }
            if (saldoCuota.greaterThan(0)) {
                saldoTotalCalculadoParaBoton = saldoTotalCalculadoParaBoton.plus(saldoCuota);
            }
        });
    }  else if (venta.tipo_venta === 'credito' && !venta.plan_pago_detalle) {
        saldoTotalCalculadoParaBoton = Decimal(venta.saldo_pendiente || 0);
    }

    // NUEVA FUNCIÓN para mostrar monto en dólares o soles según el proyecto
    const displayMontoCuota = (cuota, mostrarDolares) => {
        if (mostrarDolares && cuota.monto_programado_display && cuota.monto_programado_display.dolares != null) {
            return `$${Number(cuota.monto_programado_display.dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        }
        if (cuota.monto_programado_display && cuota.monto_programado_display.soles != null) {
            return displayCurrency(cuota.monto_programado_display.soles);
        }
        return '-';
    };
    const displaySaldoCuota = (cuota, mostrarDolares) => {
        if (mostrarDolares && cuota.saldo_cuota_display && cuota.saldo_cuota_display.dolares != null) {
            return `$${Number(cuota.saldo_cuota_display.dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
        }
        if (cuota.saldo_cuota_display && cuota.saldo_cuota_display.soles != null) {
            return displayCurrency(cuota.saldo_cuota_display.soles);
        }
        return '-';
    };

    return (
        <div className={styles.pageContainer}>
            <div className={styles.headerActions}>
            <h1 className={styles.title}>Detalle de Venta: {venta.id_venta}</h1>
    <div className={styles.headerButtonsContainer}>
        {saldoTotalCalculadoParaBoton.greaterThan(0) && (
            <button
                onClick={handlePagarSaldoTotal}
                // Aplicar clases: base, de color, y específica si la tienes
                className={`${styles.detailButton} ${styles.detailButtonAccent} ${styles.payTotalButton}`}
            >
                Pagar Saldo Total ({displayCurrency(saldoTotalCalculadoParaBoton.toFixed(2))})
            </button>
        )}
        {/* Botón para Marcar Firma de Contrato */}
        {venta.status_venta === 'procesable' && !venta.cliente_firmo_contrato && (
            <button
                onClick={handleMarcarFirmaContrato}
                className={`${styles.detailButton} ${styles.detailButtonAccent} ${styles.signButton}`}
                disabled={isConfirmingFirma}
            >
                {isConfirmingFirma ? 'Marcando...' : 'Marcar Contrato Firmado'}
            </button>
        )}
        {/* Botón para Revertir Firma de Contrato */}
        {venta.status_venta === 'procesable' && venta.cliente_firmo_contrato && (
            <button
                onClick={handleRevertirFirmaContrato}
                className={`${styles.detailButton} ${styles.detailButtonWarning} ${styles.revertButton}`}
                disabled={isConfirmingFirma}
            >
                {isConfirmingFirma ? 'Revirtiendo...' : 'Revertir Firma de Contrato'}
            </button>
        )}
        <button 
            onClick={() => navigate('/ventas', { state: { accion: 'editarVenta', idVentaAEditar: venta.id_venta } })}
            // Aplicar clases: base, de color, y específica si la tienes
            className={`${styles.detailButton} ${styles.detailButtonPrimary} ${styles.editButtonMain}`}
        >
            Editar Venta
        </button>
                </div>
            </div>
            
            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Información General de la Venta</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>ID Venta:</strong> {displayValue(venta.id_venta)}</div>
                    <div className={styles.detailItem}><strong>Fecha de Venta:</strong> {displayDate(venta.fecha_venta)}</div>
                    <div className={styles.detailItem}><strong>Lote:</strong> {venta.lote ? <Link to={`/lotes/${venta.lote}`}>{displayValue(venta.lote_info || venta.lote)}</Link> : '-'}</div>
                    <div className={styles.detailItem}><strong>Cliente:</strong> {venta.cliente_detalle ? <Link to={`/clientes/${venta.cliente_detalle.id_cliente}`}>{displayValue(venta.cliente_detalle.nombres_completos_razon_social)}</Link> : '-'}</div>
                    <div className={styles.detailItem}><strong>Tipo de Venta:</strong> {getTipoVentaLabel(venta.tipo_venta)}</div>
                    {venta.tipo_venta === 'credito' && (
                        <div className={styles.detailItem}><strong>Plazo Crédito:</strong> {getPlazoLabel(venta.plazo_meses_credito)}</div>
                    )}
                    <div className={styles.detailItem}><strong>Valor Total (S/.):</strong> {displayCurrency(venta.valor_lote_venta)}</div>
                    {/* NUEVO: Mostrar valor en dólares y tipo de cambio si aplica */}
                    {(() => {
                        let proyectoKey = '';
                        if (venta.lote_info) {
                            proyectoKey = getProyectoKey(venta.lote_info);
                        } else if (venta.lote && typeof venta.lote === 'object' && venta.lote.ubicacion_proyecto) {
                            proyectoKey = getProyectoKey(venta.lote.ubicacion_proyecto);
                        }
                        const mostrarDolares = proyectoKey === 'aucallama' || proyectoKey === 'oasis 2';
                        if (mostrarDolares) {
                            return <>
                                <div className={styles.detailItem}><strong>Valor Venta ($):</strong> {venta.precio_dolares ? `$${Number(venta.precio_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}</div>
                                <div className={styles.detailItem}><strong>Tipo de Cambio:</strong> {venta.tipo_cambio ? Number(venta.tipo_cambio).toFixed(3) : '-'}</div>
                            </>;
                        }
                        return null;
                    })()}
                    {venta.tipo_venta === 'credito' && (
                         <div className={styles.detailItem}><strong>Cuota Inicial Req. (S/.):</strong> {displayCurrency(venta.cuota_inicial_requerida)}</div>
                    )}
                    <div className={styles.detailItem}><strong>Monto Pagado (S/.):</strong> {displayCurrency(venta.monto_pagado_actual)}</div>
                    <div className={styles.detailItem}><strong>Saldo Pendiente (S/.):</strong> {displayCurrency(venta.saldo_pendiente)}</div>
                    <div className={styles.detailItem}><strong>Status:</strong> <span className={`${styles.statusBadge} ${styles['statusBadge' + venta.status_venta?.replace(/\s+/g, '')]}`}>{displayValue(venta.status_venta_display || venta.status_venta)}</span></div>
                    {/* --- INICIO: MOSTRAR ESTADO DE FIRMA --- */}
                    <div className={styles.detailItem}>
                        <strong>Contrato Firmado:</strong> 
                        <span style={{ color: venta.cliente_firmo_contrato ? 'var(--color-exito)' : 'var(--texto-secundario)' /* Menos estridente si es No */, fontWeight: venta.cliente_firmo_contrato ? 'bold': 'normal' }}>
                            {venta.cliente_firmo_contrato ? 'Sí' : 'No'}
                        </span>
                    </div>
                    {venta.cliente_firmo_contrato && venta.fecha_firma_contrato && (
                        <div className={styles.detailItem}><strong>Fecha de Firma:</strong> {displayDate(venta.fecha_firma_contrato)}</div>
                    )}
                    {/* --- FIN: MOSTRAR ESTADO DE FIRMA --- */}
                    <div className={styles.detailItem}><strong>Vendedor:</strong> {displayValue(venta.vendedor_principal_nombre)}</div>
                    <div className={styles.detailItem}><strong>Participación Junior:</strong> {displayValue(venta.participacion_junior_venta)}</div>
                    <div className={styles.detailItem}><strong>Comisión Vendedor Principal:</strong> {displayCommissionPercentage(venta.porcentaje_comision_vendedor_principal_personalizado)}</div>
                    <div className={styles.detailItem}><strong>Socio Participante:</strong> {displayValue(venta.socio_participante_nombre)}</div>
                    <div className={styles.detailItem}><strong>Participación Socio:</strong> {displayValue(venta.participacion_socio_venta)}</div>
                    {venta.id_socio_participante && (
                        <div className={styles.detailItem}><strong>Comisión Socio Participante:</strong> {displayCommissionPercentage(venta.porcentaje_comision_socio_personalizado)}</div>
                    )}
                    <div className={styles.detailItem}><strong>Modalidad Presentación:</strong> {displayValue(venta.modalidad_presentacion)}</div>
                    {venta.presencia_que_origino_id && (
                        <div className={styles.detailItem}><strong>Presencia Origen:</strong> <Link to={`/presencias/${venta.presencia_que_origino_id}`}>ID {venta.presencia_que_origino_id}</Link></div>
                    )}
                    <div className={styles.detailItemFull}><strong>Notas de Venta:</strong> <pre className={styles.preformattedText}>{displayValue(venta.notas)}</pre></div>
                </div>
            </div>

            <div className={styles.sectionContainer}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Historial de Pagos Registrados</h2>
                    <button onClick={() => handleOpenPagoModal(null, null)} className={`${tableStyles.button} ${tableStyles.createButton}`} style={{marginLeft: 'auto'}}>
                        Registrar Pago General
                    </button>
                </div>
                {venta.registros_pago && venta.registros_pago.length > 0 ? (
                    <div className={styles.tableResponsiveWrapper}> 
                        <table className={`${tableStyles.table} ${styles.dataTableFix}`} style={{marginTop: '10px', width: '100%'}}>
                            <thead>
                                <tr>
                                    <th style={{width: '5%'}}>ID</th>
                                    <th style={{width: '12%'}}>Fecha Pago</th>
                                    <th style={{width: '15%'}} className={tableStyles.textAlignRight}>Monto (S/.)</th>
                                    <th style={{width: '13%'}}>Método</th>
                                    <th style={{width: '15%'}}>Referencia</th>
                                    <th style={{width: '10%'}}>Cuota Cub.</th>
                                    <th style={{width: '20%'}}>Notas</th>
                                    <th style={{width: '10%', textAlign: 'center'}}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {venta.registros_pago.map(pago => (
                                    <tr key={pago.id_pago}>
                                        <td>{pago.id_pago}</td>
                                        <td>{displayDate(pago.fecha_pago)}</td>
                                        <td className={tableStyles.textAlignRight}>{esDolares && pago.monto_pago_dolares != null ? `$${Number(pago.monto_pago_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : displayCurrency(pago.monto_pago)}</td>
                                        <td>{displayValue(pago.metodo_pago)}</td>
                                        <td>{displayValue(pago.referencia_pago)}</td>
                                        <td>{pago.cuota_info ? `N° ${pago.cuota_info.numero_cuota}` : (pago.cuota_plan_pago_cubierta ? `ID Cuota: ${pago.cuota_plan_pago_cubierta}`: '-')}</td>
                                        <td><pre className={styles.preformattedTextSmall}>{displayValue(pago.notas_pago)}</pre></td>
                                        <td className={tableStyles.actionButtons} style={{justifyContent: 'center'}}>
                                        <button 
                                                onClick={() => handleDeletePago(pago.id_pago)} 
                                                className={`${styles.detailButtonInTable || styles.button} ${styles.deleteButtonInTable || styles.deleteButtonSmall}`} // Aplicar nueva clase
                                                title="Eliminar Pago"
                                            >
                                                Eliminar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className={styles.noDataMessage} style={{marginTop: '10px'}}>No hay pagos generales registrados para esta venta.</p>
                )}
            </div>
            
            {venta.plan_pago_detalle && venta.plan_pago_detalle.cuotas && venta.plan_pago_detalle.cuotas.length > 0 && (
                <div className={styles.sectionContainer}>
                    <h2 className={styles.sectionTitle}>Plan de Pagos a Crédito (Cronograma)</h2>
                    <div className={styles.detailGrid} style={{gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom:'15px'}}>
                        <div className={styles.detailItem}><strong>Monto Financiado:</strong> {esDolares && venta.plan_pago_detalle.monto_total_credito_dolares != null ? `$${Number(venta.plan_pago_detalle.monto_total_credito_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : displayCurrency(venta.plan_pago_detalle.monto_total_credito)}</div>
                        <div className={styles.detailItem}><strong>N° Cuotas:</strong> {displayValue(venta.plan_pago_detalle.numero_cuotas)}</div>
                        <div className={styles.detailItem}><strong>Cuota Regular:</strong> {
                            esDolares
                                ? (venta.plan_pago_detalle.monto_cuota_regular_display && venta.plan_pago_detalle.monto_cuota_regular_display.dolares != null
                                    ? `$${Number(venta.plan_pago_detalle.monto_cuota_regular_display.dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}`
                                    : '-')
                                : (venta.plan_pago_detalle.monto_cuota_regular_display && venta.plan_pago_detalle.monto_cuota_regular_display.soles != null
                                    ? displayCurrency(venta.plan_pago_detalle.monto_cuota_regular_display.soles)
                                    : '-')
                        }</div>
                        <div className={styles.detailItem}><strong>Inicio Pagos:</strong> {displayDate(venta.plan_pago_detalle.fecha_inicio_pago_cuotas)}</div>
                        <div className={styles.detailItem}><strong>Saldo:</strong> {esDolares && venta.plan_pago_detalle.saldo_total_dolares != null ? `$${Number(venta.plan_pago_detalle.saldo_total_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : (() => { let saldoTotal = 0; if (venta.plan_pago_detalle && venta.plan_pago_detalle.cuotas) { saldoTotal = venta.plan_pago_detalle.cuotas.reduce((acc, c) => acc + (c.saldo_cuota_display && c.saldo_cuota_display.soles ? Number(c.saldo_cuota_display.soles) : 0), 0); return displayCurrency(saldoTotal); } return '-'; })()}</div>
                        <div className={styles.detailItem}><strong>Pagado:</strong> {displayCurrency((venta.plan_pago_detalle && venta.plan_pago_detalle.monto_pagado_actual != null) ? venta.plan_pago_detalle.monto_pagado_actual : venta.monto_pagado_actual)}</div>
                    </div>
                    
                    <div className={styles.tableResponsiveWrapper}>
                        {(() => {
                            // 1. Cuotas actuales (pendientes o activas)
                            const cuotasActuales = venta.plan_pago_detalle.cuotas || [];
                            // 2. Cuotas pagadas (reconstruidas desde los pagos)
                            const cuotasPagadas = (venta.registros_pago || [])
                                .filter(p => p.cuota_info && p.cuota_info.estado_cuota === 'pagada')
                                .map(p => p.cuota_info)
                                .filter((c, idx, arr) => arr.findIndex(x => x.id_cuota === c.id_cuota) === idx && !cuotasActuales.some(ca => ca.id_cuota === c.id_cuota));
                            // 3. Unir y ordenar por número de cuota
                            const todasLasCuotas = [...cuotasActuales, ...cuotasPagadas].sort((a, b) => a.numero_cuota - b.numero_cuota);
                            return (
                                <table className={`${tableStyles.table} ${styles.dataTableFix}`} style={{width: '100%'}}>
                                    <thead>
                                        <tr>
                                            <th style={{width:'4%'}}>N°</th>
                                            <th style={{width:'10%'}}>Vencimiento</th>
                                            <th style={{width:'13%'}} className={tableStyles.textAlignRight}>{esDolares ? 'Prog. ($)' : 'Prog. (S/.)'}</th>
                                            <th style={{width:'13%'}} className={tableStyles.textAlignRight}>{esDolares ? 'Pagado ($)' : 'Pagado (S/.)'}</th>
                                            <th style={{width:'13%'}} className={tableStyles.textAlignRight}>Pagado (S/.)</th>
                                            <th style={{width:'10%'}} className={tableStyles.textAlignRight}>Tipo de Cambio</th>
                                            {!esDolares && <th style={{width:'13%'}} className={tableStyles.textAlignRight}>Saldo (S/.)</th>}
                                            <th style={{width:'13%'}}>Estado</th>
                                            <th style={{width:'13%'}}>Fec. Pago Efect.</th>
                                            <th style={{width:'11%', textAlign: 'center'}}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {todasLasCuotas.map(cuota => (
                                            <tr key={cuota.id_cuota} className={cuota.estado_cuota === 'pagada' ? styles.rowPagada : ((cuota.estado_cuota === 'atrasada' || cuota.estado_cuota === 'vencida_no_pagada') ? styles.rowAtrasada : '')}>
                                                <td>{cuota.numero_cuota}</td>
                                                <td>{displayDate(cuota.fecha_vencimiento)}</td>
                                                <td className={tableStyles.textAlignRight}>{esDolares && cuota.monto_programado_display?.dolares != null ? `$${Number(cuota.monto_programado_display.dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : displayCurrency(cuota.monto_programado)}</td>
                                                <td className={tableStyles.textAlignRight}>{esDolares && cuota.monto_pagado_dolares != null ? `$${Number(cuota.monto_pagado_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : displayCurrency(cuota.monto_pagado)}</td>
                                                <td className={tableStyles.textAlignRight}>{cuota.monto_pagado_soles != null ? displayCurrency(cuota.monto_pagado_soles) : '-'}</td>
                                                <td className={tableStyles.textAlignRight}>{cuota.tipo_cambio_pago != null ? Number(cuota.tipo_cambio_pago).toFixed(3) : '-'}</td>
                                                {!esDolares && <td className={tableStyles.textAlignRight}>{cuota.saldo_cuota_display && cuota.saldo_cuota_display.soles != null ? displayCurrency(cuota.saldo_cuota_display.soles) : '-'}</td>}
                                                <td><span className={`${styles.statusBadge} ${styles['statusBadgeCuota' + cuota.estado_cuota?.replace(/\s+/g, '').replace(/_/g, '')]}`}>{cuota.estado_cuota === 'pagada' ? 'Pagada' : displayValue(cuota.estado_cuota_display)}</span></td>
                                                <td>{displayDate(cuota.fecha_pago_efectivo)}</td>
                                                <td className={tableStyles.actionButtons} style={{justifyContent: 'center'}}>
                                                    {cuota.estado_cuota !== 'pagada' && Decimal(cuota.saldo_cuota).greaterThan(0) && (
                                                        <button 
                                                            onClick={() => handleOpenPagoModal(cuota, cuota.saldo_cuota)}
                                                            className={`${tableStyles.button} ${styles.payCuotaButton}`}
                                                            title={`Registrar pago para cuota N° ${cuota.numero_cuota}`}
                                                        >
                                                            Pagar Cuota
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            );
                        })()}
                    </div>
                    {venta.plan_pago_detalle.observaciones && (
                        <div className={styles.detailItemFull} style={{marginTop: '15px'}}>
                            <strong>Observaciones del Plan:</strong> <pre className={styles.preformattedText}>{displayValue(venta.plan_pago_detalle.observaciones)}</pre>
                        </div>
                    )}
                </div>
            )}

<div className={styles.actionsContainer}>
            <Link 
                to="/ventas" 
                // Aplicar clases: base, de color, y específica si la tienes
                className={`${styles.detailButton} ${styles.detailButtonSecondary} ${styles.backButton}`}
            >
                Volver al Listado
            </Link>
            </div>

            <RegistroPagoForm
                show={isPagoModalOpen}
                onClose={handleClosePagoModal}
                onSubmit={handleSubmitPago}
                ventaId={idVenta}
                initialData={null}
                cuotaTarget={cuotaParaPago}
                montoSugerido={montoSugeridoParaPago}
                esDolares={esDolares}
            />
        </div>
    );
}

export default VentaDetailPage;