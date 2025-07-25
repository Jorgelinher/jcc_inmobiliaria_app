// src/pages/ComisionesPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../services/apiService';
import styles from './ComisionesPage.module.css'; // Usará el ComisionesPage.module.css actualizado

function ComisionesPage() {
    // ... (estados y funciones como estaban: summaryData, loading, error, filters, asesoresList, fetchCommissionSummary, handleFilterChange, formatNumber) ...
    // Asegúrate que las funciones de formato y la lógica de fetch estén correctas.

    const [summaryData, setSummaryData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        asesor_id: '',
        mes: new Date().getMonth() + 1, 
        anio: new Date().getFullYear(),
    });
    const [asesoresList, setAsesoresList] = useState([]);

    useEffect(() => {
        const loadAsesores = async () => {
            try {
                const response = await apiService.getAdvisorsForFilter();
                setAsesoresList(response.data || []);
            } catch (err) {
                setError(prev => prev ? `${prev} | Error cargando lista de asesores.` : "Error cargando lista de asesores.");
            }
        };
        loadAsesores();
    }, []);

    const fetchCommissionSummary = useCallback(async (currentFilters) => {
        setLoading(true);
        console.log("[ComisionesPage] Iniciando fetchCommissionSummary con filtros:", currentFilters);
        try {
            const formattedFilters = {
                ...currentFilters,
                mes: String(currentFilters.mes).padStart(2, '0'),
                anio: String(currentFilters.anio),
            };
            if (!formattedFilters.asesor_id) delete formattedFilters.asesor_id;

            const response = await apiService.getCommissionSummary(formattedFilters);
            if (response && response.data && response.data.success) {
                setSummaryData(response.data.summary || []);
                if (response.data.summary && response.data.summary.length === 0) {
                    setError("No se encontraron datos de comisiones para los filtros seleccionados.");
                } else {
                    setError(null);
                }
            } else {
                const errorMessage = response?.data?.message || "Error al obtener el resumen de comisiones.";
                setError(errorMessage);
                setSummaryData([]);
            }
        } catch (err) {
            let errorMessage = "Error al cargar el resumen de comisiones.";
            if (err.response?.data) {
                const detail = err.response.data.detail || err.response.data.message || JSON.stringify(err.response.data);
                errorMessage += ` (Status: ${err.response.status}) Detalle: ${detail}`;
            } else { errorMessage += ` ${err.message || "Error desconocido."}`;}
            setError(errorMessage);
            setSummaryData([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (filters.mes && filters.anio) { 
            fetchCommissionSummary(filters);
        } else {
            setSummaryData([]); 
            setLoading(false); 
            setError("Por favor, seleccione un mes y año válidos.");
        }
    }, [filters, fetchCommissionSummary]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);
    const monthOptions = [
        { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' },
        { value: 3, label: 'Marzo' }, { value: 4, label: 'Abril' },
        { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
        { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' },
        { value: 9, label: 'Septiembre' }, { value: 10, label: 'Octubre' },
        { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
    ];

    const formatNumber = (num, decimals = 2) => {
        const val = parseFloat(num);
        if (isNaN(val)) return '0.00';
        return val.toFixed(decimals);
    };
    const formatCurrency = (value) => { // Consistent currency formatter
        if (value === null || value === undefined || isNaN(Number(value))) {
            return 'S/. 0.00';
        }
        return Number(value).toLocaleString('es-PE', {
            style: 'currency', currency: 'PEN', minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    };


    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Resumen de Metas y Comisiones</h1>

            {/* Panel de Filtros */}
            <div className={styles.filterContainer}>
                <select name="anio" value={filters.anio} onChange={handleFilterChange} className={styles.filterSelect}>
                    {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <select name="mes" value={filters.mes} onChange={handleFilterChange} className={styles.filterSelect}>
                    {monthOptions.map(month => <option key={month.value} value={month.value}>{month.label}</option>)}
                </select>
                <select name="asesor_id" value={filters.asesor_id} onChange={handleFilterChange} className={styles.filterSelect}>
                    <option value="">Todos los Asesores</option>
                    {asesoresList.map(asesor => (
                        <option key={asesor.id} value={asesor.id}>{asesor.name}</option> 
                    ))}
                </select>
            </div>

            {error && !loading && <div className={`${styles.errorMessageCommon} ${styles.marginBottom}`}>{error}</div>}
            {loading && <div className={styles.loadingMessage}>Cargando resumen de comisiones...</div>}

            {!loading && summaryData.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay datos de resumen para mostrar con los filtros seleccionados.</p>
            )}

            {!loading && summaryData.length > 0 && (
                <div className={styles.summaryGrid}>
                    {summaryData.map(asesorData => (
                        <div key={asesorData.asesor_id} className={styles.asesorCard}>
                            <h3>{asesorData.nombre_asesor}</h3>
                            <p><strong>Periodo:</strong> {asesorData.periodo}</p>
                            <div className={styles.sectionBlock}>
                                <h4>Comisiones</h4>
                                <p><strong>Comisión Total:</strong> {formatCurrency(asesorData.comision_total)}</p>
                                {asesorData.detalle && asesorData.detalle.length > 0 && (
                                    <>
                                        <h5>Detalle Ventas Comisionadas:</h5>
                                        <ul className={styles.detalleVentas}>
                                            {asesorData.detalle.map((venta, index) => (
                                                <li key={`${venta.venta_id}-${venta.rol}-${index}`}>
                                                    ID Venta: {venta.venta_id}, Fecha: {venta.fecha_venta}, Rol: {venta.rol}, %: {venta.porcentaje} - Comisión: {formatCurrency(venta.monto)}
                                                    {venta.notas && <span className={styles.comisionDetailNote}> ({venta.notas})</span>}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default ComisionesPage;