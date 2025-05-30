// src/pages/ActividadDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react'; // useCallback añadido por si se usa en el futuro
import { useParams, Link } from 'react-router-dom';
import * as apiService from '../services/apiService';
import styles from './DetailPage.module.css'; // Asegúrate que este archivo tenga los estilos de botón

function ActividadDetailPage() {
    const { idActividad } = useParams();
    const [actividad, setActividad] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Usar useCallback para fetchActividadDetalle
    const fetchActividadDetalle = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getActividadDiariaById(idActividad);
            setActividad(response.data);
        } catch (err) {
            console.error("Error cargando detalle de la actividad:", err.response?.data || err.message);
            setError(err.response?.data?.detail || err.message || "No se pudo cargar el detalle de la actividad.");
        } finally {
            setLoading(false);
        }
    }, [idActividad]); // Dependencia correcta

    useEffect(() => {
        if (idActividad) {
            fetchActividadDetalle();
        }
    }, [idActividad, fetchActividadDetalle]); // fetchActividadDetalle ahora es dependencia

    if (loading) return <div className={styles.loadingMessage}>Cargando detalle de la actividad...</div>;
    
    // Ajustar cómo se muestra el botón de volver cuando hay error o no se encuentra la actividad
    if (error) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Error</h1>
            <div className={`${styles.errorMessageCommon} ${styles.marginBottom}`}>{error}</div> {/* Usar clase de error común */}
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link to="/actividades" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}>
                    Volver al listado
                </Link>
            </div>
        </div>
    );
    if (!actividad) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Actividad no Encontrada</h1>
            <div className={styles.noDataMessage}>No se encontró la actividad.</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link to="/actividades" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}>
                    Volver al listado
                </Link>
            </div>
        </div>
    );
    
    const displayValue = (value) => (value !== null && value !== undefined && value !== '') ? value : '-';
    const displayDate = (dateStr) => { // Consistente con otras páginas
        if (!dateStr) return '-';
        try {
            const dateObj = new Date(dateStr + 'T00:00:00Z'); // Asumir que la fecha viene como YYYY-MM-DD
            if (isNaN(dateObj.getTime())) return dateStr;
            return dateObj.toLocaleDateString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
            });
        } catch (e) { return dateStr; }
    };

    return (
        <div className={styles.pageContainer}> {/* Fondo de app #F8F9FA */}
            <div className={styles.headerActions}>
                 <h1 className={styles.title}>Detalle de Actividad Diaria: ID {actividad.id_actividad}</h1>
                 {/* Aquí podrías poner un botón de Editar Actividad si lo implementas */}
            </div>
            
            <div className={styles.sectionContainer}> {/* Fondo blanco, borde, sombra */}
                <h2 className={styles.sectionTitle}>Información de la Actividad</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>ID Actividad:</strong> {displayValue(actividad.id_actividad)}</div>
                    <div className={styles.detailItem}><strong>Fecha:</strong> {displayDate(actividad.fecha_actividad)}</div>
                    <div className={styles.detailItem}><strong>Asesor:</strong> 
                        {actividad.asesor ? 
                            (<Link to={`/asesores/${actividad.asesor.id_asesor}`}>{displayValue(actividad.asesor_nombre || actividad.asesor.nombre_asesor)}</Link>) 
                            : displayValue(actividad.asesor_nombre)
                        }
                    </div>
                    <div className={styles.detailItem}><strong>Datos Captados OPC:</strong> {displayValue(actividad.datos_captados_opc)}</div>
                    <div className={styles.detailItem}><strong>Datos Gestionados (Llamadas):</strong> {displayValue(actividad.llamadas_realizadas)}</div>
                    <div className={styles.detailItem}><strong>Presencias Generadas:</strong> {displayValue(actividad.presencias_generadas)}</div>
                    <div className={styles.detailItemFull}><strong>Notas:</strong> 
                        <pre className={styles.preformattedText}>{displayValue(actividad.notas_actividad)}</pre>
                    </div>
                </div>
            </div>

            <div className={styles.actionsContainer}>
                <Link 
                    to="/actividades" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`} // Aplicar clases de botón secundario
                >
                    Volver al Listado
                </Link>
            </div>
        </div>
    );
}

export default ActividadDetailPage;