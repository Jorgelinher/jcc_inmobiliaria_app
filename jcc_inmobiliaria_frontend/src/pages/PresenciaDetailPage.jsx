// src/pages/PresenciaDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService';
import styles from './DetailPage.module.css'; // Usará DetailPage.module.css



function PresenciaDetailPage() {
    const { idPresencia } = useParams();
    const navigate = useNavigate();
    const [presencia, setPresencia] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPresenciaDetalle = useCallback(async () => {
        if (!idPresencia) {
            setError("No se proporcionó un ID de presencia para cargar.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getPresenciaById(idPresencia);
            if (response.data) {
                setPresencia(response.data);
            } else {
                setError("La respuesta del API no tiene el formato esperado.");
                setPresencia(null);
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || "Ocurrió un error al cargar el detalle de la presencia.");
            setPresencia(null);
        } finally {
            setLoading(false);
        }
    }, [idPresencia]);

    useEffect(() => {
        fetchPresenciaDetalle();
    }, [fetchPresenciaDetalle]);

    const displayValue = (value, suffix = '') => (value !== null && value !== undefined && value !== '') ? `${value}${suffix}` : '-';
    const displayDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return '-';
        try {
            const dateObj = new Date(dateTimeStr);
            if (isNaN(dateObj.getTime())) return dateTimeStr;
            return dateObj.toLocaleString('es-PE', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: true,
                // timeZone: 'UTC' // Ajusta si tus fechas son UTC y quieres mantener esa visualización
            });
        } catch (e) { return dateTimeStr; }
    };
    
    const handleEditPresencia = () => {
        if (presencia && presencia.id_presencia) {
            // Navegar a la página de listado de presencias con estado para abrir el modal
            navigate('/presencias', { 
                state: { 
                    accion: 'editarPresenciaDesdeDetalle', 
                    idPresenciaAEditar: presencia.id_presencia 
                } 
            });
        }
    };

    if (loading) return <div className={styles.loadingMessage}>Cargando detalle de la presencia...</div>;
    
    if (error) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Error al Cargar Presencia</h1>
            <div className={`${styles.errorMessageCommon || styles.errorMessage} ${styles.marginBottom}`}>{error}</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link 
                    to="/presencias" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                >
                    Volver al Listado
                </Link>
            </div>
        </div>
    );

    if (!presencia) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Presencia no Encontrada</h1>
            <div className={styles.noDataMessage} style={{textAlign: 'center', padding: '20px'}}>No se encontró información para la presencia solicitada.</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link 
                    to="/presencias" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                >
                    Volver al Listado
                </Link>
            </div>
        </div>
    );
    
    const clienteInfo = presencia.cliente_detalle || {}; 

    return (
        <div className={styles.pageContainer}> {/* Fondo de app #F8F9FA */}
            <div className={styles.headerActions}> {/* Contenedor para título y botón de editar */}
                <h1 className={styles.title}>Detalle de Presencia: ID {presencia.id_presencia}</h1>
                <button 
                    onClick={handleEditPresencia}
                    className={`${styles.detailButton} ${styles.detailButtonPrimary}`} // Estilo primario
                >
                    Editar Presencia
                </button>
            </div>
            
            <div className={styles.sectionContainer}> {/* Tarjeta blanca con borde y sombra */}
                <h2 className={styles.sectionTitle}>Información del Cliente</h2>
                <div className={styles.detailGrid} style={{gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'}}>
                    <div className={styles.detailItem}><strong>Nombre/Razón Social:</strong> <span>{displayValue(clienteInfo.nombres_completos_razon_social)}</span></div>
                    <div className={styles.detailItem}><strong>Tipo Documento:</strong> <span>{displayValue(clienteInfo.tipo_documento)}</span></div>
                    <div className={styles.detailItem}><strong>N° Documento:</strong> <span>{displayValue(clienteInfo.numero_documento)}</span></div>
                    <div className={styles.detailItem}><strong>Email Principal:</strong> <span>{displayValue(clienteInfo.email_principal)}</span></div>
                    <div className={styles.detailItem}><strong>Teléfono Principal:</strong> <span>{displayValue(clienteInfo.telefono_principal)}</span></div>
                    <div className={styles.detailItem}><strong>Dirección:</strong> <span>{displayValue(clienteInfo.direccion)}</span></div>
                    {clienteInfo.id_cliente && (
                        <div className={styles.detailItemFull} style={{ marginTop: '15px', marginBottom: '5px' }}> {/* Reducir margen inferior */}
                            <Link 
                                to={`/clientes/${clienteInfo.id_cliente}`} 
                                className={`${styles.detailButton} ${styles.detailButtonAccent}`} // Botón con color de acento
                            >
                                Ver Perfil Completo del Cliente
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Detalles de la Presencia</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>ID Presencia:</strong> <span>{displayValue(presencia.id_presencia)}</span></div>
                    <div className={styles.detailItem}><strong>Fecha y Hora:</strong> <span>{displayDateTime(presencia.fecha_hora_presencia)}</span></div>
                    <div className={styles.detailItem}><strong>Proyecto Interés:</strong> <span>{displayValue(presencia.proyecto_interes)}</span></div>
                    <div className={styles.detailItem}>
                        <strong>Lote Interés Inicial:</strong> 
                        <span>
                            {presencia.lote_interes_inicial ? 
                                <Link to={`/lotes/${typeof presencia.lote_interes_inicial === 'object' ? presencia.lote_interes_inicial.id_lote : presencia.lote_interes_inicial}`}>
                                    {displayValue(presencia.lote_interes_inicial_id_str || (typeof presencia.lote_interes_inicial === 'object' ? presencia.lote_interes_inicial.id_lote : presencia.lote_interes_inicial))}
                                </Link> 
                                : '-'}
                        </span>
                    </div>
                    
                    <div className={styles.detailItemFull} style={{marginTop: 'var(--spacing-sm)'}}><strong>Asesores:</strong></div>
                    <div className={styles.detailItemSub}><strong>Medio Captación:</strong> <span>{displayValue(presencia.medio_captacion_display || presencia.medio_captacion)}</span></div>
                    <div className={styles.detailItemSub}><strong>Asesor Captación:</strong> <span>{displayValue(presencia.asesor_captacion_opc_nombre || presencia.asesor_captacion_opc?.nombre_asesor || (presencia.asesor_captacion_opc ? `ID: ${presencia.asesor_captacion_opc}` : '-'))}</span></div>
                    <div className={styles.detailItemSub}><strong>Asesor Call:</strong> <span>{displayValue(presencia.asesor_call_agenda_nombre || presencia.asesor_call_agenda?.nombre_asesor || (presencia.asesor_call_agenda ? `ID: ${presencia.asesor_call_agenda}` : '-'))}</span></div>
                    <div className={styles.detailItemSub}><strong>Asesor Liner:</strong> <span>{displayValue(presencia.asesor_liner_nombre || presencia.asesor_liner?.nombre_asesor || (presencia.asesor_liner ? `ID: ${presencia.asesor_liner}` : '-'))}</span></div>
                    <div className={styles.detailItemSub}><strong>Asesor Closer:</strong> <span>{displayValue(presencia.asesor_closer_nombre || presencia.asesor_closer?.nombre_asesor || (presencia.asesor_closer ? `ID: ${presencia.asesor_closer}` : '-'))}</span></div>

                    <div className={styles.detailItemFull} style={{marginTop: 'var(--spacing-sm)'}}><strong>Resultado:</strong></div>
                    <div className={styles.detailItemSub}><strong>Modalidad:</strong> <span>{displayValue(presencia.modalidad_display || presencia.modalidad)}</span></div>
                    <div className={styles.detailItemSub}><strong>Estado Presencia:</strong> 
                        <span className={`${styles.statusBadge} ${styles['statusBadge' + presencia.status_presencia?.toLowerCase().replace(/\s+/g, '').replace(/_/g, '')] || ''}`}>
                            {displayValue(presencia.status_presencia_display || presencia.status_presencia)}
                        </span>
                    </div>
                    <div className={styles.detailItemSub}><strong>Resultado Interacción:</strong> <span>{displayValue(presencia.resultado_interaccion_display || presencia.resultado_interaccion)}</span></div>
                    
                    <div className={styles.detailItem}>
                        <strong>Venta Asociada ID:</strong> 
                        <span>
                            {presencia.venta_asociada_id_str || presencia.venta_asociada ? 
                                <Link to={`/ventas/${presencia.venta_asociada_id_str || presencia.venta_asociada}`}>
                                    {displayValue(presencia.venta_asociada_id_str || presencia.venta_asociada)}
                                </Link> 
                                : '-'
                            }
                        </span>
                    </div>
                    <div className={styles.detailItemFull}><strong>Observaciones:</strong> <pre className={styles.preformattedText}>{displayValue(presencia.observaciones)}</pre></div>
                    <div className={styles.detailItem}><strong>Fecha Registro Sistema:</strong> <span>{displayDateTime(presencia.fecha_registro_sistema)}</span></div>
                    <div className={styles.detailItem}><strong>Última Modificación:</strong> <span>{displayDateTime(presencia.ultima_modificacion)}</span></div>
                </div>
            </div>

            <div className={styles.actionsContainer}>
                <Link 
                    to="/presencias" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                >
                    Volver al Listado de Presencias
                </Link>
            </div>
        </div>
    );
}

export default PresenciaDetailPage;