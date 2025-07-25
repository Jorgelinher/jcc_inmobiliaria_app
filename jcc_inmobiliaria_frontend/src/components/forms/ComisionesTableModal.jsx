import React, { useState, useEffect } from 'react';
import styles from './FormStyles.module.css';
import ventasStyles from '../../pages/VentasPage.module.css';

const ROLES = [
  'captación',
  'llamada',
  'liner',
  'closer',
];
const TIPOS_VENTA = [
  'crédito',
  'contado',
];

const ROL_LABELS = {
  captacion: 'Captación',
  llamada: 'Llamada',
  liner: 'Liner',
  closer: 'Closer'
};
const TIPO_VENTA_LABELS = {
  contado: 'Contado',
  credito: 'Crédito'
};

export default function ComisionesTableModal({ open, onClose, comisiones, onSave }) {
  const [rows, setRows] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [editRow, setEditRow] = useState({ rol: '', tipo_venta: '', porcentaje_comision: '' });
  const [addedRow, setAddedRow] = useState(false); // Para saber si la fila fue agregada

  useEffect(() => {
    if (open) {
      setRows(Array.isArray(comisiones) ? comisiones : []);
      setEditIndex(null);
      setEditRow({ rol: '', tipo_venta: '', porcentaje_comision: '' });
      setAddedRow(false);
    }
  }, [open, comisiones]);

  const handleEdit = (idx) => {
    setEditIndex(idx);
    setEditRow(rows[idx]);
    setAddedRow(false);
  };
  const handleDelete = (idx) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta fila de la tabla de comisiones?')) {
      setRows(rows.filter((_, i) => i !== idx));
      // Si se elimina la fila que estaba en edición, cancelar edición
      if (editIndex === idx) {
        setEditIndex(null);
        setEditRow({ rol: '', tipo_venta: '', porcentaje_comision: '' });
        setAddedRow(false);
      }
    }
  };
  const handleChange = (e) => {
    setEditRow({ ...editRow, [e.target.name]: e.target.value });
  };
  const handleSaveEdit = () => {
    // No permitir guardar filas vacías
    if (!editRow.rol || !editRow.tipo_venta || !editRow.porcentaje_comision) return;
    const updated = [...rows];
    updated[editIndex] = editRow;
    setRows(updated);
    setEditIndex(null);
    setEditRow({ rol: '', tipo_venta: '', porcentaje_comision: '' });
    setAddedRow(false);
  };
  const handleAdd = () => {
    setRows([...rows, { rol: '', tipo_venta: '', porcentaje_comision: '' }]);
    setEditIndex(rows.length);
    setEditRow({ rol: '', tipo_venta: '', porcentaje_comision: '' });
    setAddedRow(true);
  };
  const handleCancelEdit = () => {
    // Si la fila fue agregada y se cancela, eliminar la fila vacía
    if (addedRow) {
      setRows(rows.slice(0, -1));
    }
    setEditIndex(null);
    setEditRow({ rol: '', tipo_venta: '', porcentaje_comision: '' });
    setAddedRow(false);
  };
  const handleSaveAll = () => {
    // Filtrar filas vacías antes de guardar
    const filteredRows = rows.filter(r => r.rol && r.tipo_venta && r.porcentaje_comision);
    onSave(filteredRows);
    onClose();
  };
  if (!open) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent} style={{ minWidth: 0, maxWidth: 700, margin: '0 auto', padding: 0 }}>
        <h2 className={styles.modalTitle} style={{ marginBottom: 24, marginTop: 10, paddingTop: 0, paddingBottom: 0, textAlign: 'center', fontWeight: 700, fontSize: 24, letterSpacing: 0.2 }}>Editar Tabla de Comisiones</h2>
        <div className={ventasStyles.tableResponsiveContainer} style={{ margin: '24px auto', maxWidth: 650 }}>
          <table className={ventasStyles.table} style={{ width: '100%', minWidth: 0, borderCollapse: 'separate', borderSpacing: 0, boxShadow: 'none' }}>
            <thead>
              <tr>
                <th>Rol</th>
                <th>Tipo de Venta</th>
                <th>Comisión (%)</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx}>
                  {editIndex === idx ? (
                    <>
                      <td>
                        <select
                          name="rol"
                          value={editRow.rol}
                          onChange={handleChange}
                          className={ventasStyles.filterSelect}
                          style={{ minWidth: 120 }}
                        >
                          <option value="">Seleccione</option>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          name="tipo_venta"
                          value={editRow.tipo_venta}
                          onChange={handleChange}
                          className={ventasStyles.filterSelect}
                          style={{ minWidth: 120 }}
                        >
                          <option value="">Seleccione</option>
                          {TIPOS_VENTA.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          name="porcentaje_comision"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={editRow.porcentaje_comision}
                          onChange={handleChange}
                          className={ventasStyles.filterInput}
                          style={{ minWidth: 80 }}
                        />
                      </td>
                      <td className={ventasStyles.actionButtons} style={{ border: 'none' }}>
                        <button className={ventasStyles.editButton} onClick={handleSaveEdit}>Guardar</button>
                        <button className={ventasStyles.deleteButton} onClick={handleCancelEdit}>Cancelar</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td>{ROL_LABELS[row.rol] || row.rol}</td>
                      <td>{TIPO_VENTA_LABELS[row.tipo_venta] || row.tipo_venta}</td>
                      <td>{parseFloat(row.porcentaje_comision).toFixed(2)}%</td>
                      <td className={ventasStyles.actionButtons} style={{ border: 'none' }}>
                        <button className={ventasStyles.editButton} onClick={() => handleEdit(idx)}>Editar</button>
                        <button className={ventasStyles.deleteButton} onClick={() => handleDelete(idx)}>Eliminar</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ textAlign: 'center', margin: '32px 0 32px 0' }}>
          <button className={ventasStyles.createButton} onClick={handleAdd}>Agregar Fila</button>
        </div>
        <div className={styles.formActions} style={{ justifyContent: 'center', marginBottom: 12, marginTop: 24 }}>
          <button className={ventasStyles.createButton} onClick={handleSaveAll}>Guardar Tabla</button>
          <button className={ventasStyles.resetButton} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
} 