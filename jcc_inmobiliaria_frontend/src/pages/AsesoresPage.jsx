// src/pages/AsesoresPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as apiService from '../services/apiService';
import AsesorForm from '../components/forms/AsesorForm';
import styles from './AsesoresPage.module.css'; // Usará el AsesoresPage.module.css actualizado

// --- INICIO: Función de Formato de Fecha (si es necesaria) ---
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
// --- FIN: Función de Formato de Fecha ---

function AsesoresPage() {
    const [asesores, setAsesores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAsesor, setEditingAsesor] = useState(null);
    const [asesorMap, setAsesorMap] = useState({});

    // Estado de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const [filters, setFilters] = useState({
        nombre_asesor: '',
        tipo_asesor_actual: ''
    });

    const fetchAsesores = useCallback(async (currentFilters, page = 1, size = pageSize) => {
        setLoading(true);
        setError(null);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([key, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
            
            // Agregar parámetros de paginación
            activeFilters.page = page;
            activeFilters.page_size = size;
            
            const queryParams = new URLSearchParams(activeFilters).toString();
            console.log("[AsesoresPage] Fetching asesores con queryParams:", queryParams);
            const response = await apiService.getAsesores(queryParams);
            console.log("[AsesoresPage] Asesores response:", response.data);
            
            // Extraer datos paginados
            const fetchedAsesores = response.data.results || response.data || [];
            setAsesores(fetchedAsesores);
            setTotalCount(response.data.count || 0);
            setTotalPages(Math.ceil((response.data.count || 0) / size));
            setCurrentPage(page);

            const map = {};
            fetchedAsesores.forEach(a => { map[a.id_asesor] = a.nombre_asesor; });
            setAsesorMap(map);
        } catch (err) {
            let errorMessage = "Error al cargar los asesores.";
            if (err.response) { errorMessage += ` (Status: ${err.response.status}) Detalle: ${JSON.stringify(err.response.data)}`; } 
            else if (err.request) { errorMessage += " El servidor no responde."; } 
            else { errorMessage += ` ${err.message}`; }
            setError(errorMessage);
            setAsesores([]);
        } finally {
            setLoading(false);
        }
    }, []); // Remover pageSize de las dependencias para evitar ciclos

    useEffect(() => {
        fetchAsesores(filters, 1, pageSize);
    }, [filters, fetchAsesores]); // Remover pageSize del useEffect para evitar llamadas duplicadas
    
    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({ ...prevFilters, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({ nombre_asesor: '', tipo_asesor_actual: '' });
    };

    // Funciones de paginación
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchAsesores(filters, newPage, pageSize);
        }
    };

    const handlePageSizeChange = (newPageSize) => {
        setPageSize(newPageSize);
        setCurrentPage(1); // Reset a la primera página cuando cambia el tamaño
        // Llamar directamente a fetchAsesores con el nuevo tamaño
        fetchAsesores(filters, 1, newPageSize);
    };

    const handleOpenModalForCreate = () => { setEditingAsesor(null); setIsModalOpen(true); };
    const handleOpenModalForEdit = (asesor) => {
        const asesorDataForForm = { 
            ...asesor, 
            id_referidor: asesor.id_referidor?.id_asesor || asesor.id_referidor || '', 
            // Asegurar que la fecha_ingreso y fecha_nacimiento estén en formato YYYY-MM-DD para el input type="date"
            fecha_ingreso: asesor.fecha_ingreso ? asesor.fecha_ingreso.split('T')[0] : '',
            fecha_nacimiento: asesor.fecha_nacimiento ? asesor.fecha_nacimiento.split('T')[0] : '',
            fecha_cambio_socio: asesor.fecha_cambio_socio ? asesor.fecha_cambio_socio.split('T')[0] : null,

        };
        setEditingAsesor(asesorDataForForm);
        setIsModalOpen(true);
    };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingAsesor(null); };

    const handleSubmitAsesor = async (formDataFromForm) => { // formData renombrado
        try {
            setLoading(true);
            setError(null); // Limpiar errores
            if (editingAsesor && editingAsesor.id_asesor) {
                await apiService.updateAsesor(editingAsesor.id_asesor, formDataFromForm);
                alert('Asesor actualizado con éxito!');
            } else {
                await apiService.createAsesor(formDataFromForm);
                alert('Asesor creado con éxito!');
            }
            handleCloseModal();
            fetchAsesores(filters, currentPage, pageSize); 
        } catch (err) { 
            let submitErrorMessage = "Error al guardar el asesor.";
            if (err.response && err.response.data) {
                const errors = err.response.data;
                const formattedErrors = Object.entries(errors)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                    .join('\n');
                submitErrorMessage += `\nDetalles:\n${formattedErrors}`;
            } else {
                submitErrorMessage += ` ${err.message || 'Error desconocido.'}`;
            }
            console.error("Error al guardar asesor:", err.response || err);
            // Idealmente, el error se pasa al AsesorForm para mostrarlo allí
            // Por ahora, un alert o un error en la página.
            alert(submitErrorMessage);
        } finally { setLoading(false); }
    };

    const handleDeleteAsesor = async (asesorId) => {
        if (window.confirm(`¿Está seguro de que quiere eliminar el asesor ${asesorId}?`)) {
            try {
                setLoading(true);
                await apiService.deleteAsesor(asesorId);
                alert('Asesor eliminado con éxito!');
                fetchAsesores(filters, currentPage, pageSize); 
            } catch (err) { 
                alert(`Error al eliminar el asesor: ${err.response?.data?.detail || err.message || 'Error desconocido.'}`);
            } finally {
                setLoading(false);
            }
        }
    };
    
    const showInitialLoading = loading && asesores.length === 0 && !Object.values(filters).some(f => f !== '');
    const showFilteringMessage = loading && (asesores.length > 0 || Object.values(filters).some(f => f !== ''));

    // Generar array de páginas para mostrar en la paginación
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }
        return pages;
    };

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Listado de Asesores</h1>

            <div className={styles.filterContainer}> {/* Usar .filterContainer o .filterContainerAsesores */}
                <input 
                    type="text" 
                    name="nombre_asesor" 
                    placeholder="Buscar por nombre..." 
                    value={filters.nombre_asesor} 
                    onChange={handleFilterChange} 
                    className={styles.filterInput}
                />
                <select 
                    name="tipo_asesor_actual" 
                    value={filters.tipo_asesor_actual} 
                    onChange={handleFilterChange} 
                    className={styles.filterSelect}
                >
                    <option value="">Todos los Tipos</option>
                    <option value="Junior">Junior</option>
                    <option value="Socio">Socio</option>
                </select>
                <button onClick={resetFilters} className={styles.resetButton}>Limpiar Filtros</button>
            </div>

            <div className={styles.createButtonContainer}>
                <button onClick={handleOpenModalForCreate} className={styles.createButton}>Crear Nuevo Asesor</button>
            </div>

            {error && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{error}</div>}
            {showInitialLoading && <div className={styles.loadingMessage}>Cargando asesores...</div>}
            {showFilteringMessage && <div className={styles.loadingMessage}>Aplicando filtros y cargando...</div>}

            {!loading && asesores.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay asesores para mostrar con los filtros actuales.</p>
            )}

            {asesores.length > 0 && (
                <>
                    {/* Información de paginación */}
                    <div className={styles.paginationInfo}>
                        <span>
                            Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} asesores
                        </span>
                        <div className={styles.pageSizeSelector}>
                            <label htmlFor="pageSize">Asesores por página:</label>
                            <select 
                                id="pageSize"
                                value={pageSize} 
                                onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                                className={styles.pageSizeSelect}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    {/* Tabla de asesores */}
                    <div className={styles.tableResponsiveContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ID Asesor</th>
                                    <th>Nombre</th>
                                    <th>Tipo</th>
                                    <th>Fecha Ingreso</th>
                                    <th>Referidor</th>
                                    <th style={{minWidth: '180px'}}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {asesores.map(asesor => (
                                    <tr key={asesor.id_asesor}>
                                        <td data-label="ID Asesor">{asesor.id_asesor}</td>
                                        <td data-label="Nombre">{asesor.nombre_asesor}</td>
                                        <td data-label="Tipo">{asesor.tipo_asesor_actual}</td>
                                        <td data-label="Fecha Ingreso">{displayDate(asesor.fecha_ingreso)}</td>
                                        <td data-label="Referidor">{asesor.id_referidor ? (asesor.nombre_referidor || asesorMap[asesor.id_referidor] || asesor.id_referidor) : '-'}</td>
                                        <td data-label="Acciones" className={styles.actionButtons}>
                                            <Link to={`/asesores/${asesor.id_asesor}`} className={`${styles.button} ${styles.viewButton}`}>Ver</Link>
                                            <button onClick={() => handleOpenModalForEdit(asesor)} className={`${styles.button} ${styles.editButton}`}>Editar</button>
                                            <button onClick={() => handleDeleteAsesor(asesor.id_asesor)} className={`${styles.button} ${styles.deleteButton}`}>Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Controles de paginación */}
                    {totalPages > 1 && (
                        <div className={styles.paginationControls}>
                            <button 
                                onClick={() => handlePageChange(1)} 
                                disabled={currentPage === 1}
                                className={styles.paginationButton}
                            >
                                « Primera
                            </button>
                            <button 
                                onClick={() => handlePageChange(currentPage - 1)} 
                                disabled={currentPage === 1}
                                className={styles.paginationButton}
                            >
                                ‹ Anterior
                            </button>
                            
                            {getPageNumbers().map((page, index) => (
                                <button
                                    key={index}
                                    onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
                                    disabled={page === '...'}
                                    className={`${styles.paginationButton} ${page === currentPage ? styles.activePage : ''} ${page === '...' ? styles.ellipsis : ''}`}
                                >
                                    {page}
                                </button>
                            ))}
                            
                            <button 
                                onClick={() => handlePageChange(currentPage + 1)} 
                                disabled={currentPage === totalPages}
                                className={styles.paginationButton}
                            >
                                Siguiente ›
                            </button>
                            <button 
                                onClick={() => handlePageChange(totalPages)} 
                                disabled={currentPage === totalPages}
                                className={styles.paginationButton}
                            >
                                Última »
                            </button>
                        </div>
                    )}
                </>
            )}
            {isModalOpen && (
                <AsesorForm 
                    show={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSubmit={handleSubmitAsesor} 
                    initialData={editingAsesor}
                    asesoresList={asesores} // Para el selector de referidor dentro del AsesorForm
                />
            )}
        </div>
    );
}
export default AsesoresPage;