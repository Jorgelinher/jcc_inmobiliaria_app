// src/pages/AsesorDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService';
import styles from './DetailPage.module.css'; // Usará DetailPage.module.css

function AsesorDetailPage() {
    const { idAsesor } = useParams();
    const navigate = useNavigate(); // Añadido por si se usa para editar
    const [asesor, setAsesor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAsesorDetalle = useCallback(async () => {
        if (!idAsesor) {
            setError("ID de Asesor no proporcionado.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getAsesorById(idAsesor);
            setAsesor(response.data);
        } catch (err) {
            console.error("Error cargando detalle del asesor:", err.response?.data || err.message);
            setError(err.response?.data?.detail || err.message || "No se pudo cargar el detalle del asesor.");
        } finally {
            setLoading(false);
        }
    }, [idAsesor]);

    useEffect(() => {
        fetchAsesorDetalle();
    }, [fetchAsesorDetalle]);

    const displayValue = (value, fallback = '-') => (value !== null && value !== undefined && value !== '') ? value : fallback;
    
    const displayDate = (dateStr) => {
        if (!dateStr) return '-';
        try {
            // Asumir que la fecha viene como YYYY-MM-DD del backend
            const dateObj = new Date(dateStr + 'T00:00:00Z'); // Tratar como UTC
            if (isNaN(dateObj.getTime())) { return dateStr; } // Devolver original si no es parseable
            return dateObj.toLocaleDateString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
            });
        } catch (e) { return dateStr; }
    };

    const displayDateTime = (dateTimeStr) => {
        if (!dateTimeStr) return '-';
        try {
            // Asumir que dateTimeStr es una cadena ISO 8601 completa
            return new Date(dateTimeStr).toLocaleString('es-PE', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
                timeZone: 'America/Lima' // O la zona horaria que prefieras mostrar
            });
        } catch (e) { return dateTimeStr; }
    };

    if (loading) return <div className={styles.loadingMessage}>Cargando detalle del asesor...</div>;
    
    if (error) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Error</h1>
            <div className={`${styles.errorMessageCommon || styles.errorMessage} ${styles.marginBottom}`}>{error}</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link to="/asesores" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}>
                    Volver al listado
                </Link>
            </div>
        </div>
    );

    if (!asesor) return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Asesor no Encontrado</h1>
            <div className={styles.noDataMessage}>No se encontró el asesor.</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link to="/asesores" className={`${styles.detailButton} ${styles.detailButtonSecondary}`}>
                    Volver al listado
                </Link>
            </div>
        </div>
    );
    
    return (
        <div className={styles.pageContainer}>
            <div className={styles.headerActions}>
                <h1 className={styles.title}>Detalle del Asesor: {asesor.nombre_asesor || asesor.id_asesor}</h1>
                {/* Futuro Botón de Editar Asesor
                <button 
                    onClick={() => navigate('/asesores', { state: { accion: 'editarAsesor', idAsesorAEditar: asesor.id_asesor } })}
                    className={`${styles.detailButton} ${styles.detailButtonPrimary}`}
                >
                    Editar Asesor
                </button> 
                */}
            </div>
            
            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Información Principal y Laboral</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>ID Asesor:</strong> <span>{displayValue(asesor.id_asesor)}</span></div>
                    <div className={styles.detailItem}><strong>Nombre Completo:</strong> <span>{displayValue(asesor.nombre_asesor)}</span></div>
                    <div className={styles.detailItem}><strong>DNI:</strong> <span>{displayValue(asesor.dni)}</span></div>
                    <div className={styles.detailItem}><strong>Fecha de Ingreso:</strong> <span>{displayDate(asesor.fecha_ingreso)}</span></div>
                    <div className={styles.detailItem}><strong>Referidor (Líder):</strong> <span>{displayValue(asesor.nombre_referidor || asesor.id_referidor)}</span></div>
                    <div className={styles.detailItem}><strong>Fecha Cambio a Socio:</strong> <span>{displayDate(asesor.fecha_cambio_socio)}</span></div>
                </div>
            </div>

            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Datos Personales</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>Fecha de Nacimiento:</strong> <span>{displayDate(asesor.fecha_nacimiento)}</span></div>
                    <div className={styles.detailItem}><strong>Estado Civil:</strong> <span>{displayValue(asesor.estado_civil_display || asesor.estado_civil)}</span></div>
                    <div className={styles.detailItem}><strong>Número de Hijos:</strong> <span>{displayValue(asesor.numero_hijos)}</span></div>
                    <div className={styles.detailItemFull}><strong>Dirección de Domicilio:</strong> <span>{displayValue(asesor.direccion_domicilio)}</span></div>
                    <div className={styles.detailItem}><strong>Teléfono Personal:</strong> <span>{displayValue(asesor.telefono_personal)}</span></div>
                    <div className={styles.detailItem}><strong>Email Personal:</strong> <span>{displayValue(asesor.email_personal)}</span></div>
                </div>
            </div>

            <div className={styles.sectionContainer}>
                <h2 className={styles.sectionTitle}>Información Bancaria</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>Banco Preferido:</strong> <span>{displayValue(asesor.banco_preferido)}</span></div>
                    <div className={styles.detailItem}><strong>N° Cuenta Bancaria:</strong> <span>{displayValue(asesor.numero_cuenta_bancaria)}</span></div>
                    <div className={styles.detailItem}><strong>CCI Cuenta Bancaria:</strong> <span>{displayValue(asesor.cci_cuenta_bancaria)}</span></div>
                </div>
            </div>

            {asesor.observaciones_asesor && (
                <div className={styles.sectionContainer}>
                    <h2 className={styles.sectionTitle}>Observaciones Adicionales</h2>
                    <div className={styles.detailItemFull}>
                        <pre className={styles.preformattedText}>{asesor.observaciones_asesor}</pre>
                    </div>
                </div>
            )}

            <div className={styles.sectionContainer}>
                 <h2 className={styles.sectionTitle}>Auditoría</h2>
                <div className={styles.detailGrid}>
                    <div className={styles.detailItem}><strong>Fecha de Registro:</strong> <span>{displayDateTime(asesor.fecha_registro_sistema)}</span></div>
                    <div className={styles.detailItem}><strong>Última Modificación:</strong> <span>{displayDateTime(asesor.ultima_modificacion_sistema)}</span></div>
                </div>
            </div>

            <div className={styles.actionsContainer}>
                <Link 
                    to="/asesores" 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`} // Aplicar clases de botón secundario
                >
                    Volver al Listado
                </Link>
            </div>
        </div>
    );
}

export default AsesorDetailPage;