// src/pages/ActividadesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as apiService from '../services/apiService';
import ActividadDiariaForm from '../components/forms/ActividadDiariaForm';
import styles from './ActividadesPage.module.css'; // Usará el ActividadesPage.module.css actualizado

// --- INICIO: Funciones de Formato ---
const displayDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const dateObj = new Date(dateStr + 'T00:00:00Z');
        if (isNaN(dateObj.getTime())) return dateStr;
        return dateObj.toLocaleDateString('es-PE', {
            year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC'
        });
    } catch (e) {
        console.error("Error formateando fecha:", dateStr, e);
        return dateStr;
    }
};
// --- FIN: Funciones de Formato ---

function ActividadesPage() {
    const [actividades, setActividades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingActividad, setEditingActividad] = useState(null);
    
    const [filters, setFilters] = useState({
        fecha_actividad_after: '',
        fecha_actividad_before: '',
        asesor_nombre: ''
    });

    const fetchActividades = useCallback(async (currentFilters) => {
        setLoading(true);
        setError(null);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([_, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
            const queryParams = new URLSearchParams(activeFilters).toString();
            const response = await apiService.getActividadesDiarias(queryParams); 
            setActividades(response.data.results || response.data || []);
        } catch (err) {
            let errorMessage = "Error al cargar los datos de actividades.";
            if (err.response) { errorMessage += ` (Status: ${err.response.status}) Detalle: ${JSON.stringify(err.response.data)}`; } 
            else if (err.request) { errorMessage += " El servidor no responde."; } 
            else { errorMessage += ` ${err.message || 'Función no encontrada en apiService.'}`; }
            setError(errorMessage);
            setActividades([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchActividades(filters);
    }, [filters, fetchActividades]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({ ...prevFilters, [name]: value }));
    };
    
    const resetFilters = () => {
        setFilters({ fecha_actividad_after: '', fecha_actividad_before: '', asesor_nombre: '' });
    };

    const handleOpenModalForCreate = () => { setEditingActividad(null); setIsModalOpen(true); };
    const handleOpenModalForEdit = (actividad) => {
        const actividadDataForForm = {
            ...actividad,
            fecha_actividad: actividad.fecha_actividad ? actividad.fecha_actividad.split('T')[0] : '', // Ajustar formato de fecha para input
            asesor: actividad.asesor?.id_asesor || actividad.asesor, 
        };
        setEditingActividad(actividadDataForForm);
        setIsModalOpen(true);
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingActividad(null); };

    const handleSubmitActividad = async (formDataFromForm) => { // Cambiado 'formData' por 'formDataFromForm' para claridad
        try {
            setLoading(true);
            if (editingActividad && editingActividad.id_actividad) {
                await apiService.updateActividadDiaria(editingActividad.id_actividad, formDataFromForm);
                alert('Actividad actualizada con éxito!');
            } else {
                await apiService.createActividadDiaria(formDataFromForm);
                alert('Actividad registrada con éxito!');
            }
            handleCloseModal();
            fetchActividades(filters); 
        } catch (err) { 
            let submitErrorMessage = "Error al guardar la actividad.";
            if (err.response && err.response.data) {
                const errors = err.response.data;
                const formattedErrors = Object.entries(errors).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`).join('\n');
                submitErrorMessage += `\nDetalles:\n${formattedErrors}`;
            } else { submitErrorMessage += ` ${err.message || 'Error desconocido.'}`; }
            console.error("Error al guardar actividad:", err.response || err);
            alert(submitErrorMessage);
        } finally { setLoading(false); }
    };

    const handleDeleteActividad = async (actividadId) => {
        if (window.confirm(`¿Está seguro de que quiere eliminar la actividad ID ${actividadId}?`)) {
            try {
                setLoading(true);
                await apiService.deleteActividadDiaria(actividadId);
                alert('Actividad eliminada con éxito!');
                fetchActividades(filters); 
            } catch (err) {
                alert(`Error al eliminar la actividad: ${err.response?.data?.detail || err.message || 'Error desconocido.'}`);
            } finally {
                setLoading(false);
            }
        }
    };
    
    // No mostrar "Cargando lotes..." si ya hay lotes y se están aplicando filtros
    const showInitialLoading = loading && actividades.length === 0 && !Object.values(filters).some(f => f !== '');
    const showFilteringMessage = loading && (actividades.length > 0 || Object.values(filters).some(f => f !== ''));


    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Registro de Actividades Diarias</h1>
            
            {/* Aplicar la clase específica del contenedor de filtros si se usa un nombre diferente */}
            <div className={styles.filterContainerActividades}> 
                <input type="date" name="fecha_actividad_after" value={filters.fecha_actividad_after} onChange={handleFilterChange} className={styles.filterInputSmall} title="Fecha Actividad Desde"/>
                <input type="date" name="fecha_actividad_before" value={filters.fecha_actividad_before} onChange={handleFilterChange} className={styles.filterInputSmall} title="Fecha Actividad Hasta"/>
                <input type="text" name="asesor_nombre" placeholder="Nombre del Asesor..." value={filters.asesor_nombre} onChange={handleFilterChange} className={styles.filterInput}/>
                <button onClick={resetFilters} className={styles.resetButton}>Limpiar Filtros</button>
            </div>

            <div className={styles.createButtonContainer}>
                <button onClick={handleOpenModalForCreate} className={styles.createButton}>Registrar Nueva Actividad</button>
            </div>

            {error && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{error}</div>}
            {showInitialLoading && <div className={styles.loadingMessage}>Cargando actividades...</div>}
            {showFilteringMessage && <div className={styles.loadingMessage}>Aplicando filtros y cargando...</div>}
            
            {!loading && actividades.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay actividades para mostrar con los filtros actuales.</p>
            )}

{actividades.length > 0 && (
                 <div className={styles.tableResponsiveContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th><th>Fecha</th><th>Asesor</th>
                                <th className={styles.textAlignRight}>Datos OPC</th>
                                <th className={styles.textAlignRight}>Datos Gestionados</th>
                                <th className={styles.textAlignRight}>Presencias Gen.</th>
                                <th>Notas</th>
                                <th style={{minWidth: '220px'}}>Acciones</th> {/* Ajustar minWidth si es necesario para más botones */}
                            </tr>
                        </thead>
                        <tbody>
                            {actividades.map(act => (
                                <tr key={act.id_actividad}>
                                    <td data-label="ID">{act.id_actividad}</td>
                                    <td data-label="Fecha">{displayDate(act.fecha_actividad)}</td>
                                    <td data-label="Asesor">{act.asesor_nombre || act.asesor?.nombre_asesor || act.asesor}</td>
                                    <td data-label="Datos OPC" className={styles.textAlignRight}>{act.datos_captados_opc}</td>
                                    <td data-label="Datos Gestionados" className={styles.textAlignRight}>{act.llamadas_realizadas}</td>
                                    <td data-label="Presencias Gen." className={styles.textAlignRight}>{act.presencias_generadas}</td>
                                    <td data-label="Notas">{act.notas_actividad || '-'}</td>
                                    <td data-label="Acciones" className={styles.actionButtons}>
                                        {/* --- INICIO: BOTÓN "VER" AÑADIDO --- */}
                                        <Link 
                                            to={`/actividades/${act.id_actividad}`} 
                                            className={`${styles.button} ${styles.viewButton}`} // Usar las clases de botón definidas
                                        >
                                            Ver
                                        </Link>
                                        {/* --- FIN: BOTÓN "VER" AÑADIDO --- */}
                                        <button onClick={() => handleOpenModalForEdit(act)} className={`${styles.button} ${styles.editButton}`}>Editar</button>
                                        <button onClick={() => handleDeleteActividad(act.id_actividad)} className={`${styles.button} ${styles.deleteButton}`}>Eliminar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            )}
            {isModalOpen && (
                <ActividadDiariaForm 
                    show={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSubmit={handleSubmitActividad} 
                    initialData={editingActividad}
                />
            )}
        </div>
    );
}
export default ActividadesPage;