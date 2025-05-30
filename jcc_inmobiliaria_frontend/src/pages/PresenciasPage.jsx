// src/pages/PresenciasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService';
import PresenciaForm from '../components/forms/PresenciaForm';
import styles from './PresenciasPage.module.css'; // Usará el PresenciasPage.module.css actualizado

// --- INICIO: Funciones de Formato ---
const displayDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return '-';
    try {
        const dateObj = new Date(dateTimeStr);
        if (isNaN(dateObj.getTime())) return dateTimeStr; // Devolver original si no es parseable
        // Ajustar para mostrar hora local del navegador (o especificar timeZone si las fechas son UTC)
        return dateObj.toLocaleString('es-PE', { 
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: true 
        });
    } catch (e) {
        console.error("Error formateando fecha-hora:", dateTimeStr, e);
        return dateTimeStr;
    }
};
// --- FIN: Funciones de Formato ---

function PresenciasPage() {
    const [presencias, setPresencias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPresencia, setEditingPresencia] = useState(null);
    const navigate = useNavigate();

    const [filters, setFilters] = useState({
        fecha_presencia_after: '',
        fecha_presencia_before: '',
        cliente_nombre: '',
        proyecto_interes: '',
        modalidad: '',
        status_presencia: '',
        resultado_interaccion: '',
        asesor_closer_nombre: '', // O el asesor más relevante para filtrar
    });

    const fetchPresencias = useCallback(async (currentFilters) => {
        setLoading(true);
        setError(null);
        console.log("[PresenciasPage] Fetching presencias con filtros:", currentFilters);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([_, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
            
            const queryParams = new URLSearchParams(activeFilters).toString();
            const response = await apiService.getPresencias(queryParams);
            console.log("[PresenciasPage] API response getPresencias:", response);
            setPresencias(response.data.results || response.data || []);
        } catch (err) {
            console.error("[PresenciasPage] Error al cargar las presencias:", err.response?.data || err.message || err);
            let errorMessage = "Error al cargar las presencias.";
            if (err.response) { 
                errorMessage += ` (Status: ${err.response.status})`;
                if (err.response.data && typeof err.response.data === 'object') {
                     errorMessage += ` Detalle: ${JSON.stringify(err.response.data)}`;
                } else if (err.response.data) {
                     errorMessage += ` Detalle: ${err.response.data}`;
                }
            } else if (err.request) { 
                errorMessage += " El servidor no responde."; 
            } else { 
                errorMessage += ` ${err.message}`; 
            }
            setError(errorMessage);
            setPresencias([]);
        } finally { 
            setLoading(false); 
        }
    }, []);

    useEffect(() => {
        fetchPresencias(filters);
    }, [filters, fetchPresencias]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({ ...prevFilters, [name]: value }));
    };
    
    const resetFilters = () => {
        setFilters({
            fecha_presencia_after: '', fecha_presencia_before: '', cliente_nombre: '',
            proyecto_interes: '', modalidad: '', status_presencia: '',
            resultado_interaccion: '', asesor_closer_nombre: '',
        });
    };

    const handleOpenModal = (presencia = null) => { 
        setEditingPresencia(presencia);
        setIsModalOpen(true); 
        setError(null);
    };
    const handleCloseModal = () => { 
        setIsModalOpen(false); 
        setEditingPresencia(null); 
        setError(null);
         // Limpiar el estado de navegación si se estaba editando desde otra página
        if (location.state?.accion === 'editarPresencia') {
            navigate(location.pathname, { replace: true, state: {} });
        }
    };

    const handleSubmitPresencia = async (presenciaDataFromForm, idPresenciaBeingEdited) => {
        setError(null); 
        console.log(`[PresenciasPage] handleSubmitPresencia - Editando ID: ${idPresenciaBeingEdited}, Data:`, presenciaDataFromForm);
        try {
            let response;
            if (idPresenciaBeingEdited) {
                response = await apiService.updatePresencia(idPresenciaBeingEdited, presenciaDataFromForm);
                alert('Presencia actualizada con éxito!');
            } else {
                response = await apiService.createPresencia(presenciaDataFromForm);
                 alert(`Nueva presencia registrada con éxito! ID: ${response.data.id_presencia}`);
            }
            console.log("[PresenciasPage] API response (create/update):", response);
            handleCloseModal();
            await fetchPresencias(filters);

            if (response.data && response.data.id_presencia) {
                setTimeout(() => {
                    navigate(`/presencias/${response.data.id_presencia}`);
                }, 100);
            }
        } catch (err) {
            console.error("[PresenciasPage] Error al guardar la presencia:", err.response || err.message || err);
            const errorData = err.response?.data;
            let submitErrorMessage = "Error al registrar/actualizar la presencia.";
            if (errorData) {
                 if (typeof errorData === 'string') submitErrorMessage = errorData;
                 else if (errorData.detail) submitErrorMessage = errorData.detail;
                 else if (typeof errorData === 'object') { 
                    submitErrorMessage = Object.entries(errorData)
                        .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                        .join('; ');
                 }
            } else if (err.message) {
                submitErrorMessage = err.message;
            }
            setError(submitErrorMessage);
        }
    };

    const handleDeletePresencia = async (presenciaId) => {
        if (window.confirm(`¿Está seguro de que quiere eliminar la presencia ID ${presenciaId}?`)) {
            setError(null);
            try {
                await apiService.deletePresencia(presenciaId);
                alert('Presencia eliminada con éxito!');
                fetchPresencias(filters); 
            } catch (err) { 
                console.error("Error eliminando presencia:", err.response?.data || err.message || err);
                alert(`Error al eliminar la presencia: ${err.response?.data?.detail || err.message || 'Error desconocido.'}`);
            }
        }
    };
    
    const showInitialLoading = loading && presencias.length === 0 && !Object.values(filters).some(f => f !== '');
    const showFilteringMessage = loading && (presencias.length > 0 || Object.values(filters).some(f => f !== ''));

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Listado de Presencias</h1>

            <div className={styles.filterContainerPresencias}> {/* Usar la clase específica si se definió en el CSS */}
                <input type="datetime-local" name="fecha_presencia_after" value={filters.fecha_presencia_after} onChange={handleFilterChange} className={styles.filterInput} title="Fecha Presencia Desde"/>
                <input type="datetime-local" name="fecha_presencia_before" value={filters.fecha_presencia_before} onChange={handleFilterChange} className={styles.filterInput} title="Fecha Presencia Hasta"/>
                <input type="text" name="cliente_nombre" placeholder="Nombre Cliente..." value={filters.cliente_nombre} onChange={handleFilterChange} className={styles.filterInput}/>
                <input type="text" name="proyecto_interes" placeholder="Proyecto Interés..." value={filters.proyecto_interes} onChange={handleFilterChange} className={styles.filterInput}/>
                <select name="modalidad" value={filters.modalidad} onChange={handleFilterChange} className={styles.filterSelect}>
                    <option value="">Toda Modalidad</option>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual</option>
                </select>
                <select name="status_presencia" value={filters.status_presencia} onChange={handleFilterChange} className={styles.filterSelect}>
                    <option value="">Todo Estado Presencia</option>
                    <option value="agendada">Agendada</option>
                    <option value="realizada">Realizada</option>
                    <option value="reprogramada">Reprogramada</option>
                    <option value="cancelada_cliente">Cancelada por Cliente</option>
                    <option value="no_asistio">No Asistió</option>
                    <option value="caida_proceso">Caída en Proceso</option>
                </select>
                <input type="text" name="asesor_closer_nombre" placeholder="Asesor Closer..." value={filters.asesor_closer_nombre} onChange={handleFilterChange} className={styles.filterInput}/>
                <button onClick={resetFilters} className={styles.resetButton}>Limpiar Filtros</button>
            </div>

            <div className={styles.createButtonContainer}>
                <button onClick={() => handleOpenModal(null)} className={styles.createButton}>Registrar Nueva Presencia</button>
            </div>

            {error && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{error}</div>}
            {showInitialLoading && <div className={styles.loadingMessage}>Cargando presencias...</div>}
            {showFilteringMessage && <div className={styles.loadingMessage}>Aplicando filtros y cargando...</div>}
            
            {!loading && presencias.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay presencias para mostrar con los filtros actuales.</p>
            )}

            {presencias.length > 0 && (
                <div className={styles.tableResponsiveContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Fecha y Hora</th>
                                <th>Cliente</th>
                                <th>Proyecto</th>
                                <th>Asesor Closer</th>
                                <th>Modalidad</th>
                                <th>Status</th>
                                <th>Resultado</th>
                                <th>Venta ID</th>
                                <th style={{minWidth: '180px'}}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {presencias.map(p => (
                                <tr key={p.id_presencia}>
                                    <td data-label="ID">{p.id_presencia}</td>
                                    <td data-label="Fecha y Hora">{displayDateTime(p.fecha_hora_presencia)}</td>
                                    <td data-label="Cliente">{p.cliente_detalle?.nombres_completos_razon_social || p.cliente_nombre || p.cliente}</td>
                                    <td data-label="Proyecto">{p.proyecto_interes}</td>
                                    <td data-label="Asesor Closer">{p.asesor_closer_nombre || (p.asesor_closer ? p.asesor_closer.nombre_asesor : '-')}</td>
                                    <td data-label="Modalidad">{p.modalidad_display || p.modalidad}</td>
                                    <td data-label="Status">
                                        <span className={`${styles.statusBadge} ${styles['statusBadge' + p.status_presencia?.toLowerCase().replace(/\s+/g, '').replace(/_/g, '')]}`}>
                                            {p.status_presencia_display || p.status_presencia}
                                        </span>
                                    </td>
                                    <td data-label="Resultado">{p.resultado_interaccion_display || p.resultado_interaccion || '-'}</td>
                                    <td data-label="Venta ID">
                                        {p.venta_asociada_id_str ? 
                                            <Link to={`/ventas/${p.venta_asociada_id_str}`}>{p.venta_asociada_id_str}</Link>
                                            : (p.venta_asociada || '-')}
                                    </td>
                                    <td data-label="Acciones" className={styles.actionButtons}>
                                        <Link to={`/presencias/${p.id_presencia}`} className={`${styles.button} ${styles.viewButton}`}>Ver</Link>
                                        <button onClick={() => handleOpenModal(p)} className={`${styles.button} ${styles.editButton}`}>Editar</button>
                                        <button onClick={() => handleDeletePresencia(p.id_presencia)} className={`${styles.button} ${styles.deleteButton}`}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {isModalOpen && (
                <PresenciaForm 
                    show={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSubmit={handleSubmitPresencia} 
                    initialData={editingPresencia}
                />
            )}
        </div>
    );
}
export default PresenciasPage;