import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import ventasStyles from './VentasPage.module.css';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function agruparPorAsesor(detalles) {
  const resumen = {};
  detalles.forEach(d => {
    if (!resumen[d.asesor_dni]) {
      resumen[d.asesor_dni] = {
        asesor_nombre: d.asesor_nombre,
        asesor_dni: d.asesor_dni,
        total: 0,
        detalles: []
      };
    }
    resumen[d.asesor_dni].total += Number(d.monto_comision_final);
    resumen[d.asesor_dni].detalles.push(d);
  });
  return Object.values(resumen);
}

export default function ReporteCierrePage() {
  const { mes, anio } = useParams();
  const mesNum = Number(mes);
  const añoNum = Number(anio);
  console.log("ReporteCierrePage montado", { mes, anio });
  const [cierre, setCierre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comparativo, setComparativo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    apiService.get(`/gestion/cierres-comisiones/?mes=${mesNum}&año=${añoNum}`)
      .then(res => {
        const data = (res.data.results || res.data)[0];
        setCierre(data);
        setLoading(false);
        // Cargar comparativo mes anterior
        if (data) {
          let mesAnt = mesNum - 1;
          let añoAnt = añoNum;
          if (mesAnt < 1) { mesAnt = 12; añoAnt -= 1; }
          apiService.get(`/gestion/cierres-comisiones/?mes=${mesAnt}&año=${añoAnt}`)
            .then(res2 => setComparativo((res2.data.results || res2.data)[0] || null));
        }
      })
      .catch(() => {
        setError('No se encontró el cierre para este mes.');
        setLoading(false);
      });
  }, [mesNum, añoNum]);

  if (loading) return <div className={ventasStyles.pageContainer}><div style={{textAlign:'center', color:'#2A4A6B', fontWeight:500, fontSize:18, padding:40}}><span className="loader" style={{marginRight:10}}></span> Cargando reporte...</div></div>;
  if (error) return <div className={ventasStyles.pageContainer} style={{color:'#b3261e', background:'#fff4f4', border:'1px solid #f8d7da', borderRadius:8, padding:18, textAlign:'center', fontWeight:500}}>{error}</div>;
  if (!cierre) return <div className={ventasStyles.pageContainer}>No hay datos para este cierre.</div>;
  console.log({ loading, error, cierre });

  const resumenAsesores = agruparPorAsesor(cierre.detalles || []);
  let resumenAnterior = comparativo ? agruparPorAsesor(comparativo.detalles || []) : [];
  const resumenAnteriorPorDni = Object.fromEntries(resumenAnterior.map(r => [r.asesor_dni, r]));

  return (
    <div className={ventasStyles.pageContainer}>
      <button className={ventasStyles.resetButton} style={{marginBottom:16}} onClick={() => navigate(-1)}>← Volver</button>
      <h1 className={ventasStyles.pageTitle}>
        Reporte de Cierre de Comisiones<br/>
        <span style={{fontSize:18, fontWeight:400}}>{MESES[mesNum-1]} {añoNum}</span>
      </h1>
      <h2 style={{color:'#2A4A6B', fontWeight:600, marginTop:0, marginBottom:18, fontSize:20}}>Resumen por Asesor</h2>
      <div className={ventasStyles.tableResponsiveContainer}>
        <table className={ventasStyles.table}>
          <thead>
            <tr>
              <th>Asesor</th>
              <th>DNI</th>
              <th>Total Comisión</th>
            </tr>
          </thead>
          <tbody>
            {resumenAsesores.map((r, idx) => (
              <tr key={r.asesor_dni}>
                <td>{r.asesor_nombre}</td>
                <td>{r.asesor_dni}</td>
                <td>S/ {r.total.toLocaleString('es-PE', {minimumFractionDigits:2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{marginTop:32, fontSize:22, color:'#2A4A6B', fontWeight:600}}>Comparativo con Mes Anterior</h2>
      <div className={ventasStyles.tableResponsiveContainer}>
        <table className={ventasStyles.table}>
          <thead>
            <tr>
              <th>Asesor</th>
              <th>Comisión Mes Actual</th>
              <th>Comisión Mes Anterior</th>
              <th>Variación (%)</th>
            </tr>
          </thead>
          <tbody>
            {resumenAsesores.map((r, idx) => {
              const ant = resumenAnteriorPorDni[r.asesor_dni];
              const actual = r.total;
              const anterior = ant ? ant.total : 0;
              const variacion = anterior === 0 ? (actual > 0 ? 100 : 0) : ((actual - anterior) / anterior * 100);
              return (
                <tr key={r.asesor_dni}>
                  <td>{r.asesor_nombre}</td>
                  <td>S/ {actual.toLocaleString('es-PE', {minimumFractionDigits:2})}</td>
                  <td>S/ {anterior.toLocaleString('es-PE', {minimumFractionDigits:2})}</td>
                  <td style={{color: variacion >= 0 ? 'green' : 'red', fontWeight:600}}>
                    {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className={ventasStyles.createButton} style={{marginTop:32, fontWeight:600, fontSize:18, padding:'12px 32px', borderRadius:8, boxShadow:'0 2px 8px rgba(42,74,107,0.08)'}}>
        <span className="material-icons" style={{verticalAlign:'middle', marginRight:8}}>picture_as_pdf</span> Exportar a PDF
      </button>
      <h2 style={{marginTop:40, fontSize:22, color:'#2A4A6B', fontWeight:600}}>Detalle de Comisiones Cerradas</h2>
      <div className={ventasStyles.tableResponsiveContainer}>
        <table className={ventasStyles.table}>
          <thead>
            <tr>
              <th>Asesor</th>
              <th>Venta</th>
              <th>Lote</th>
              <th>Fecha Venta</th>
              <th>Rol</th>
              <th>% Comisión</th>
              <th>Monto Comisión</th>
            </tr>
          </thead>
          <tbody>
            {(cierre.detalles || []).map((d, idx) => (
              <tr key={d.id_detalle}>
                <td>{d.asesor_nombre}</td>
                <td>{d.venta_id}</td>
                <td>{d.lote_str}</td>
                <td>{d.fecha_venta}</td>
                <td>{d.rol_en_venta}</td>
                <td>{Number(d.porcentaje_comision_aplicado).toFixed(2)}%</td>
                <td>S/ {Number(d.monto_comision_final).toLocaleString('es-PE', {minimumFractionDigits:2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 