import React, { useEffect, useState, useCallback } from 'react';
import GestionCobranzaForm from '../components/forms/GestionCobranzaForm';
import * as apiService from '../services/apiService';
import cobranzasStyles from './CobranzasPage.module.css';

function HistorialModal({ cuota, onClose }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!cuota) return;
    setLoading(true);
    apiService.get(`/gestion/cobranzas/gestiones/?cuota=${cuota.id_cuota}`)
      .then(res => setHistorial(res.data.results || res.data))
      .catch(() => setHistorial([]))
      .finally(() => setLoading(false));
  }, [cuota]);
  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.35)',
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        padding: '32px 36px 24px 36px',
        minWidth: 340,
        maxWidth: 500,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative',
        border: '1px solid #e3e3e3',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute',
          top: 14,
          right: 18,
          background: 'none',
          border: 'none',
          fontSize: '2rem',
          color: '#2A4A6B',
          cursor: 'pointer',
          fontWeight: 700,
          lineHeight: 1
        }} title="Cerrar">×</button>
        <h2 style={{
          marginTop: 0,
          marginBottom: 18,
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 24,
          color: '#2A4A6B',
          textAlign: 'center',
          borderBottom: '1px solid #e3e3e3',
          paddingBottom: 10,
          fontWeight: 700
        }}>
          Historial de Gestiones<br/>
          <span style={{fontSize: 15, color: '#444', fontWeight: 400}}>Cuota #{cuota?.numero_cuota}</span>
        </h2>
        {loading ? <div style={{textAlign:'center', color:'#888'}}>Cargando...</div> : (
          <ul style={{listStyle: 'none', padding: 0, margin: 0, maxHeight: 260, overflowY: 'auto'}}>
            {historial.length === 0 ? (
              <li style={{color: '#888', textAlign:'center'}}>No hay gestiones registradas.</li>
            ) : (
              historial.map(g => (
                <li key={g.id} style={{padding: '10px 0', borderBottom: '1px solid #f0f0f0', fontSize: '1rem'}}>
                  <b>{g.tipo_contacto}</b> - {g.resultado} <br />
                  <span style={{ fontSize: '0.95em', color: '#888' }}>{g.responsable_nombre} | {new Date(g.fecha_gestion).toLocaleString('es-PE')}</span>
                  {g.proximo_seguimiento && <span style={{ marginLeft: 10, color: '#007bff' }}>Próx. seguimiento: {new Date(g.proximo_seguimiento).toLocaleDateString('es-PE')}</span>}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

function agruparCuotasPorVenta(cuotas) {
  // Agrupa cuotas por venta (cliente + lote)
  const ventas = {};
  cuotas.forEach(cuota => {
    const key = `${cuota.cliente}||${cuota.lote}`;
    if (!ventas[key]) ventas[key] = { cliente: cuota.cliente, lote: cuota.lote, cuotas: [] };
    ventas[key].cuotas.push(cuota);
  });
  return Object.values(ventas);
}

function CobranzasPage() {
  const [cuotas, setCuotas] = useState([]);
  const [ventasAgrupadas, setVentasAgrupadas] = useState([]);
  const [filtros, setFiltros] = useState({ cliente: '', proyecto: '', diasVencidos: '' });
  const [selectedCuota, setSelectedCuota] = useState(null);
  const [showGestionModal, setShowGestionModal] = useState(false);
  const [showHistorialModal, setShowHistorialModal] = useState(false);
  const [historialCuota, setHistorialCuota] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedVentas, setExpandedVentas] = useState([]); // Para controlar qué ventas están expandidas

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const fetchCuotas = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      const params = {};
      if (currentFilters.cliente) params.cliente = currentFilters.cliente;
      if (currentFilters.proyecto) params.proyecto = currentFilters.proyecto;
      
      // No usar paginación del backend, obtener todas las cuotas
      const res = await apiService.get('/gestion/cobranzas/cuotas-pendientes/', { params });
      let data = res.data;
      
      // Manejar respuesta paginada del backend (pero no usar la paginación)
      if (data.results) {
        data = data.results;
      }
      
      // Aplicar filtro de días vencidos si existe
      if (currentFilters.diasVencidos) {
        data = data.filter(c => c.dias_vencidos >= parseInt(currentFilters.diasVencidos, 10));
      }
      
      setCuotas(data);
      
      // Agrupar cuotas por venta
      const ventas = {};
      data.forEach(cuota => {
        const key = `${cuota.cliente}||${cuota.lote}`;
        if (!ventas[key]) ventas[key] = { cliente: cuota.cliente, lote: cuota.lote, cuotas: [] };
        ventas[key].cuotas.push(cuota);
      });
      
      const ventasArray = Object.values(ventas);
      setVentasAgrupadas(ventasArray);
      
      // Calcular paginación basada en ventas agrupadas
      setTotalCount(ventasArray.length);
      setTotalPages(Math.ceil(ventasArray.length / pageSize));
      
    } catch (err) {
      setCuotas([]);
      setVentasAgrupadas([]);
      setTotalCount(0);
      setTotalPages(0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCuotas(filtros);
  }, [filtros, fetchCuotas]);

  // Efecto para recalcular paginación cuando cambie pageSize
  useEffect(() => {
    if (ventasAgrupadas.length > 0) {
      setTotalPages(Math.ceil(ventasAgrupadas.length / pageSize));
      // Ajustar currentPage si es necesario
      const maxPage = Math.ceil(ventasAgrupadas.length / pageSize);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      }
    }
  }, [pageSize, ventasAgrupadas.length, currentPage]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFiltros(prevFilters => ({ ...prevFilters, [name]: value }));
    setCurrentPage(1); // Reset a primera página al filtrar
  };

  const resetFilters = () => { 
    setFiltros({ cliente: '', proyecto: '', diasVencidos: '' }); 
    setCurrentPage(1); // Reset a primera página
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset a primera página al cambiar tamaño
  };

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

  // Obtener ventas para la página actual
  const getVentasForCurrentPage = () => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return ventasAgrupadas.slice(startIndex, endIndex);
  };

  const ventasParaMostrar = getVentasForCurrentPage();

  const handleExpandVenta = (key) => {
    setExpandedVentas(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleRowCuotaClick = (cuota) => {
    setSelectedCuota(cuota);
    setShowGestionModal(true);
  };

  const handleShowHistorial = (cuota) => {
    setHistorialCuota(cuota);
    setShowHistorialModal(true);
  };

  const closeGestionModal = () => {
    setShowGestionModal(false);
    setSelectedCuota(null);
  };
  const closeHistorialModal = () => {
    setShowHistorialModal(false);
    setHistorialCuota(null);
  };

  return (
    <div>
      <div className={cobranzasStyles.pageContainer}>
        <h1 className={cobranzasStyles.pageTitle}>Gestión de Cobranzas</h1>
        <div className={cobranzasStyles.filtersContainer}>
          <input
            type="text"
            name="cliente"
            placeholder="Buscar cliente..."
            value={filtros.cliente}
            onChange={handleFilterChange}
            className={cobranzasStyles.filterInput}
          />
          <input
            type="text"
            name="proyecto"
            placeholder="Proyecto..."
            value={filtros.proyecto}
            onChange={handleFilterChange}
            className={cobranzasStyles.filterInput}
          />
          <input
            type="number"
            name="diasVencidos"
            placeholder="Días vencidos >="
            value={filtros.diasVencidos}
            onChange={handleFilterChange}
            className={cobranzasStyles.filterInput}
          />
          <button onClick={resetFilters} className={cobranzasStyles.filterButton}>Limpiar Filtros</button>
        </div>

        {loading && <div className={cobranzasStyles.loadingMessage}>Cargando ventas con cuotas pendientes...</div>}

        {!loading && ventasParaMostrar.length === 0 && (
          <p className={cobranzasStyles.noDataMessage}>No hay ventas con cuotas pendientes con los filtros actuales.</p>
        )}

        {ventasParaMostrar.length > 0 && (
          <>
            {/* Información de paginación */}
            <div className={cobranzasStyles.paginationInfo}>
              <span>
                Mostrando {((currentPage - 1) * pageSize) + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount} ventas
              </span>
              <div className={cobranzasStyles.pageSizeSelector}>
                <label htmlFor="pageSize">Ventas por página:</label>
                <select 
                  id="pageSize"
                  value={pageSize} 
                  onChange={(e) => handlePageSizeChange(parseInt(e.target.value))}
                  className={cobranzasStyles.pageSizeSelect}
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className={cobranzasStyles.tableResponsiveWrapper}>
              <table className={cobranzasStyles.table}>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Lote</th>
                    <th>N° Cuotas Pendientes</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventasParaMostrar.map(venta => {
                    const key = `${venta.cliente}||${venta.lote}`;
                    const expanded = expandedVentas.includes(key);
                    return (
                      <React.Fragment key={key}>
                        <tr style={{ cursor: 'pointer', background: expanded ? '#ddebf7' : undefined }} onClick={() => handleExpandVenta(key)}>
                          <td>{venta.cliente}</td>
                          <td>{venta.lote}</td>
                          <td>{venta.cuotas.length}</td>
                          <td>{expanded ? '▲ Ocultar' : '▼ Ver cuotas'}</td>
                        </tr>
                        {expanded && venta.cuotas.map(cuota => (
                          <tr key={cuota.id_cuota} style={{ background: '#f7fbff' }}>
                            <td colSpan={2} style={{ paddingLeft: 32 }}>
                              <b>Cuota #{cuota.numero_cuota}</b> - Vence: {cuota.fecha_vencimiento} - Monto: S/. {Number(cuota.monto_programado).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                            </td>
                            <td style={{ color: cuota.dias_vencidos > 0 ? 'red' : undefined }}>
                              {cuota.dias_vencidos} días vencidos
                              <span style={{ marginLeft: 12, cursor: 'pointer', background: '#e3f0ff', borderRadius: '12px', padding: '2px 10px', fontSize: 13, color: '#2A4A6B', fontWeight: 600 }} onClick={e => { e.stopPropagation(); handleShowHistorial(cuota); }} title="Ver historial de gestiones">🕑 {cuota.ultima_gestion ? 1 : 0}</span>
                            </td>
                            <td>
                              <button className={cobranzasStyles.filterButton} onClick={e => { e.stopPropagation(); handleRowCuotaClick(cuota); }}>Gestionar</button>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Controles de paginación */}
            {totalPages > 1 && (
              <div className={cobranzasStyles.paginationControls}>
                <button 
                  onClick={() => handlePageChange(1)} 
                  disabled={currentPage === 1}
                  className={cobranzasStyles.paginationButton}
                >
                  « Primera
                </button>
                <button 
                  onClick={() => handlePageChange(currentPage - 1)} 
                  disabled={currentPage === 1}
                  className={cobranzasStyles.paginationButton}
                >
                  ‹ Anterior
                </button>
                
                {getPageNumbers().map((page, index) => (
                  <button
                    key={index}
                    onClick={() => typeof page === 'number' ? handlePageChange(page) : null}
                    disabled={page === '...'}
                    className={`${cobranzasStyles.paginationButton} ${page === currentPage ? cobranzasStyles.activePage : ''} ${page === '...' ? cobranzasStyles.ellipsis : ''}`}
                  >
                    {page}
                  </button>
                ))}
                
                <button 
                  onClick={() => handlePageChange(currentPage + 1)} 
                  disabled={currentPage === totalPages}
                  className={cobranzasStyles.paginationButton}
                >
                  Siguiente ›
                </button>
                <button 
                  onClick={() => handlePageChange(totalPages)} 
                  disabled={currentPage === totalPages}
                  className={cobranzasStyles.paginationButton}
                >
                  Última »
                </button>
              </div>
            )}
          </>
        )}

        {showGestionModal && selectedCuota && (
          <GestionCobranzaForm cuota={selectedCuota} onClose={closeGestionModal} />
        )}
        {showHistorialModal && historialCuota && (
          <HistorialModal cuota={historialCuota} onClose={closeHistorialModal} />
        )}
      </div>
    </div>
  );
}

export default CobranzasPage; 