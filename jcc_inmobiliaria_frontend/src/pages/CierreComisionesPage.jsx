import React, { useEffect, useState } from 'react';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import ventasStyles from './VentasPage.module.css';
import cobranzasStyles from './CobranzasPage.module.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function getUltimosMeses(n = 18) {
  const hoy = new Date();
  const meses = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ mes: d.getMonth() + 1, año: d.getFullYear() });
  }
  return meses;
}

function getMesesCombinados(cierres, n = 18) {
  // Últimos n meses
  const ultimos = getUltimosMeses(n);
  // Meses/años de cierres existentes
  const deCierres = cierres.map(c => ({ mes: c.mes, año: c.año }));
  // Unir y eliminar duplicados
  const map = new Map();
  [...ultimos, ...deCierres].forEach(({ mes, año }) => {
    map.set(`${mes}-${año}`, { mes, año });
  });
  // Ordenar descendente
  return Array.from(map.values()).sort((a, b) => b.año !== a.año ? b.año - a.año : b.mes - a.mes);
}

export default function CierreComisionesPage() {
  const [cierres, setCierres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cierreEnProceso, setCierreEnProceso] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    apiService.get('/gestion/cierres-comisiones/')
      .then(res => setCierres(res.data.results || res.data))
      .catch(() => setError('Error al cargar los cierres'))
      .finally(() => setLoading(false));
  }, []);

  const handleCerrarMes = async (mes, año) => {
    if (!window.confirm(`¿Seguro que deseas ejecutar el cierre de comisiones para ${MESES[mes-1]} ${año}?`)) return;
    setCierreEnProceso(`${mes}-${año}`);
    try {
      await apiService.post('/gestion/cierres-comisiones/ejecutar-cierre/', { mes, año });
      // Refrescar lista
      const res = await apiService.get('/gestion/cierres-comisiones/');
      setCierres(res.data.results || res.data);
    } catch (e) {
      alert(e.response?.data?.error || 'Error al ejecutar el cierre');
    } finally {
      setCierreEnProceso(null);
    }
  };

  const cierresPorClave = {};
  cierres.forEach(c => {
    cierresPorClave[`${c.mes}-${c.año}`] = c;
  });

  return (
    <div className={ventasStyles.pageContainer}>
      <h1 className={ventasStyles.pageTitle}>Cierre de Comisiones</h1>
      <h2 style={{color:'#2A4A6B', fontWeight:600, marginTop:0, marginBottom:18, fontSize:20}}>Gestión y Reporte Mensual de Comisiones</h2>
      <div style={{margin: '0 auto', maxWidth: 1100}}>
        <div className={ventasStyles.tableResponsiveContainer}>
          {loading ? (
            <div style={{textAlign:'center', color:'#2A4A6B', fontWeight:500, fontSize:18, padding:40}}>
              <span className="loader" style={{marginRight:10}}></span> Cargando cierres de comisiones...
            </div>
          ) : error ? (
            <div style={{color:'#b3261e', background:'#fff4f4', border:'1px solid #f8d7da', borderRadius:8, padding:18, textAlign:'center', fontWeight:500}}>{error}</div>
          ) : (
          <table className={ventasStyles.table}>
            <thead>
              <tr>
                <th>Mes</th>
                <th>Año</th>
                <th>Status</th>
                <th>Monto Total</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {getMesesCombinados(cierres).map(({ mes, año }, idx) => {
                const cierre = cierresPorClave[`${mes}-${año}`];
                return (
                  <tr key={`${mes}-${año}`}>
                    <td>{MESES[mes-1]}</td>
                    <td>{año}</td>
                    <td style={{fontWeight:600, color: cierre ? (cierre.status==='CERRADO'?'#007bff':cierre.status==='PAGADO'?'#2e7d32':'#2A4A6B'):'#2A4A6B'}}>{cierre ? cierre.status : 'Abierto'}</td>
                    <td>{cierre ? `S/ ${Number(cierre.monto_total_comisiones).toLocaleString('es-PE', {minimumFractionDigits:2})}` : '-'}</td>
                    <td>
                      <div style={{display:'flex', justifyContent:'center'}}>
                        {cierre && (cierre.status === 'CERRADO' || cierre.status === 'PAGADO') ? (
                          <button className={cobranzasStyles.filterButton} onClick={() => navigate(`/cierres-comisiones/${mes}/${año}`.replace('/año', '/anio'))}>
                            Ver Reporte
                          </button>
                        ) : (
                          <button
                            className={cobranzasStyles.filterButton}
                            disabled={!!cierreEnProceso}
                            onClick={() => handleCerrarMes(mes, año)}
                          >
                            {cierreEnProceso === `${mes}-${año}` ? <span className="loader" style={{marginRight:8}}></span> : null}
                            {cierreEnProceso === `${mes}-${año}` ? 'Cerrando...' : 'Cerrar Mes'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          )}
        </div>
      </div>
    </div>
  );
} 