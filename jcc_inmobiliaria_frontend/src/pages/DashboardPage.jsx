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
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return '0.00%';
    }
    return `${Number(value).toFixed(2)}%`;
}

const MEDIO_CAPTACION_CHOICES = [
    { value: 'campo_opc', label: 'Campo OPC' }, { value: 'redes_facebook', label: 'Redes Facebook' },
    { value: 'redes_instagram', label: 'Redes Instagram' }, { value: 'redes_tiktok', label: 'Redes TikTok' },
    { value: 'referido', label: 'Referido' }, { value: 'web', label: 'Página Web' }, { value: 'otro', label: 'Otro' },
];
const STATUS_VENTA_CHOICES_DASHBOARD = [
    { value: 'separacion', label: 'Separación' },
    { value: 'procesable', label: 'Procesable' },
    { value: 'completada', label: 'Completada'},
    { value: 'anulado', label: 'Anulado' },
];

const DIRECT_CHART_COLORS_PALETTE = [
    '#2A4A6B', '#4DB0B5', '#28A745', '#FFC107', '#DC3545', '#17A2B8', 
    '#6C757D', '#5F86AC', '#F0AD4E', '#5BC0DE', '#D9534F', '#A0AEC0'
];

const COLOR_LOTE_DISPONIBLE = DIRECT_CHART_COLORS_PALETTE[5]; // Azul Cielo
const COLOR_LOTE_RESERVADO = DIRECT_CHART_COLORS_PALETTE[3];  // Ámbar
const COLOR_LOTE_VENDIDO = DIRECT_CHART_COLORS_PALETTE[0];   // Azul Oscuro

// Variable global para asegurar que la carga de Google Charts se intente solo una vez
let googleChartsLoadInitiated = false;

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
    const [chartsApiReady, setChartsApiReady] = useState(
        // Comprobar si ya está cargado al inicio (útil para HMR o navegación rápida)
        !!(window.google && window.google.visualization)
    );


    useEffect(() => {
        console.log("[DashboardPage] useEffect Carga Google Charts - Estado inicial chartsApiReady:", chartsApiReady, "googleChartsLoadInitiated:", googleChartsLoadInitiated);

        if (chartsApiReady) {
            console.log("[DashboardPage] Google Charts API ya marcada como lista.");
            return;
        }

        if (googleChartsLoadInitiated) {
            console.log("[DashboardPage] Carga de Google Charts ya iniciada previamente.");
            return;
        }
        
        if (window.google && window.google.charts) {
            googleChartsLoadInitiated = true; // Marcar que se ha iniciado la carga
            console.log("[DashboardPage] Iniciando window.google.charts.load...");
            window.google.charts.load('current', { 'packages': ['corechart', 'table', 'funnel'], 'language': 'es' });
            window.google.charts.setOnLoadCallback(() => {
                console.log("%c[DashboardPage] Google Charts API cargada y lista (setOnLoadCallback EJECUTADO).", "color: green; font-weight: bold;");
                setChartsApiReady(true);
            });
        } else {
            console.error("[DashboardPage] ERROR CRÍTICO: Librería de Google Charts (window.google o window.google.charts) no encontrada. Revisa index.html.");
            setDashboardError("No se pudo cargar la librería de gráficos de Google.");
        }
    }, []); // Ejecutar solo una vez al montar


    const fetchDashboardDataInternal = useCallback(async (currentFiltersToApply) => {
        // ... (sin cambios)
        setLoadingDashboard(true);
        console.log("[DashboardPage] Fetching dashboard data con filtros:", currentFiltersToApply);
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
            console.error("[DashboardPage] Error en fetchDashboardDataInternal:", msg, error);
            setDashboardError(msg);
            setDashboardData(null);
        } finally {
            setLoadingDashboard(false);
        }
    }, []);

    useEffect(() => { 
        // ... (loadAdvisors - sin cambios)
        const loadAdvisors = async () => {
            try {
                const advisorsResponse = await getAdvisorsForFilter();
                setAdvisorsForFilter(advisorsResponse.data || []);
            } catch (error) {
                console.error("[DashboardPage] Error cargando asesores:", error);
                setDashboardError(prev => `${prev || ''} Error cargando asesores.`.trim());
            }
        };
        loadAdvisors();
    }, []);
    
    useEffect(() => { 
        // ... (fetch con activeFilters - sin cambios)
        const activeFilters = Object.fromEntries(
            Object.entries(filters).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
        );
        console.log("[DashboardPage] Filtros activos para enviar a API:", activeFilters);
        fetchDashboardDataInternal(activeFilters);
    }, [filters, fetchDashboardDataInternal]);

    useEffect(() => {
        // ... (log dashboardData - sin cambios)
        console.log("[DashboardPage] Estado actualizado GENERAL - chartsApiReady:", chartsApiReady, "- dashboardData disponible:", !!dashboardData);
        if (dashboardData && chartsApiReady) {
            console.log("%c[DashboardPage] DATOS Y API DE GRÁFICOS LISTOS", "color: blue; font-weight: bold;");
            if (dashboardData.graficos) {
                console.log("[DashboardPage] Contenido de dashboardData.graficos:", JSON.stringify(dashboardData.graficos, null, 2));
            } else {
                console.warn("[DashboardPage] dashboardData.graficos es undefined o null.");
            }
        } else if (dashboardData && !chartsApiReady) {
             console.warn("[DashboardPage] Hay datos del dashboard, pero la API de gráficos aún no está lista.");
        }
    }, [dashboardData, chartsApiReady]);


    const handleFilterChange = (e) => { /* ... (sin cambios) ... */
        const { name, value } = e.target;
        setFilters(prevFilters => {
            const newFilters = { ...prevFilters, [name]: value };
            if (name === "startDate" && newFilters.endDate && value && newFilters.endDate < value) {
                setDashboardError("La fecha de inicio no puede ser posterior a la fecha de fin.");
                return prevFilters; 
            }
            if (name === "endDate" && newFilters.startDate && value && value < newFilters.startDate) {
                setDashboardError("La fecha de fin no puede ser anterior a la fecha de inicio.");
                return prevFilters; 
            }
            setDashboardError(null);
            return newFilters;
        });
    };
    const resetFilters = () => { /* ... (sin cambios) ... */
        setFilters(initialFilters); 
        setDashboardError(null);
    };
    
    const drawChart = useCallback((chartId, dataArray, specificOptions, chartType) => { /* ... (sin cambios) ... */
        const chartElement = document.getElementById(chartId);
        if (!chartElement) { 
            console.warn(`[drawChart] Elemento ${chartId} no encontrado en el DOM.`); 
            return; 
        }
        if (!chartsApiReady) {
            console.warn(`[drawChart] chartsApiReady es false. No se dibujará ${chartId}.`);
            chartElement.innerHTML = `<p class="${styles.noDataMessage}">Cargando librería de gráficos...</p>`; 
            return;
        }
        if (!dataArray || dataArray.length <= 1) { 
            console.log(`[drawChart] ${chartId}: No hay datos suficientes (o solo cabeceras). Mostrando 'Sin datos'. Datos:`, JSON.stringify(dataArray));
            if (chartElement.chart?.clearChart) chartElement.chart.clearChart();
            chartElement.innerHTML = `<p class="${styles.noDataMessage}">Sin datos para este gráfico.</p>`; 
            return;
        }
        console.log(`[drawChart] %cPreparando para dibujar ${chartId} (${chartType})`, "color: blue;", "Datos:", JSON.stringify(dataArray), "Opciones:", specificOptions);
        try {
            const dataTable = window.google.visualization.arrayToDataTable(dataArray);
            let chart;
            const baseChartOptions = { 
                backgroundColor: 'transparent', fontName: 'Inter, Open Sans, sans-serif', 
                titleTextStyle: { color: '#2A4A6B', fontName: 'Montserrat, sans-serif', fontSize: 16, bold: false },
                legendTextStyle: { color: '#6C757D', fontSize: 12 },
                hAxis: { textStyle: { color: '#6C757D', fontSize: 11 }, titleTextStyle: { color: '#6C757D', fontSize: 12, italic: false }, gridlines: { color: '#E9ECEF'}, baselineColor: '#E9ECEF' }, 
                vAxis: { textStyle: { color: '#6C757D', fontSize: 11 }, titleTextStyle: { color: '#6C757D', fontSize: 12, italic: false }, gridlines: { color: '#E9ECEF', count: 5 }, baselineColor: '#E9ECEF', viewWindow: {min: 0} },
                animation: { startup: true, duration: 1000, easing: 'out' },
                tooltip: { textStyle: { color: '#343A40', fontSize: 13 }, showColorCode: true, isHtml: specificOptions.tooltip?.isHtml || false },
                colors: DIRECT_CHART_COLORS_PALETTE, 
                chartArea: { left: 60, top: 50, width: '75%', height: '65%' },
                bar: { groupWidth: "70%" }, pieSliceBorderColor: 'transparent',
                pieSliceTextStyle: { color: '#FFFFFF', fontSize: 11 },
            };
            const mergedOptions = {...baseChartOptions, ...specificOptions, 
                chartArea: {...baseChartOptions.chartArea, ...specificOptions.chartArea}, 
                hAxis: {...baseChartOptions.hAxis, ...specificOptions.hAxis}, 
                vAxis: {...baseChartOptions.vAxis, ...specificOptions.vAxis},
                legend: {...baseChartOptions.legend, ...specificOptions.legend},
                titleTextStyle: {...baseChartOptions.titleTextStyle, ...specificOptions.titleTextStyle},
                tooltip: {...baseChartOptions.tooltip, ...specificOptions.tooltip}
            };
            if (specificOptions.colors && Array.isArray(specificOptions.colors) && specificOptions.colors.length > 0) {
                mergedOptions.colors = specificOptions.colors;
            }
            if (chartType === 'PieChart') chart = new window.google.visualization.PieChart(chartElement);
            else if (chartType === 'LineChart') chart = new window.google.visualization.LineChart(chartElement);
            else if (chartType === 'BarChart') chart = new window.google.visualization.BarChart(chartElement);
            else if (chartType === 'ColumnChart') chart = new window.google.visualization.ColumnChart(chartElement);
            else if (chartType === 'Table') chart = new window.google.visualization.Table(chartElement);
            else if (chartType === 'FunnelChart') chart = new window.google.visualization.FunnelChart(chartElement); // Mantener por si se arregla
            if (chart) {
                console.log(`[drawChart] %c${chartId}: Dibujando gráfico...`, "color: green;");
                window.google.visualization.events.removeAllListeners(chart); 
                chartElement.chart = chart; 
                chart.draw(dataTable, mergedOptions);
            } else { 
                console.error(`[drawChart] Tipo de gráfico no soportado: ${chartType} para ${chartId}`);
                chartElement.innerHTML = `<p class="${styles.errorMessage}" style="color: var(--color-acento-error);">Tipo de gráfico no soportado: ${chartType}</p>`; 
            }
        } catch (e) {
            console.error(`[drawChart] Error al procesar o dibujar ${chartId}:`, e);
            if (chartElement) { chartElement.innerHTML = `<p class="${styles.errorMessage}" style="color: var(--color-acento-error);">Error al dibujar gráfico (${e.message}).</p>`;}
        }
    }, [chartsApiReady, styles.noDataMessage, styles.errorMessage]);

    const chartHeight = 330;

    useEffect(() => { 
        // ... (useEffect para historicoVentasPresenciasChart - sin cambios) ...
        console.log("[useEffect historicoVentasPresenciasChart] Init. chartsApiReady:", chartsApiReady, "Data disponible:", !!dashboardData?.graficos?.historicoVentasPresencias);
        if (chartsApiReady && dashboardData?.graficos?.historicoVentasPresencias) {
            drawChart('historicoVentasPresenciasChart', dashboardData.graficos.historicoVentasPresencias, { 
                title: 'Histórico Ventas vs. Presencias (Cantidades)', 
                legend: { position: 'top', alignment: 'center' }, 
                vAxis: { title: 'Cantidad', format: '0', viewWindow: { min: 0 } }, 
                hAxis: { title: 'Mes', slantedText: true, slantedTextAngle: 30 }, 
                height: chartHeight + 20,
                series: { 0: { color: DIRECT_CHART_COLORS_PALETTE[0] }, 1: { color: DIRECT_CHART_COLORS_PALETTE[1]} },
                curveType: 'function', pointSize: 5
            }, 'LineChart');
        } else if (chartsApiReady && dashboardData) { 
             console.warn("[useEffect historicoVentasPresenciasChart] No hay datos específicos, dibujando 'Sin datos'.");
             drawChart('historicoVentasPresenciasChart', [['Mes', 'Ventas', 'Presencias'],['Sin datos', 0,0]], {title: 'Histórico Ventas vs. Presencias', height: chartHeight+20, colors: [DIRECT_CHART_COLORS_PALETTE[11]]}, 'LineChart');
        }
    }, [chartsApiReady, dashboardData?.graficos?.historicoVentasPresencias, drawChart]);

    useEffect(() => {
        // ... (useEffect para estadoVentasChart - sin cambios) ...
        console.log("[useEffect estadoVentasChart] Init. chartsApiReady:", chartsApiReady, "Data disponible:", !!dashboardData?.graficos?.estadoVentas);
        if (chartsApiReady && dashboardData?.graficos?.estadoVentas) {
            drawChart('estadoVentasChart', dashboardData.graficos.estadoVentas, {
                title: 'Estado de Ventas', pieHole: 0.4,
                legend: { position: 'right', alignment: 'center' },
                height: chartHeight,
                colors: [ 
                    DIRECT_CHART_COLORS_PALETTE[3], // Ámbar para Separación (asumiendo orden de datos)
                    DIRECT_CHART_COLORS_PALETTE[2], // Verde para Procesable
                    DIRECT_CHART_COLORS_PALETTE[4], // Rojo para Anulada
                    DIRECT_CHART_COLORS_PALETTE[6], // Gris para Completada
                    DIRECT_CHART_COLORS_PALETTE[11] // Fallback
                ] 
            }, 'PieChart');
        } else if (chartsApiReady && dashboardData) {
            console.warn("[useEffect estadoVentasChart] No hay datos específicos, dibujando 'Sin datos'.");
            drawChart('estadoVentasChart', [['Estado', 'Cantidad'],['Sin datos',0]], {title: 'Estado de Ventas', height: chartHeight, colors: [DIRECT_CHART_COLORS_PALETTE[11]]}, 'PieChart');
        }
    }, [chartsApiReady, dashboardData?.graficos?.estadoVentas, drawChart]);

    // --- GRÁFICO DE EMBUDO CORREGIDO A BARCHART ---
    useEffect(() => {
        console.log("[useEffect embudoVentasChart --> AHORA BarChart] Init. chartsApiReady:", chartsApiReady, "Data:", !!dashboardData?.graficos?.embudoVentas);
        if (chartsApiReady && dashboardData?.graficos?.embudoVentas && dashboardData.graficos.embudoVentas.length > 1) {
            // El backend ya debería enviar los datos en formato: [['Etapa', 'Cantidad', 'Tooltip HTML'], ...]
            // Para BarChart, solo necesitamos las dos primeras columnas para los datos principales.
            // El tooltip HTML se manejará a través de la opción `tooltip: {isHtml: true}` si se pasa correctamente.
            // O, si se quiere un tooltip estándar, se omite la tercera columna de datos.
            
            const embudoDataForBar = dashboardData.graficos.embudoVentas.map(row => [row[0], row[1]]);
            // Si quieres mantener el tooltip HTML, la columna de tooltip debe ser manejada de forma especial
            // o se puede construir una columna de anotación/tooltip para el BarChart.
            // Por simplicidad, usaremos el tooltip estándar generado por las dos primeras columnas.

            drawChart('embudoVentasChart', embudoDataForBar, { 
                title: 'Embudo de Conversión (Barras)',
                legend: { position: 'none' },
                height: chartHeight + 20,
                chartArea: { left: 150, top: 50, width: '60%', height: '70%' },
                hAxis: { title: 'Cantidad', minValue: 0, format: '0' },
                vAxis: { title: 'Etapa' }, // El eje vertical ahora son las etapas
                colors: [DIRECT_CHART_COLORS_PALETTE[8]] // Un color para las barras
            }, 'BarChart'); 
        } else if (chartsApiReady && dashboardData) {
             console.warn("[useEffect embudoVentasChart] No hay datos suficientes, dibujando 'Sin datos'.");
            drawChart('embudoVentasChart', [['Etapa', 'Valor'],['Sin datos', 0]], {title: 'Embudo de Conversión', height: chartHeight + 20, colors: [DIRECT_CHART_COLORS_PALETTE[11]]}, 'BarChart');
        }
    }, [chartsApiReady, dashboardData?.graficos?.embudoVentas, drawChart]);

    // GRÁFICO 4: Disponibilidad de Lotes (Tabla Detallada)
    useEffect(() => {
        console.log("[useEffect tablaDisponibilidadLotes] Init. chartsApiReady:", chartsApiReady, "Data:", dashboardData?.graficos?.tablaDisponibilidadLotes);
        if (chartsApiReady && dashboardData?.graficos?.tablaDisponibilidadLotes) {
            const rawData = dashboardData.graficos.tablaDisponibilidadLotes;

            if (rawData && rawData.length > 0) {
                const dataForTable = [
                    [ 
                        {label: 'Proyecto', type: 'string'},
                        {label: 'Total', type: 'number'},
                        {label: 'Disp.', type: 'number'},
                        {label: '% Disp.', type: 'string'},
                        {label: 'Avance Disp.', type: 'string'}, // Celda para HTML
                        {label: 'Res.', type: 'number'},
                        {label: '% Res.', type: 'string'},
                        {label: 'Avance Res.', type: 'string'}, // Celda para HTML
                        {label: 'Vend.', type: 'number'},
                        {label: '% Vend.', type: 'string'},
                        {label: 'Avance Vend.', type: 'string'}  // Celda para HTML
                    ]
                ];

                rawData.forEach(item => {
                    const total = item.total_lotes || 0;
                    const dispCant = item.disponibles_cantidad || 0;
                    const resCant = item.reservados_cantidad || 0;
                    const vendCant = item.vendidos_cantidad || 0;

                    const dispPerc = total > 0 ? (dispCant / total * 100) : 0;
                    const resPerc = total > 0 ? (resCant / total * 100) : 0;
                    const vendPerc = total > 0 ? (vendCant / total * 100) : 0;
                    
                    // Función para crear la barra HTML
                    const createBarHtml = (percentage, color) => {
                        const percRounded = Math.max(0, Math.min(100, percentage.toFixed(0))); // Asegurar entre 0 y 100
                        return `
                            <div style="width: 100%; height: 18px; background-color: var(--color-fondo-alternating-row, #f0f0f0); border: 1px solid var(--color-borde-general, #ccc); border-radius: 3px; position: relative; overflow: hidden;">
                                <div style="width: ${percRounded}%; height: 100%; background-color: ${color};"></div>
                                <span style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font-size: 10px; color: ${percRounded > 50 ? 'white' : 'black'}; mix-blend-mode: ${percRounded > 50 ? 'normal' : 'difference'};">
                                    ${percRounded}%
                                </span>
                            </div>`;
                    };

                    dataForTable.push([
                        item.proyecto,
                        total,
                        dispCant, `${dispPerc.toFixed(1)}%`, createBarHtml(dispPerc, COLOR_LOTE_DISPONIBLE),
                        resCant, `${resPerc.toFixed(1)}%`, createBarHtml(resPerc, COLOR_LOTE_RESERVADO),
                        vendCant, `${vendPerc.toFixed(1)}%`, createBarHtml(vendPerc, COLOR_LOTE_VENDIDO)
                    ]);
                });
                
                drawChart('disponibilidadLotesTableChart', dataForTable, {
                    title: 'Disponibilidad de Lotes por Proyecto',
                    height: 'auto', 
                    width: '100%',
                    allowHtml: true, // MUY IMPORTANTE para las barras HTML
                    sort: 'disable',
                    cssClassNames: {
                        headerRow: styles.googleTableHeaderRow, tableRow: styles.googleTableRow,
                        oddTableRow: styles.googleTableOddRow, headerCell: styles.googleTableHeaderCell,
                        tableCell: styles.googleTableCellLotes || styles.googleTableCell 
                    },
                    titleTextStyle: { fontSize: 16 }
                }, 'Table');

            } else {
                console.warn("[useEffect tablaDisponibilidadLotes] No hay datos brutos para la tabla, dibujando 'Sin datos'.");
                drawChart('disponibilidadLotesTableChart', 
                    [['Proyecto', 'Total', 'Disp.', '% Disp.', 'Avance Disp.', 'Res.', '% Res.', 'Avance Res.', 'Vend.', '% Vend.', 'Avance Vend.'], ['Sin datos', 0,0,'0%',null,0,'0%',null,0,'0%',null]],
                    {title: 'Disponibilidad de Lotes por Proyecto', height: 'auto', allowHtml:true, cssClassNames: {headerCell: styles.googleTableHeaderCell, tableCell: styles.googleTableCell}}, 
                    'Table'
                );
            }
        } else if (chartsApiReady && dashboardData) {
            console.warn("[useEffect tablaDisponibilidadLotes] dashboardData.graficos.tablaDisponibilidadLotes es undefined o null.");
            drawChart('disponibilidadLotesTableChart', 
                 [['Proyecto', 'Total', 'Disp.', '% Disp.', 'Avance Disp.', 'Res.', '% Res.', 'Avance Res.', 'Vend.', '% Vend.', 'Avance Vend.'], ['Sin datos', 0,0,'0%',null,0,'0%',null,0,'0%',null]],
                {title: 'Disponibilidad de Lotes por Proyecto', height: 'auto', allowHtml:true, cssClassNames: {headerCell: styles.googleTableHeaderCell, tableCell: styles.googleTableCell}}, 
                'Table'
            );
        }
    }, [chartsApiReady, dashboardData?.graficos?.tablaDisponibilidadLotes, drawChart, styles]); // Agregado styles a dependencias


    useEffect(() => {
        // ... (useEffect para rankingAsesoresChart - sin cambios) ...
        console.log("[useEffect rankingAsesoresChart] Init. chartsApiReady:", chartsApiReady, "Data disponible:", !!dashboardData?.graficos?.rankingAsesores);
        if (chartsApiReady && dashboardData?.graficos?.rankingAsesores) {
            drawChart('rankingAsesoresChart', dashboardData.graficos.rankingAsesores, {
                title: 'Ranking de Asesores por Estado de Venta',
                height: chartHeight + 80, width: '100%', allowHtml: true,
                cssClassNames: {
                    headerRow: styles.googleTableHeaderRow, tableRow: styles.googleTableRow,
                    oddTableRow: styles.googleTableOddRow, selectedTableRow: styles.googleTableSelectedRow,
                    hoverTableRow: styles.googleTableHoverRow, headerCell: styles.googleTableHeaderCell,
                    tableCell: styles.googleTableCell,
                },
                sort: 'disable', 
            }, 'Table');
        } else if (chartsApiReady && dashboardData) {
             console.warn("[useEffect rankingAsesoresChart] No hay datos específicos, dibujando 'Sin datos'.");
             drawChart('rankingAsesoresChart', [['Asesor', 'Tipo', 'Roles', 'Total Ventas', 'Separación', 'Procesable', 'Anulada', 'Completada'],['Sin datos', '-', '-', 0, 0,0,0,0]], {title: 'Ranking de Asesores', height: chartHeight + 80, colors: [DIRECT_CHART_COLORS_PALETTE[11]]}, 'Table');
        }
    }, [chartsApiReady, dashboardData?.graficos?.rankingAsesores, drawChart, styles]);

    useEffect(() => {
        // ... (useEffect para recaudoMedioCaptacionChart - sin cambios) ...
        console.log("[useEffect recaudoMedioCaptacionChart] Init. chartsApiReady:", chartsApiReady, "Data disponible:", !!dashboardData?.graficos?.recaudoPorMedioCaptacion);
        if (chartsApiReady && dashboardData?.graficos?.recaudoPorMedioCaptacion) {
            drawChart('recaudoMedioCaptacionChart', dashboardData.graficos.recaudoPorMedioCaptacion, {
                title: 'Recaudo por Medio de Captación (S/.)',
                legend: { position: 'none' },
                hAxis: { title: 'Medio de Captación', slantedText: true, slantedTextAngle: 45 },
                vAxis: { title: 'Recaudo Total (S/.)', format: 'short', viewWindow: {min: 0} },
                height: chartHeight + 40, 
                colors: DIRECT_CHART_COLORS_PALETTE.slice(0,6) 
            }, 'ColumnChart'); 
        } else if (chartsApiReady && dashboardData) {
            console.warn("[useEffect recaudoMedioCaptacionChart] No hay datos específicos, dibujando 'Sin datos'.");
            drawChart('recaudoMedioCaptacionChart', [['Medio', 'Recaudo'],['Sin datos',0]], {title: 'Recaudo por Medio de Captación (S/.)', height: chartHeight + 40, colors: [DIRECT_CHART_COLORS_PALETTE[11]]}, 'ColumnChart');
        }
    }, [chartsApiReady, dashboardData?.graficos?.recaudoPorMedioCaptacion, drawChart]);

    return (
        <div className={styles.pageContainer}>
            <div className={styles.filterBar}> 
                <input type="date" name="startDate" title="Fecha Inicio" value={filters.startDate} onChange={handleFilterChange} className={styles.filterDate}/>
                <input type="date" name="endDate" title="Fecha Fin" value={filters.endDate} onChange={handleFilterChange} className={styles.filterDate}/>
                <select name="asesorId" value={filters.asesorId} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Asesor"><option value="">Asesor: Todos</option>{advisorsForFilter.map(adv => (<option key={adv.id} value={adv.id}>{adv.name}</option>))}</select>
                <select name="tipoVenta" value={filters.tipoVenta} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Tipo de Venta"><option value="">Tipo Venta: Todos</option><option value="credito">Crédito</option><option value="contado">Contado</option></select>
                <select name="tipoAsesor" value={filters.tipoAsesor} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Tipo Asesor (Rankings)"><option value="">Tipo Asesor: Todos</option><option value="Junior">Junior</option><option value="Socio">Socio</option></select>
                <select name="medio_captacion" value={filters.medio_captacion} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Medio de Captación"><option value="">Medio Captación: Todos</option>{MEDIO_CAPTACION_CHOICES.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
                <select name="status_venta" value={filters.status_venta} onChange={handleFilterChange} className={styles.filterSelectCompact} title="Status de Venta"><option value="">Status Venta: Todos</option>{STATUS_VENTA_CHOICES_DASHBOARD.map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}</select>
                <button onClick={resetFilters} className={styles.resetButtonCompact} title="Limpiar Filtros">Limpiar</button>
            </div>

            {dashboardError && <div className={`${styles.errorMessage} ${styles.marginBottom}`}>{dashboardError}</div>}
            {loadingDashboard && <div className={styles.loadingMessage}>Cargando datos del dashboard...</div>}

            {!loadingDashboard && dashboardData && (
                <>
                    <div className={styles.kpiGrid}>
                        {/* ... (KPIs sin cambios) ... */}
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Monto Total Recaudo</h3><p className={styles.kpiValue}>{formatCurrency(dashboardData.tarjetas?.montoTotalRecaudo)}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>N° Presencias Realizadas</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.nPresenciasRealizadas || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Tasa Conversión Ventas</h3><p className={styles.kpiValue}>{formatPercentage(dashboardData.tarjetas?.tasaConversionVentas)}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>N° Ventas Procesables</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.nVentasProcesables || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Lotes Disponibles</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.lotesDisponibles || 0}</p></div>
                        <div className={styles.kpiCard}><h3 className={styles.kpiTitle}>Lotes Vendidos</h3><p className={styles.kpiValue}>{dashboardData.tarjetas?.lotesVendidos || 0}</p></div>
                    </div>
                    
                    {chartsApiReady && !dashboardError?.includes("No se pudo cargar la librería de gráficos") && (
                         <div className={styles.chartsGrid}> {/* Este grid contendrá todos los gráficos y tablas */}
                            
                            {/* Fila 1 de Gráficos (2 módulos) */}
                            <div className={styles.chartContainer}>
                                <div id="historicoVentasPresenciasChart" className={styles.chart}></div>
                            </div>
                            <div className={styles.chartContainer}>
                                <div id="estadoVentasChart" className={styles.chart}></div>
                            </div>
                            
                            {/* Fila 2 de Gráficos (2 módulos) */}
                            <div className={styles.chartContainer}>
                                <div id="embudoVentasChart" className={styles.chart}></div>
                            </div>
                            <div className={styles.chartContainer}>
                                <div id="recaudoMedioCaptacionChart" className={styles.chart}></div>
                            </div>

                            {/* Fila 3 de Gráficos - Tabla de Disponibilidad de Lotes (Ocupa 2 módulos) */}
                            <div className={`${styles.chartContainer} ${styles.disponibilidadLotesTableContainer}`}> 
                                <div id="disponibilidadLotesTableChart" className={styles.chart}></div>
                            </div>
                            
                            {/* Fila 4 de Gráficos - Tabla de Ranking de Asesores (Ocupa 2 módulos) */}
                            <div className={`${styles.chartContainer} ${styles.rankingAsesoresContainer}`}>
                                <div id="rankingAsesoresChart" className={styles.chart}></div>
                            </div> 
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