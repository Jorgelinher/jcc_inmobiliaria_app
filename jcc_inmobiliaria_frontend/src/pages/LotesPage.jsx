// src/pages/LotesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as apiService from '../services/apiService';
import LoteForm from '../components/forms/LoteForm';
import styles from './LotesPage.module.css'; // Usará el LotesPage.module.css actualizado

// Funciones de formato (puedes moverlas a un archivo utils.js si se repiten mucho)
const displayCurrency = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '-'; // O 'S/. 0.00' si prefieres
    }
    return Number(value).toLocaleString('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

const displayCurrencyUSD = (value) => {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '-';
    }
    return Number(value).toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

function LotesPage() {
    const [lotes, setLotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLote, setEditingLote] = useState(null);

    // Estado de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const [filters, setFilters] = useState({
        q: '', 
        estado_lote: '', // Valor inicial vacío para "Todos los Estados"
        etapa: '',
        ubicacion_proyecto: '' // Nuevo filtro
    });

    // Estado para las ubicaciones de proyecto
    const [ubicacionesProyecto, setUbicacionesProyecto] = useState([]);

    const fetchLotes = useCallback(async (currentFilters, page = 1, size = pageSize) => {
        setLoading(true);
        setError(null);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([_, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => {
                    obj[key] = value;
                    return obj;
                }, {});
            
            // Agregar parámetros de paginación
            activeFilters.page = page;
            activeFilters.page_size = size;
            
            const queryParams = new URLSearchParams(activeFilters).toString();
            console.log("[LotesPage] Fetching lotes con queryParams:", queryParams);
            const response = await apiService.getLotes(queryParams);
            console.log("[LotesPage] Lotes response:", response.data);
            
            // Extraer datos paginados
            setLotes(response.data.results || []);
            setTotalCount(response.data.count || 0);
            setTotalPages(Math.ceil((response.data.count || 0) / size));
            setCurrentPage(page);
        } catch (err) {
            let errorMessage = "Error al cargar los lotes.";
            if (err.response) {
                errorMessage += ` (Status: ${err.response.status}) Detalle: ${JSON.stringify(err.response.data)}`;
            } else if (err.request) {
                errorMessage += " El servidor no responde.";
            } else {
                errorMessage += ` ${err.message}`;
            }
            setError(errorMessage);
            setLotes([]);
        } finally {
            setLoading(false);
        }
    }, []); // Remover pageSize de las dependencias para evitar ciclos

    useEffect(() => {
        fetchLotes(filters, 1, pageSize);
    }, [filters, fetchLotes]); // Remover pageSize del useEffect para evitar llamadas duplicadas

    // Obtener ubicaciones de proyecto al montar el componente
    useEffect(() => {
        const fetchUbicacionesProyecto = async () => {
            try {
                const response = await apiService.getUbicacionesProyecto();
                setUbicacionesProyecto(response.data.ubicaciones_proyecto || []);
            } catch (err) {
                setUbicacionesProyecto([]);
            }
        };
        fetchUbicacionesProyecto();
    }, []);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({
            ...prevFilters,
            [name]: value
        }));
    };
    
    const resetFilters = () => {
        setFilters({ q: '', estado_lote: '', etapa: '', ubicacion_proyecto: '' });
    };

    // Funciones de paginación
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            fetchLotes(filters, newPage, pageSize);
        }
    };

    const handlePageSizeChange = (newPageSize) => {
        setPageSize(newPageSize);
        setCurrentPage(1); // Reset a la primera página cuando cambia el tamaño
        // Llamar directamente a fetchLotes con el nuevo tamaño
        fetchLotes(filters, 1, newPageSize);
    };

    const handleOpenModalForCreate = () => { setEditingLote(null); setIsModalOpen(true); };
    const handleOpenModalForEdit = (lote) => { setEditingLote(lote); setIsModalOpen(true); };
    const handleCloseModal = () => { setIsModalOpen(false); setEditingLote(null); };

    const handleSubmitLote = async (formDataFromForm) => { // formDataFromForm es el nombre correcto
        try {
            setLoading(true);
            const dataToSubmit = {
                ...formDataFromForm, // Usar formDataFromForm
                etapa: formDataFromForm.etapa === '' ? null : parseInt(formDataFromForm.etapa, 10),
                // Asegurar que los campos de precio se envíen como números o null
                precio_lista_soles: formDataFromForm.precio_lista_soles ? parseFloat(formDataFromForm.precio_lista_soles) : null,
                precio_credito_12_meses_soles: formDataFromForm.precio_credito_12_meses_soles ? parseFloat(formDataFromForm.precio_credito_12_meses_soles) : null,
                precio_credito_24_meses_soles: formDataFromForm.precio_credito_24_meses_soles ? parseFloat(formDataFromForm.precio_credito_24_meses_soles) : null,
                precio_credito_36_meses_soles: formDataFromForm.precio_credito_36_meses_soles ? parseFloat(formDataFromForm.precio_credito_36_meses_soles) : null,
                precio_lista_dolares: formDataFromForm.precio_lista_dolares ? parseFloat(formDataFromForm.precio_lista_dolares) : null,
            };
            if (editingLote) {
                await apiService.updateLote(editingLote.id_lote, dataToSubmit);
                alert('Lote actualizado con éxito!');
            } else {
                await apiService.createLote(dataToSubmit);
                alert('Lote creado con éxito!');
            }
            handleCloseModal();
            fetchLotes(filters, currentPage, pageSize); 
        } catch (err) {
            let submitErrorMessage = "Error al guardar el lote.";
            if (err.response && err.response.data) {
                 const errors = err.response.data;
                 const formattedErrors = Object.entries(errors)
                    .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
                    .join('\n');
                 submitErrorMessage += `\nDetalles:\n${formattedErrors}`;
            } else {
                submitErrorMessage += ` ${err.message || 'Error desconocido.'}`;
            }
            console.error("Error al guardar lote:", err.response || err);
            alert(submitErrorMessage); // Considerar mostrar errores en el modal en lugar de alert
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteLote = async (loteId) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar el lote ${loteId}?`)) {
            try {
                setLoading(true);
                await apiService.deleteLote(loteId);
                alert('Lote eliminado con éxito!');
                fetchLotes(filters, currentPage, pageSize); 
            } catch (err) { 
                alert(`Error al eliminar el lote: ${err.response?.data?.detail || err.message || 'Error desconocido.'}`);
             } finally {
                setLoading(false);
             }
        }
    };

    const handleLimpiarLotesDuplicados = async () => {
        if (window.confirm('¿Estás seguro de que quieres limpiar los lotes duplicados? Esta acción no se puede deshacer.')) {
            try {
                setLoading(true);
                const response = await apiService.limpiarLotesDuplicados();
                
                if (response.data.success) {
                    alert(`Limpieza completada:\n- Duplicados detectados: ${response.data.total_duplicados_detectados}\n- Eliminados: ${response.data.total_eliminados}\n- Total final: ${response.data.total_lotes_final}`);
                    // Recargar la lista de lotes
                    fetchLotes(filters, 1, pageSize);
                } else {
                    alert(`Error: ${response.data.error}`);
                }
            } catch (err) {
                alert(`Error al limpiar lotes duplicados: ${err.message}`);
            } finally {
                setLoading(false);
            }
        }
    };

    // No mostrar "Cargando lotes..." si ya hay lotes y se están aplicando filtros
    const showInitialLoading = loading && lotes.length === 0 && !Object.values(filters).some(f => f !== '');
    const showFilteringMessage = loading && (lotes.length > 0 || Object.values(filters).some(f => f !== ''));

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
            <h1 className={styles.title}>Listado de Lotes</h1>
            
            {/* Contenedor de Filtros */}
            <div className={styles.filterContainer}> {/* Usar .filterContainer como en el CSS */}
                <input 
                    type="text" 
                    name="q" 
                    placeholder="Buscar por ID, Proyecto, Mz, Lt..." 
                    value={filters.q} 
                    onChange={handleFilterChange} 
                    className={styles.filterInput}
                />
                <select 
                    name="estado_lote" 
                    value={filters.estado_lote} 
                    onChange={handleFilterChange} 
                    className={styles.filterSelect}
                >
                    <option value="">Todos los Estados</option>
                    <option value="Disponible">Disponible</option>
                    <option value="Reservado">Reservado</option>
                    <option value="Vendido">Vendido</option>
                </select>
                <input 
                    type="number" 
                    name="etapa" 
                    placeholder="Etapa (Nro.)" 
                    value={filters.etapa} 
                    onChange={handleFilterChange} 
                    className={styles.filterInput} 
                    min="0" // Permitir 0 o vacío si es opcional
                />
                {/* Nuevo filtro de Proyecto */}
                <select
                    name="ubicacion_proyecto"
                    value={filters.ubicacion_proyecto}
                    onChange={handleFilterChange}
                    className={styles.filterSelect}
                >
                    <option value="">Todos los Proyectos</option>
                    {ubicacionesProyecto.map((ubic, idx) => (
                        <option key={idx} value={ubic}>{ubic}</option>
                    ))}
                </select>
                <button onClick={resetFilters} className={styles.resetButton}>Limpiar</button>
            </div>

            <div className={styles.createButtonContainer}>
                <button onClick={handleOpenModalForCreate} className={styles.createButton}>Crear Nuevo Lote</button>
                <button onClick={handleLimpiarLotesDuplicados} className={styles.createButton} style={{backgroundColor: '#dc3545', marginLeft: '10px'}}>
                    🧹 Limpiar Lotes Duplicados
                </button>
            </div>

            {error && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{error}</div>}
            {showInitialLoading && <div className={styles.loadingMessage}>Cargando lotes...</div>}
            {showFilteringMessage && <div className={styles.loadingMessage}>Aplicando filtros y cargando...</div>}
            
            {!loading && lotes.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay lotes para mostrar con los filtros actuales.</p>
            )}

            {lotes.length > 0 && (
                <>
                    {/* Información de paginación */}
                    <div className={styles.paginationInfo}>
                        <span>
                            Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} lotes
                        </span>
                        <div className={styles.pageSizeSelector}>
                            <label htmlFor="pageSize">Lotes por página:</label>
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

                    {/* Tabla de lotes */}
                    <div className={styles.tableResponsiveContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ID Lote</th>
                                    <th>Proyecto</th>
                                    <th>Manzana</th>
                                    <th>N° Lote</th>
                                    <th>Etapa</th>
                                    <th>Estado</th>
                                    <th className={styles.textAlignRight}>Área (m²)</th>
                                    <th className={styles.textAlignRight}>Precio Cont. (S/.)</th>
                                    <th className={styles.textAlignRight}>Precio Cont. ($)</th>
                                    <th style={{minWidth: '180px'}}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lotes.map(lote => (
                                    <tr key={lote.id_lote}>
                                        <td data-label="ID Lote">{lote.id_lote}</td>
                                        <td data-label="Proyecto">{lote.ubicacion_proyecto}</td>
                                        <td data-label="Manzana">{lote.manzana || '-'}</td>
                                        <td data-label="N° Lote">{lote.numero_lote || '-'}</td>
                                        <td data-label="Etapa">{lote.etapa !== null ? lote.etapa : '-'}</td>
                                        <td data-label="Estado">
                                            <span className={`${styles.statusBadge} ${styles['statusBadge' + lote.estado_lote?.toLowerCase()]}`}>
                                                {lote.estado_lote}
                                            </span>
                                        </td>
                                        <td data-label="Área (m²)" className={styles.textAlignRight}>{parseFloat(lote.area_m2).toFixed(2)}</td>
                                        <td data-label="Precio (S/.)" className={styles.textAlignRight}>{displayCurrency(lote.precio_lista_soles)}</td>
                                        <td data-label="Precio ($)" className={styles.textAlignRight}>{displayCurrencyUSD(lote.precio_lista_dolares)}</td>
                                        <td data-label="Acciones" className={styles.actionButtons}>
                                            <Link to={`/lotes/${lote.id_lote}`} className={`${styles.button} ${styles.viewButton}`}>Ver</Link>
                                            <button onClick={() => handleOpenModalForEdit(lote)} className={`${styles.button} ${styles.editButton}`}>Editar</button>
                                            <button onClick={() => handleDeleteLote(lote.id_lote)} className={`${styles.button} ${styles.deleteButton}`}>Eliminar</button>
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
            {isModalOpen && ( /* Renderizar el modal LoteForm cuando isModalOpen es true */
                <LoteForm 
                    show={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSubmit={handleSubmitLote} 
                    initialData={editingLote}
                />
            )}
        </div>
    );
}

export default LotesPage;