// src/pages/VentasPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } // Importar useLocation
    from 'react-router-dom';
import * as apiService from '../services/apiService';
import VentaForm from '../components/forms/VentaForm';
import styles from './VentasPage.module.css';

// --- INICIO: Funciones de Formato (Añadidas/Revisadas) ---
const displayDate = (dateStr) => { // Función para formatear fechas consistentemente
    if (!dateStr) return '-';
    try {
        // Asumir que la fecha viene como YYYY-MM-DD
        const dateObj = new Date(dateStr + 'T00:00:00Z'); // Añadir tiempo y Z para tratar como UTC y evitar problemas de zona horaria
        if (isNaN(dateObj.getTime())) {
            return dateStr; // Devolver original si no es parseable
        }
        return dateObj.toLocaleDateString('es-PE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'UTC' // Importante para consistencia
        });
    } catch (e) {
        console.error("Error formateando fecha:", dateStr, e);
        return dateStr;
    }
};

const displayCurrency = (value) => { // Función para formatear moneda consistentemente
    if (value === null || value === undefined || isNaN(Number(value))) {
        return 'S/. 0.00';
    }
    return Number(value).toLocaleString('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};
// --- FIN: Funciones de Formato ---

function VentasPage() {
    const [ventas, setVentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVenta, setEditingVenta] = useState(null);
    const navigate = useNavigate();
    const location = useLocation(); // Para leer el estado de navegación

    // Estados de paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const initialFilters = {
        fecha_venta_after: '', fecha_venta_before: '', lote_id: '',
        cliente_q: '', vendedor_q: '', tipo_venta: '', status_venta: ''
    };
    const [filters, setFilters] = useState(initialFilters);

    const fetchVentas = useCallback(async (currentFilters, page = 1, size = pageSize) => {
        setLoading(true);
        setError(null);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([_, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
            
            // Agregar parámetros de paginación
            activeFilters.page = page;
            activeFilters.page_size = size;
            
            const queryParams = new URLSearchParams(activeFilters).toString();
            const response = await apiService.getVentas(queryParams);
            
            // Manejar respuesta paginada
            if (response.data.results) {
                setVentas(response.data.results);
                setTotalCount(response.data.count || 0);
                setTotalPages(Math.ceil((response.data.count || 0) / size));
            } else {
                setVentas(response.data || []);
                setTotalCount(response.data?.length || 0);
                setTotalPages(1);
            }
        } catch (err) {
            let errorMessage = "Error al cargar las ventas.";
            if (err.response) { errorMessage += ` (Status: ${err.response.status}) Detalle: ${JSON.stringify(err.response.data)}`; } 
            else if (err.request) { errorMessage += " El servidor no responde."; } 
            else { errorMessage += ` ${err.message}`; }
            setError(errorMessage);
            setVentas([]);
        } finally { setLoading(false); }
    }, [pageSize]);

    useEffect(() => {
        fetchVentas(filters, currentPage, pageSize);
    }, [filters, currentPage, pageSize, fetchVentas]);

    // Efecto para abrir el modal de edición si se navega con estado
    useEffect(() => {
        if (location.state?.accion === 'editarVenta' && location.state?.idVentaAEditar) {
            const ventaAEditar = ventas.find(v => v.id_venta === location.state.idVentaAEditar);
            if (ventaAEditar) {
                handleOpenModalForEdit(ventaAEditar);
            } else if (ventas.length > 0) { // Si las ventas ya cargaron y no se encontró
                console.warn(`Venta con ID ${location.state.idVentaAEditar} no encontrada para editar.`);
                // Limpiar el estado para evitar reintentos
                navigate(location.pathname, { replace: true, state: {} });
            }
            // Si las ventas aún no han cargado, este efecto podría necesitar re-ejecutarse cuando 'ventas' cambie.
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, ventas]); // Depender de 'ventas' para re-evaluar cuando carguen


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => ({ ...prevFilters, [name]: value }));
        setCurrentPage(1); // Reset a primera página al filtrar
    };

    const resetFilters = () => { 
        setFilters(initialFilters); 
        setCurrentPage(1); // Reset a primera página
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setCurrentPage(1); // Reset a primera página al cambiar tamaño
    };

    const handleOpenModalForCreate = () => { setEditingVenta(null); setIsModalOpen(true); };
    
    const handleOpenModalForEdit = (venta) => {
        // Asegurarse de que los IDs de las relaciones ForeignKey se pasen correctamente
        const ventaDataForForm = {
            ...venta,
            lote: venta.lote?.id_lote || venta.lote, // Si 'lote' es un objeto, tomar su ID
            cliente: venta.cliente_detalle?.id_cliente || venta.cliente?.id_cliente || venta.cliente,
            vendedor_principal: venta.vendedor_principal?.id_asesor || venta.vendedor_principal,
            id_socio_participante: venta.id_socio_participante?.id_asesor || venta.id_socio_participante || null,
            // lote_info se usa para display en VentaForm, si no viene, VentaForm lo construirá
            lote_info: venta.lote_info || `${venta.lote?.id_lote || venta.lote} (...)` 
        };
        setEditingVenta(ventaDataForForm);
        setIsModalOpen(true);
    };
    const handleCloseModal = () => { 
        setIsModalOpen(false); 
        setEditingVenta(null); 
        // Limpiar el estado de navegación para que no se reabra el modal al volver a la página
        navigate(location.pathname, { replace: true, state: {} });
    };

    const handleSubmitVenta = async (formDataFromForm) => {
        try {
            setLoading(true); // Indicar carga durante el submit
            setError(null); // Limpiar errores previos
            let response;
            if (editingVenta && editingVenta.id_venta) {
                response = await apiService.updateVenta(editingVenta.id_venta, formDataFromForm);
                alert('Venta actualizada con éxito!');
            } else {
                response = await apiService.createVenta(formDataFromForm);
                alert('Venta registrada con éxito!');
            }
            handleCloseModal();
            await fetchVentas(filters, currentPage, pageSize); // Actualizar la lista de ventas

            // Opcional: navegar al detalle de la venta recién creada/actualizada
            if (response.data && response.data.id_venta) {
                setTimeout(() => { // Pequeño delay para que el usuario vea el alert
                    navigate(`/ventas/${response.data.id_venta}`);
                }, 100);
            }

        } catch (err) { 
            let submitErrorMessage = "Error al registrar la venta.";
            if (err.response && err.response.data) {
                const errors = err.response.data;
                const formattedErrors = Object.entries(errors).map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`).join('\n');
                submitErrorMessage += `\nDetalles:\n${formattedErrors}`;
            } else { submitErrorMessage += ` ${err.message || 'Error desconocido.'}`; }
            console.error("Error al guardar venta:", err.response || err);
            // Mostrar el error en la página o en el modal (si se pasa setFormError al modal)
            setError(submitErrorMessage); 
            // No cerrar el modal en caso de error para que el usuario pueda corregir
            // alert(submitErrorMessage); // Alert puede ser molesto si el error se muestra en el form
        } finally { 
            setLoading(false); 
        }
    };

    const handleDeleteVenta = async (ventaId) => {
        if (window.confirm(`¿Está seguro de que quiere eliminar la venta ID ${ventaId}?`)) {
            try {
                setLoading(true);
                await apiService.deleteVenta(ventaId);
                alert('Venta eliminada con éxito!');
                fetchVentas(filters, currentPage, pageSize);
            } catch (err) {
                let customMessage = '';
                // Si el backend devuelve un error 500 y el mensaje contiene 'ProtectedError' o 'referenced through protected foreign keys'
                if (err.response && err.response.status === 500 && err.response.data && typeof err.response.data === 'string' &&
                    (err.response.data.includes('ProtectedError') || err.response.data.includes('referenced through protected foreign keys'))
                ) {
                    customMessage = 'No es posible eliminar la venta porque tiene comisiones cerradas asociadas. Consulte con el administrador si necesita realizar esta acción.';
                } else {
                    customMessage = `Error al eliminar la venta: ${err.message || 'Error desconocido.'}`;
                }
                alert(customMessage);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRegistrarPago = (ventaId) => {
        navigate(`/ventas/${ventaId}?accion=registrarPago`);
    };

    // Función para detectar si la tabla necesita scroll horizontal
    const checkTableScroll = () => {
        const tableContainer = document.querySelector(`.${styles.tableResponsiveContainer}`);
        if (tableContainer) {
            const hasHorizontalScroll = tableContainer.scrollWidth > tableContainer.clientWidth;
            tableContainer.setAttribute('data-scrollable', hasHorizontalScroll.toString());
        }
    };

    // Verificar scroll cuando cambian los datos o el tamaño de ventana
    useEffect(() => {
        checkTableScroll();
        window.addEventListener('resize', checkTableScroll);
        return () => window.removeEventListener('resize', checkTableScroll);
    }, [ventas]); // Se ejecuta cuando cambian las ventas

    const getProyectoKey = (ubicacionProyecto) => {
        if (!ubicacionProyecto) return '';
        const val = ubicacionProyecto.trim().toLowerCase();
        if (val.includes('aucallama')) return 'aucallama';
        if (val.includes('oasis 2')) return 'oasis 2';
        return val;
    };

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
            <h1 className={styles.title}>Listado de Ventas</h1>

            <div className={styles.filterContainerVentas}>
                <input type="date" name="fecha_venta_after" value={filters.fecha_venta_after} onChange={handleFilterChange} className={styles.filterInputSmall} title="Fecha Venta Desde"/>
                <input type="date" name="fecha_venta_before" value={filters.fecha_venta_before} onChange={handleFilterChange} className={styles.filterInputSmall} title="Fecha Venta Hasta"/>
                <input type="text" name="lote_id" placeholder="ID Lote" value={filters.lote_id} onChange={handleFilterChange} className={styles.filterInput}/>
                <input type="text" name="cliente_q" placeholder="Buscar Cliente..." value={filters.cliente_q} onChange={handleFilterChange} className={styles.filterInput}/>
                <input type="text" name="vendedor_q" placeholder="Buscar Vendedor..." value={filters.vendedor_q} onChange={handleFilterChange} className={styles.filterInput}/>
                <select name="tipo_venta" value={filters.tipo_venta} onChange={handleFilterChange} className={styles.filterSelect}><option value="">Todo Tipo Venta</option><option value="credito">Crédito</option><option value="contado">Contado</option></select>
                <select name="status_venta" value={filters.status_venta} onChange={handleFilterChange} className={styles.filterSelect}><option value="">Todos los Status de Venta</option><option value="separacion">Separación</option><option value="procesable">Procesable</option><option value="completada">Completada</option><option value="anulado">Anulado</option></select>
                <button onClick={resetFilters} className={styles.resetButton}>Limpiar Filtros</button>
            </div>

            <div className={styles.createButtonContainer}>
                <button onClick={handleOpenModalForCreate} className={styles.createButton}>Registrar Nueva Venta</button>
            </div>

            {error && <div className={`${styles.errorMessageCommon} ${styles.marginBottom}`}>{error}</div>}
            {loading && <div className={styles.loadingMessage}>Cargando ventas...</div>}

            {!loading && ventas.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay ventas para mostrar con los filtros actuales.</p>
            )}

            {ventas.length > 0 && (
                <>
                    {/* Información de paginación */}
                    <div className={styles.paginationInfo}>
                        <span>
                            Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} ventas
                        </span>
                        <div className={styles.pageSizeSelector}>
                            <label htmlFor="pageSize">Ventas por página:</label>
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

                    {/* Tabla de ventas */}
                    <div className={styles.tableResponsiveContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th className={styles.colId}>ID Venta</th>
                                    <th className={styles.colFecha}>Fecha</th>
                                    <th className={styles.colLote}>Lote</th>
                                    <th className={styles.colCliente}>Cliente</th>
                                    <th className={styles.colVendedor}>Vendedor</th>
                                    <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Valor Total</th>
                                    <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Valor ($)</th>
                                    <th className={`${styles.colMonto} ${styles.textAlignRight}`}>T.C.</th>
                                    <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Pagado</th>
                                    <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Saldo</th>
                                    <th className={styles.colTipo}>Tipo</th>
                                    <th className={styles.colStatus}>Status Venta</th>
                                    <th className={styles.colAcciones}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ventas.map(venta => {
                                    let proyectoKey = '';
                                    if (venta.lote_info) {
                                        proyectoKey = getProyectoKey(venta.lote_info);
                                    } else if (venta.lote && typeof venta.lote === 'object' && venta.lote.ubicacion_proyecto) {
                                        proyectoKey = getProyectoKey(venta.lote.ubicacion_proyecto);
                                    }
                                    const mostrarDolares = proyectoKey === 'aucallama' || proyectoKey === 'oasis 2';
                                    return (
                                        <tr key={venta.id_venta}>
                                            <td>{venta.id_venta}</td>
                                            <td>{displayDate(venta.fecha_venta)}</td>
                                            <td>
                                                {venta.lote ? 
                                                    <Link to={`/lotes/${venta.lote}`}>{venta.lote_info || venta.lote}</Link> 
                                                    : '-'}
                                            </td>
                                            <td>
                                                {venta.cliente_detalle ? 
                                                    <Link to={`/clientes/${venta.cliente_detalle.id_cliente}`}>{venta.cliente_detalle.nombres_completos_razon_social}</Link> 
                                                    : (venta.cliente_info || venta.cliente || '-')}
                                            </td>
                                            <td>{venta.vendedor_principal_nombre || venta.vendedor_principal?.nombre_asesor || '-'}</td>
                                            <td className={styles.textAlignRight}>{displayCurrency(venta.valor_lote_venta)}</td>
                                            <td className={styles.textAlignRight}>{mostrarDolares && venta.precio_dolares ? `$${Number(venta.precio_dolares).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}</td>
                                            <td className={styles.textAlignRight}>{mostrarDolares && venta.tipo_cambio ? Number(venta.tipo_cambio).toFixed(3) : '-'}</td>
                                            <td className={styles.textAlignRight}>{displayCurrency(venta.monto_pagado_actual)}</td>
                                            <td className={styles.textAlignRight}>{displayCurrency(venta.saldo_pendiente)}</td>
                                            <td>{venta.tipo_venta}</td>
                                            <td>
                                                <span className={`${styles.statusBadge} ${styles['statusBadge' + venta.status_venta?.replace(/\s+/g, '')]}`}>
                                                    {venta.status_venta_display || venta.status_venta}
                                                </span>
                                            </td>
                                            <td className={styles.actionButtons}>
                                                <Link to={`/ventas/${venta.id_venta}`} className={styles.viewButton}>Ver</Link>
                                                <button onClick={() => handleOpenModalForEdit(venta)} className={styles.editButton}>Editar</button>
                                                <button onClick={() => handleRegistrarPago(venta.id_venta)} className={styles.payButton}>Registrar Pago</button>
                                                <button onClick={() => handleDeleteVenta(venta.id_venta)} className={styles.deleteButton}>Eliminar</button>
                                            </td>
                                        </tr>
                                    );
                                })}
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
                <VentaForm 
                    show={isModalOpen} 
                    onClose={handleCloseModal} 
                    onSubmit={handleSubmitVenta} 
                    initialData={editingVenta}
                />
            )}
        </div>
    );
}
export default VentasPage;