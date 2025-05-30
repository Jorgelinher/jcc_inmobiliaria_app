// src/pages/DashboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
    getDashboardDataFromApi,
    getAdvisorsForFilter
} from '../services/apiService';
import styles from './DashboardPage.module.css';

function formatCurrency(value, currency = 'PEN') {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return Number(0).toLocaleString('es-PE', {
            style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2
        });
    }
    return Number(value).toLocaleString('es-PE', {
        style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

const MEDIO_CAPTACION_CHOICES = [
    { value: 'campo_opc', label: 'Campo OPC' }, { value: 'redes_facebook', label: 'Redes Facebook' },
    { value: 'redes_instagram', label: 'Redes Instagram' }, { value: 'redes_tiktok', label: 'Redes TikTok' },
    { value: 'referido', label: 'Referido' }, { value: 'web', label: 'Página Web' }, { value: 'otro', label: 'Otro' },
];
const STATUS_VENTA_CHOICES = [
    { value: 'separacion', label: 'Separación' },
    { value: 'procesable', label: 'Procesable' },
    { value: 'completada', label: 'Completada'},
    { value: 'anulado', label: 'Anulado' },
];

// Paleta de colores DIRECTA y variada para los gráficos
const DIRECT_CHART_COLORS_PALETTE = [
    '#2A4A6B', // Azul Corporativo Profundo
    '#4DB0B5', // Turquesa Suave
    '#28A745', // Verde Esmeralda
    '#17A2B8', // Azul Cielo
    '#FFC107', // Ámbar
    '#5F86AC', // Azul Primario Claro
    '#7FCDD1', // Turquesa Secundario Claro
    '#A0AEC0'  // Gris Neutro Gráfico
];

function DashboardPage() {
    const initialFilters = {
        startDate: '', endDate: '', asesorId: '',
        tipoVenta: '', tipoAsesor: '', medio_captacion: '', status_venta: '',
    };
    const [filters, setFilters] = useState(initialFilters);
    const [advisorsForFilter, setAdvisorsForFilter] = useState([]);
    const [dashboardData, setDashboardData] = useState(null);
    const [loadingDashboard, setLoadingDashboard] = useState(true);
    const [dashboardError, setDashboardError] = useState(null);
    const [chartsApiReady, setChartsApiReady] = useState(false);

    // Cargar API de Google Charts
    useEffect(() => {
        console.log("[DashboardPage] Verificando Google Charts...");
        if (window.google && window.google.charts) {
            if (window.google.visualization && chartsApiReady) {
                console.log("[DashboardPage] Google Charts API ya lista y marcada.");
                return;
            }
            console.log("[DashboardPage] Cargando paquetes de Google Charts...");
            window.google.charts.load('current', { 'packages': ['corechart', 'bar', 'line'], 'language': 'es' });
            window.google.charts.setOnLoadCallback(() => {
                console.log("[DashboardPage] Google Charts API cargada (setOnLoadCallback).");
                if (!chartsApiReady) setChartsApiReady(true);
            });
        } else {
            console.error("[DashboardPage] ERROR: Librería de Google Charts no encontrada.");
            setDashboardError("No se pudo cargar la librería de gráficos.");
            setChartsApiReady(false);
        }
    }, [chartsApiReady]);


    const fetchDashboardDataInternal = useCallback(async (currentFiltersToApply) => {
        setLoadingDashboard(true);
        console.log("[DashboardPage] ==> Iniciando fetchDashboardDataInternal con filtros:", currentFiltersToApply);
        try {
            const response = await getDashboardDataFromApi(currentFiltersToApply);
            console.log("[DashboardPage] Respuesta de getDashboardDataFromApi:", response);
            if (response?.data?.success) {
                setDashboardData(response.data);
                setDashboardError(null);
            } else {
                setDashboardError(response?.data?.message || "No se recibieron datos válidos del dashboard.");
                setDashboardData(null);
            }
        } catch (error) {
            let msg = "Error al conectar con el servidor para el dashboard.";
            if (error.response?.data) {
                msg += ` Detalle: ${error.response.data.detail || JSON.stringify(error.response.data)}`;
            } else if (error.message) { msg += ` ${error.message}`; }
            setDashboardError(msg);
            setDashboardData(null);
        } finally {
            setLoadingDashboard(false);
        }
    }, []);

    useEffect(() => { // Cargar asesores para el filtro
        const loadAdvisors = async () => {
            try {
                const advisorsResponse = await getAdvisorsForFilter();
                setAdvisorsForFilter(advisorsResponse.data || []);
            } catch (error) {
                setDashboardError(prev => `${prev || ''} Error cargando asesores.`.trim());
            }
        };
        loadAdvisors();
    }, []);
    
    useEffect(() => { // Fetch data cuando los filtros cambian
        console.log("[DashboardPage] useEffect[filters] disparado. Filtros:", filters);
        // Crear objeto solo con filtros que tienen valor
        const activeFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
        );
        fetchDashboardDataInternal(activeFilters);
    }, [filters, fetchDashboardDataInternal]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prevFilters => {
            const newFilters = { ...prevFilters, [name]: value };
            if (name === "startDate" && newFilters.endDate && value && newFilters.endDate < value) {
                setDashboardError("La fecha de inicio no puede ser posterior a la fecha de fin.");
                return prevFilters; // No actualizar si es inválido
            }
            if (name === "endDate" && newFilters.startDate && value && value < newFilters.startDate) {
                setDashboardError("La fecha de fin no puede ser anterior a la fecha de inicio.");
                return prevFilters; // No actualizar si es inválido
            }
            setDashboardError(null);
            return newFilters;
        });
    };

    const resetFilters = () => { 
        setFilters(initialFilters); 
        setDashboardError(null);
    };
    
    const drawChart = useCallback((chartId, dataArray, specificOptions, chartType) => {
        const chartElement = document.getElementById(chartId);
        if (!chartElement) { console.warn(`[DashboardPage] Elemento ${chartId} no encontrado.`); return; }
        
        if (!chartsApiReady) {
            chartElement.innerHTML = `<p class="${styles.noDataMessage}">Cargando librería de gráficos...</p>`; return;
        }
        
        if (!dataArray || dataArray.length <= 1) { 
            if (chartElement.chart?.clearChart) chartElement.chart.clearChart();
            chartElement.innerHTML = `<p class="${styles.noDataMessage}">Sin datos para este gráfico.</p>`; return;
        }

        try {
            const dataTable = window.google.visualization.arrayToDataTable(dataArray);
            let chart;

            // Opciones base con estilos y paleta de colores DIRECTA
            const baseChartOptions = { 
                backgroundColor: 'transparent',
                fontName: 'Inter, Open Sans, sans-serif', 
                titleTextStyle: { color: '#2A4A6B', fontName: 'Montserrat, sans-serif', fontSize: 16, bold: false },
                legendTextStyle: { color: '#6C757D', fontSize: 12 },
                hAxis: { textStyle: { color: '#6C757D', fontSize: 11 }, titleTextStyle: { color: '#6C757D', fontSize: 12, italic: false }, gridlines: { color: '#E9ECEF'}, baselineColor: '#E9ECEF' }, 
                vAxis: { textStyle: { color: '#6C757D', fontSize: 11 }, titleTextStyle: { color: '#6C757D', fontSize: 12, italic: false }, gridlines: { color: '#E9ECEF', count: 5 }, baselineColor: '#E9ECEF', viewWindow: {min: 0} },
                animation: { startup: true, duration: 1000, easing: 'out' },
                tooltip: { textStyle: { color: '#343A40', fontSize: 13 }, showColorCode: true },
                colors: DIRECT_CHART_COLORS_PALETTE, // USAR LA PALETA DIRECTA
                chartArea: { left: 60, top: 50, width: '75%', height: '65%' },
                bar: { groupWidth: "70%" },
                pieSliceBorderColor: 'transparent',
                pieSliceTextStyle: { color: '#FFFFFF', fontSize: 11 },
            };
            
            const mergedOptions = {...baseChartOptions, ...specificOptions, 
                chartArea: {...baseChartOptions.chartArea, ...specificOptions.chartArea}, 
                hAxis: {...baseChartOptions.hAxis, ...specificOptions.hAxis}, 
                vAxis: {...baseChartOptions.vAxis, ...specificOptions.vAxis},
                legend: {...baseChartOptions.legend, ...specificOptions.legend},
                titleTextStyle: {...baseChartOptions.titleTextStyle, ...specificOptions.titleTextStyle}
            };
            
            // Si specificOptions tiene su propio array 'colors', ese tomará precedencia.
            // De lo contrario, se usarán los de baseChartOptions.
            if (specificOptions.colors && Array.isArray(specificOptions.colors) && specificOptions.colors.length > 0) {
                mergedOptions.colors = specificOptions.colors;
            }
            
            console.log(`[DashboardPage] Opciones finales para ${chartId}:`, JSON.stringify(mergedOptions.colors));

            if (chartType === 'PieChart') chart = new window.google.visualization.PieChart(chartElement);
            else if (chartType === 'LineChart') chart = new window.google.visualization.LineChart(chartElement);
            else if (chartType === 'BarChart') chart = new window.google.visualization.BarChart(chartElement);
            else if (chartType === 'ColumnChart') chart = new window.google.visualization.ColumnChart(chartElement);
            
            if (chart) {
                window.google.visualization.events.removeAllListeners(chart);
                chartElement.chart = chart; 
                chart.draw(dataTable, mergedOptions);
            } else { chartElement.innerHTML = `<p class="${styles.errorMessage}" style="color: var(--color-acento-error);">Tipo de gráfico no soportado: ${chartType}</p>`; }
        } catch (e) {
            console.error(`Error al dibujar ${chartId}:`, e);
            if (chartElement) { chartElement.innerHTML = `<p class="${styles.errorMessage}" style="color: var(--color-acento-error);">Error al dibujar gráfico (${e.message}).</p>`;}
        }
    }, [chartsApiReady, styles.noDataMessage, styles.errorMessage]);

    const chartHeight = 330;

    // --- INICIO: useEffects para cada gráfico CON COLORES ESPECÍFICOS POR GRÁFICO ---
    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.ventasPorTipo) {
                drawChart('ventasPorTipoChart', dashboardData.graficos.ventasPorTipo, { 
                    title: 'Ventas por Tipo', 
                    pieHole: 0.4, 
                    legend: { position: 'top', alignment: 'center', maxLines: 2 }, 
                    height: chartHeight, 
                    chartArea: {left:10,top:60,width:'90%',height:'70%'},
                    colors: DIRECT_CHART_COLORS_PALETTE // Usar la paleta completa para PieChart
                }, 'PieChart');
            } else {
                drawChart('ventasPorTipoChart', [['Tipo', 'Cantidad'], ['Sin datos', 0]], {title: 'Ventas por Tipo', height: chartHeight, colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'PieChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.ventasPorTipo, drawChart]);

    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.ventasMensuales) {
                drawChart('ventasMensualesChart', dashboardData.graficos.ventasMensuales, { 
                    title: 'Evolución de Ventas (S/.)', 
                    legend: { position: 'none' }, 
                    vAxis: { format: 'short' }, 
                    hAxis: { slantedText: true, slantedTextAngle: 30 }, 
                    height: chartHeight,
                    colors: [DIRECT_CHART_COLORS_PALETTE[0]] // Azul Corporativo
                }, 'ColumnChart');
            } else {
                drawChart('ventasMensualesChart', [['Mes', 'Monto'], ['Sin datos', 0]], {title: 'Evolución de Ventas (S/.)', height: chartHeight, colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'ColumnChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.ventasMensuales, drawChart]);

    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.rankingJuniors) {
                drawChart('rankingJuniorsChart', dashboardData.graficos.rankingJuniors, { 
                    title: 'Top Junior (N° Ventas)', 
                    chartArea: {width: '60%', height: '70%', top: 30, left: 130}, 
                    hAxis: {minValue: 0, format: '0' }, 
                    bars: 'horizontal', 
                    legend: { position: 'none' }, 
                    height: chartHeight - 20,
                    colors: [DIRECT_CHART_COLORS_PALETTE[1]] // Turquesa Suave
                }, 'BarChart');
            } else {
                drawChart('rankingJuniorsChart', [['Asesor', 'Ventas'], ['Sin datos', 0]], {title: 'Top Junior (N° Ventas)', colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'BarChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.rankingJuniors, drawChart]);

    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.rankingSocios) {
                drawChart('rankingSociosChart', dashboardData.graficos.rankingSocios, { 
                    title: 'Top Socio (N° Ventas)', 
                    chartArea: {width: '60%', height: '65%', top: 40, left: 130}, 
                    hAxis: {minValue: 0, format: '0' }, 
                    bars: 'horizontal', 
                    legend: { position: 'none' }, 
                    height: chartHeight - 20,
                    colors: [DIRECT_CHART_COLORS_PALETTE[2]] // Verde Esmeralda
                }, 'BarChart');
            } else {
                drawChart('rankingSociosChart', [['Asesor', 'Ventas'], ['Sin datos', 0]], {title: 'Top Socio (N° Ventas)', colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'BarChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.rankingSocios, drawChart]);
    
    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.recaudoMensual) {
                drawChart('recaudoMensualChart', dashboardData.graficos.recaudoMensual, { 
                    title: 'Recaudo Mensual (S/.)', 
                    legend: { position: 'none' }, 
                    vAxis: { format: 'short' }, 
                    hAxis: { slantedText: true, slantedTextAngle: 30 }, 
                    height: chartHeight,
                    colors: [DIRECT_CHART_COLORS_PALETTE[3]] // Azul Cielo
                }, 'ColumnChart');
            } else {
                drawChart('recaudoMensualChart', [['Mes', 'Monto'], ['Sin datos', 0]], {title: 'Recaudo Mensual (S/.)', height: chartHeight, colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'ColumnChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.recaudoMensual, drawChart]);

    useEffect(() => { 
        if (chartsApiReady) { 
            if (dashboardData?.graficos?.historicoPresencias) {
                drawChart('historicoPresenciasChart', dashboardData.graficos.historicoPresencias, { 
                    title: `Histórico de Presencias`, 
                    legend: { position: 'none' }, 
                    vAxis: { title: 'Cantidad', format: '0'}, 
                    hAxis: { slantedText: true, slantedTextAngle: 30 }, 
                    height: chartHeight,
                    colors: [DIRECT_CHART_COLORS_PALETTE[4]] // Ámbar
                }, 'ColumnChart');
            } else {
                drawChart('historicoPresenciasChart', [['Periodo', 'Cantidad'],['Sin datos', 0]], {title: 'Histórico de Presencias', height: chartHeight, colors: [DIRECT_CHART_COLORS_PALETTE[7]]}, 'ColumnChart');
            }
        }
    }, [chartsApiReady, dashboardData?.graficos?.historicoPresencias, drawChart]);
    // --- FIN: useEffects para cada gráfico ---
    return (
        <div className={styles.pageContainer}>
            <div className={styles.filterBar}> 
                <input type="date" name="startDate" title="Fecha Inicio" value={filters.startDate} onChange={handleFilterChange} className={styles.filterDate}/>
                <input type="date" name="endDate" title="Fecha Fin" value={filters.endDate} onChange={handleFilterChange} className={styles.filterDate}/>
                <select name="asesorId" value={filters.asesorId} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Asesor"><option value="">Asesor: Todos</option>{advisorsForFilter.map(adv => (<option key={adv.id} value={adv.id}>{adv.name}</option>))}</select>
                <select name="tipoVenta" value={filters.tipoVenta} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Tipo de Venta"><option value="">Tipo Venta: Todos</option><option value="credito">Crédito</option><option value="contado">Contado</option></select>
                <select name="tipoAsesor" value={filters.tipoAsesor} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Tipo Asesor (Rankings)"><option value="">Tipo Asesor: Todos</option><option value="Junior">Junior</option><option value="Socio">Socio</option></select>
                <select name="medio_captacion" value={filters.medio_captacion} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Medio de Captación"><option value="">Medio Captación: Todos</option>{MEDIO_CAPTACION_CHOICES.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
                <select name="status_venta" value={filters.status_venta} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Status de Venta"><option value="">Status Venta: Todos</option>{STATUS_VENTA_CHOICES.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
                <button onClick={resetFilters} className={styles.resetButtonCompact} title="Limpiar Filtros">Limpiar</button>
            </div>

            {dashboardError && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{dashboardError}</div>}
            {loadingDashboard && <div className={styles.loadingMessage}>Cargando datos del dashboard...</div>}

            {!loadingDashboard && dashboardData && (
                <>
                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Monto Total Ventas</h3><p className={styles.kpiValue}>{formatCurrency(dashboardData.tarjetas?.totalVentasMonto)}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>N° Ventas</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.totalVentasNumero || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Asesores Activos</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.asesoresActivos || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Lotes Disponibles</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.lotesDisponibles || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Lotes Reservados</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.lotesReservados || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Lotes Vendidos</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.lotesVendidos || 0}</p></div>
                    </div>
                    
                    {chartsApiReady && !dashboardError?.includes("No se pudo cargar la librería de gráficos") && (
                         <div className={styles.chartsGrid}>
                            <div className={styles.chartContainer}><div id="ventasPorTipoChart" className={styles.chart}></div></div>
                            <div className={styles.chartContainer}><div id="ventasMensualesChart" className={styles.chart}></div></div>
                            <div className={styles.chartContainer}><div id="recaudoMensualChart" className={styles.chart}></div></div>
                            <div className={styles.chartContainer}><div id="historicoPresenciasChart" className={styles.chart}></div></div>
                            <div className={styles.chartContainer}><div id="rankingJuniorsChart" className={styles.chart}></div></div>
                            <div className={styles.chartContainer}><div id="rankingSociosChart" className={styles.chart}></div></div>
                        </div>
                    )}
                </>
            )}
            {!loadingDashboard && !dashboardData && !dashboardError && (
                   <p className={styles.noDataMessage}>No se encontraron datos para el dashboard con los filtros seleccionados.</p>
            )}
        </div>
    );
}
export default DashboardPage;