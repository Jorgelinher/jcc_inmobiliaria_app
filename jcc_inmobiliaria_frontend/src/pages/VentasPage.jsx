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

    const initialFilters = {
        fecha_venta_after: '', fecha_venta_before: '', lote_id: '',
        cliente_q: '', vendedor_q: '', tipo_venta: '', status_venta: ''
    };
    const [filters, setFilters] = useState(initialFilters);

    const fetchVentas = useCallback(async (currentFilters) => {
        setLoading(true);
        setError(null);
        try {
            const activeFilters = Object.entries(currentFilters)
                .filter(([_, value]) => value !== '' && value !== null)
                .reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
            
            const queryParams = new URLSearchParams(activeFilters).toString();
            const response = await apiService.getVentas(queryParams);
            setVentas(response.data.results || response.data || []);
        } catch (err) {
            let errorMessage = "Error al cargar las ventas.";
            if (err.response) { errorMessage += ` (Status: ${err.response.status}) Detalle: ${JSON.stringify(err.response.data)}`; } 
            else if (err.request) { errorMessage += " El servidor no responde."; } 
            else { errorMessage += ` ${err.message}`; }
            setError(errorMessage);
            setVentas([]);
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchVentas(filters);
    }, [filters, fetchVentas]);

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
    };

    const resetFilters = () => { setFilters(initialFilters); };

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
            await fetchVentas(filters); // Actualizar la lista de ventas

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
                fetchVentas(filters); 
            } catch (err) { 
                alert(`Error al eliminar la venta: ${err.message || 'Error desconocido.'}`);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRegistrarPago = (ventaId) => {
        navigate(`/ventas/${ventaId}?accion=registrarPago`);
    };

    // formatShortDate y formatCurrencyShort ya estaban definidos, pero usaremos los más consistentes
    // const formatShortDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric'}) : '-';
    // const formatCurrencyShort = (value) => (value !== null && value !== undefined) ? `S/. ${Number(value).toLocaleString('es-PE', {minimumFractionDigits:0, maximumFractionDigits:0})}` : '-';


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
                <select name="status_venta" value={filters.status_venta} onChange={handleFilterChange} className={styles.filterSelect}><option value="">Todos los Status</option><option value="separacion">Separación</option><option value="procesable">Procesable</option><option value="completada">Completada</option><option value="anulado">Anulado</option></select>
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
                <div className={styles.tableResponsiveContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>{/* SIN ESPACIOS NI TEXTO EXTRA AQUÍ */}
                                <th className={styles.colId}>ID Venta</th>
                                <th className={styles.colFecha}>Fecha</th>
                                <th className={styles.colLote}>Lote</th>
                                <th className={styles.colCliente}>Cliente</th>
                                <th className={styles.colVendedor}>Vendedor</th>
                                <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Valor Total</th>
                                <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Pagado</th>
                                <th className={`${styles.colMonto} ${styles.textAlignRight}`}>Saldo</th>
                                <th className={styles.colTipo}>Tipo</th>
                                <th className={styles.colStatus}>Status</th>
                                <th className={styles.colAcciones}>Acciones</th>
                            </tr>{/* SIN ESPACIOS NI TEXTO EXTRA AQUÍ */}
                        </thead>
                        <tbody>
                            {ventas.map(venta => (
                                // Corrección: No debe haber espacios ni comentarios entre <tr> y <td>
                                <tr key={venta.id_venta}>
                                    <td>{venta.id_venta}</td>
                                    <td>{displayDate(venta.fecha_venta)}</td>
                                    <td>
                                        {/* Asumimos que venta.lote es el ID y venta.lote_info es el texto a mostrar */}
                                        {venta.lote ? 
                                            <Link to={`/lotes/${venta.lote}`}>{venta.lote_info || venta.lote}</Link> 
                                            : '-'}
                                    </td>
                                    <td>
                                        {/* Usar cliente_detalle si está disponible (viene del serializer) */}
                                        {venta.cliente_detalle ? 
                                            <Link to={`/clientes/${venta.cliente_detalle.id_cliente}`}>{venta.cliente_detalle.nombres_completos_razon_social}</Link> 
                                            : (venta.cliente_info || venta.cliente || '-')}
                                    </td>
                                    <td>{venta.vendedor_principal_nombre || venta.vendedor_principal?.nombre_asesor || '-'}</td>
                                    <td className={styles.textAlignRight}>{displayCurrency(venta.valor_lote_venta)}</td>
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
                            ))}
                        </tbody>
                    </table>
                </div>
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