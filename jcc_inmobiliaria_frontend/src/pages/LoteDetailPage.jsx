// src/pages/LoteDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Añadir useNavigate si se usará para editar
import * as apiService from '../services/apiService';
import styles from './DetailPage.module.css'; // Asegúrate que DetailPage.module.css tenga los estilos de botón

function LoteDetailPage() {
    const { idLote } = useParams();
    const navigate = useNavigate(); // Para el botón de editar (opcional)
    const [lote, setLote] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchLoteDetalle = useCallback(async () => {
        if (!idLote) {
            setError("ID de Lote no proporcionado.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getLoteById(idLote);
            setLote(response.data);
        } catch (err) {
            console.error("Error cargando detalle del lote:", err);
            setError(err.response?.data?.detail || err.message || "No se pudo cargar el detalle del lote.");
        } finally {
            setLoading(false);
        }
    }, [idLote]);

    useEffect(() => {
        fetchLoteDetalle();
    }, [fetchLoteDetalle]);

    // Definir displayDateTime aquí si se usa en Auditoría, o importarlo si es global
    const displayDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return '-';
        try {
            return new Date(dateTimeStr).toLocaleString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                timeZone: 'UTC' // O tu zona horaria local si las fechas son naive
            });
        } catch (e) {
            return dateTimeStr;
        }
    };
    
    const displayValue = (value, suffix = '') => (value !== null && value !== undefined && value !== '') ? `${value}${suffix}` : '-';
    const displayCurrency = (value, currency = 'PEN') => {
        if (value !== null && value !== undefined && value !== '') {
            const numberValue = parseFloat(value);
            if (isNaN(numberValue)) return '-';
            return numberValue.toLocaleString('es-PE', { style: 'currency', currency: currency });
        }
        return '-';
    };

    if (loading) {
        return <div className={styles.loadingMessage}>Cargando detalle del lote...</div>;
    }
    if (error) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.errorMessage}>{error}</div>
                <div className={styles.actionsContainer} style={{ justifyContent: 'center', marginTop: '20px' }}>
                    <Link to="/lotes" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}> {/* Aplicar estilos de botón */}
                        Volver al listado
                    </Link>
                </div>
            </div>
        );
    }
    if (!lote) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.noDataMessage}>No se encontró el lote.</div>
                <div className={styles.actionsContainer} style={{ justifyContent: 'center', marginTop: '20px' }}>
                    <Link to="/lotes" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}> {/* Aplicar estilos de botón */}
                        Volver al listado
                    </Link>
                </div>
            </div>
        );
    }


    return (
        <div className={styles.pageContainer}> {/* Usa el fondo de app #F8F9FA */}
            <div className={styles.headerActions}> {/* Para título y posible botón de editar Lote */}
                <h1 className={styles.title}>Detalle del Lote: {lote.id_lote}</h1>
                {/* // Botón para editar el lote (requiere LoteForm y lógica en LotesPage)
                <button 
                    onClick={() => navigate('/lotes', { state: { accion: 'editarLote', idLoteAEditar: lote.id_lote } })}
                    className={`${styles.detailButton} ${styles.detailButtonPrimary}`}
                >
                    Editar Lote
                </button> 
                */}
            </div>
            
            <div className={styles.sectionContainer}> {/* Fondo blanco, borde, sombra */}
                <h2 className={styles.sectionTitle}>Información General del Lote</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>ID Lote:</strong> {displayValue(lote.id_lote)}</div>
                    <div className={styles.detailItem}><strong>Proyecto:</strong> {displayValue(lote.ubicacion_proyecto)}</div>
                    <div className={styles.detailItem}><strong>Manzana:</strong> {displayValue(lote.manzana)}</div>
                    <div className={styles.detailItem}><strong>N° Lote:</strong> {displayValue(lote.numero_lote)}</div>
                    <div className={styles.detailItem}><strong>Etapa:</strong> {displayValue(lote.etapa)}</div>
                    <div className={styles.detailItem}><strong>Estado:</strong> 
                        <span className={`${styles.statusBadge} ${styles['statusBadgeLote' + lote.estado_lote?.toLowerCase()] || ''}`}>
                            {displayValue(lote.estado_lote)}
                        </span>
                    </div>
                    <div className={styles.detailItem}><strong>Área (m²):</strong> {displayValue(lote.area_m2, ' m²')}</div>
                    <div className={styles.detailItem}><strong>Partida Registral:</strong> {displayValue(lote.partida_registral)}</div>
                    <div className={styles.detailItemFull}><strong>Colindancias:</strong> <pre className={styles.preformattedText}>{displayValue(lote.colindancias)}</pre></div>
                    <div className={styles.detailItemFull}><strong>Observaciones:</strong> <pre className={styles.preformattedText}>{displayValue(lote.observaciones_lote)}</pre></div>
                </div>
            </div>

            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Precios del Lote (S/.)</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>Precio Contado:</strong> {displayCurrency(lote.precio_lista_soles)}</div>
                    <div className={styles.detailItem}><strong>Precio Crédito 12 Meses:</strong> {displayCurrency(lote.precio_credito_12_meses_soles)}</div>
                    <div className={styles.detailItem}><strong>Precio Crédito 24 Meses:</strong> {displayCurrency(lote.precio_credito_24_meses_soles)}</div>
                    <div className={styles.detailItem}><strong>Precio Crédito 36 Meses:</strong> {displayCurrency(lote.precio_credito_36_meses_soles)}</div>
                </div>
                {lote.precio_lista_dolares && (
                    <>
                        {/* Si se usa H3, asegurar que los estilos de DetailPage.module.css lo cubran o usar sectionTitle */}
                        <h3 className={styles.subSectionTitle} style={{marginTop: '20px'}}>Precios del Lote ($)</h3> 
                        <div className={styles.detailGrid}>
                            <div className={styles.detailItem}><strong>Precio Dólares (Contado):</strong> {displayCurrency(lote.precio_lista_dolares, 'USD')}</div>
                        </div>
                    </>
                )}
            </div>
            
            <div className={styles.sectionContainer}>
                 <h2 className={styles.sectionTitle}>Auditoría</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>Fecha Creación:</strong> {displayDateTime(lote.fecha_creacion)}</div>
                    <div className={styles.detailItem}><strong>Última Modificación:</strong> {displayDateTime(lote.ultima_modificacion)}</div>
                </div>
            </div>

            <div className={styles.actionsContainer}>
                <Link 
                    to="/lotes" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary} ${styles.backButton}`} // Aplicar clases de botón secundario
                >
                    Volver al Listado de Lotes
                </Link>
            </div>
        </div>
    );
}

export default LoteDetailPage;