// src/components/ui/LoteSelector.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../../services/apiService';
import styles from './LoteSelector.module.css';
import formBaseStyles from '../forms/FormStyles.module.css'; // Para botones y mensajes

const LoteSelector = ({ show, onClose, onLoteSelected, currentLoteId = null }) => {
    const initialFiltersState = {
        q: '', // Búsqueda general
        ubicacion_proyecto: '',
        etapa: '',
        manzana: '',
        numero_lote: '',
        estado_lote: 'Disponible,Reservado' // Por defecto buscar Disponibles Y Reservados
    };

    const [filters, setFilters] = useState(initialFiltersState);
    const [lotes, setLotes] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selectedLoteInModal, setSelectedLoteInModal] = useState(null);

    const fetchLotesCallback = useCallback(async (currentFilters) => {
        setIsLoading(true);
        setError(null);
        console.log("[LoteSelector] Fetching lotes con filtros:", currentFilters);

        try {
            // Construir queryParams solo con filtros que tienen valor
            const activeFilters = Object.fromEntries(
                Object.entries(currentFilters).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
            );
            const queryParams = new URLSearchParams(activeFilters).toString();
            
            console.log("[LoteSelector] QueryParams enviados:", queryParams);
            const response = await apiService.getLotes(queryParams);
            console.log("[LoteSelector] Respuesta de getLotes:", response.data);
            
            const fetchedLotes = response.data.results || response.data || [];
            setLotes(fetchedLotes);

            if (fetchedLotes.length === 0 && Object.keys(activeFilters).length > 0 && activeFilters.q !== '') {
                setError("No se encontraron lotes con los criterios de búsqueda actuales.");
            } else if (fetchedLotes.length === 0) {
                setError("No hay lotes para mostrar. Intente con otros filtros o cree nuevos lotes.");
            }
        } catch (err) {
            console.error("[LoteSelector] Error cargando lotes:", err.response?.data || err.message);
            setError(`Error al cargar lotes: ${err.response?.data?.detail || err.message || 'Intente nuevamente.'}`);
            setLotes([]);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            console.log("[LoteSelector] Modal visible. Disparando fetch inicial con filtros:", filters);
            fetchLotesCallback(filters); // Cargar lotes al mostrar o cuando cambian los filtros (manejado por el siguiente useEffect)
            // Resetear selección al abrir si no es el lote actual
            if (currentLoteId) {
                const previouslySelected = lotes.find(l => l.id_lote === currentLoteId);
                setSelectedLoteInModal(previouslySelected || null);
            } else {
                setSelectedLoteInModal(null);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show]); // Solo cuando 'show' cambia para la carga inicial o reseteo de selección

    // useEffect para buscar cuando los filtros cambian (y el modal está visible)
    useEffect(() => {
        if (show) {
            // Un pequeño debounce para no buscar en cada tecleo si es 'q'
            const timer = setTimeout(() => {
                fetchLotesCallback(filters);
            }, 500); // 500ms de debounce
            return () => clearTimeout(timer);
        }
    }, [filters, fetchLotesCallback, show]);


    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearchSubmit = (e) => { // Este botón puede ser opcional si buscamos al cambiar filtros
        e.preventDefault();
        fetchLotesCallback(filters); // Forzar búsqueda inmediata
    };

    const handleResetFiltersAndSearch = () => {
        setFilters(initialFiltersState); // Esto disparará el useEffect de arriba para re-hacer el fetch
        setSelectedLoteInModal(null);
        setError(null);
    };

    const handleRowClick = (lote) => {
        if (lote.estado_lote === 'Vendido' && lote.id_lote !== currentLoteId) {
            setError("Este lote ya está Vendido y no puede ser seleccionado.");
            setSelectedLoteInModal(null); // No permitir seleccionar un lote vendido si no es el actual
            return;
        }
        setSelectedLoteInModal(lote);
        setError(null); 
    };
    
    const handleConfirmSelection = () => {
        if (selectedLoteInModal) {
            if (selectedLoteInModal.estado_lote === 'Vendido' && selectedLoteInModal.id_lote !== currentLoteId) {
                setError("No se puede confirmar la selección de un lote Vendido.");
                return;
            }
            onLoteSelected(selectedLoteInModal);
            // onClose(); // El componente padre se encarga de cerrar el modal
        } else {
            setError("Por favor, seleccione un lote de la lista antes de confirmar.");
        }
    };
    
    const displayCurrency = (value) => (value !== null && value !== undefined && parseFloat(value)) ? parseFloat(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }) : '-';

    if (!show) return null;

    return (
        <div className={formBaseStyles.modalOverlay}>
            <div className={`${formBaseStyles.modalContent} ${styles.loteSelectorModalContent}`}>
                <h2>Seleccionar Lote</h2>

                <form onSubmit={handleSearchSubmit} className={styles.filterControls}>
                    <div className={styles.filterRow}>
                        <input
                            type="text" name="q" placeholder="Buscar ID, Proyecto, Mz, Lt..."
                            value={filters.q} onChange={handleFilterChange}
                            className={formBaseStyles.formGroupInput} 
                        />
                        <select 
                            name="estado_lote" value={filters.estado_lote} onChange={handleFilterChange}
                            className={formBaseStyles.formGroupSelect}
                        >
                            <option value="Disponible,Reservado">Disponibles y Reservados</option>
                            <option value="Disponible">Solo Disponibles</option>
                            <option value="Reservado">Solo Reservados</option>
                            <option value="">Todos (incluye Vendidos)</option>
                            <option value="Vendido">Solo Vendidos (Info)</option>
                        </select>
                    </div>
                    <div className={styles.filterRow}>
                        <input type="text" name="ubicacion_proyecto" placeholder="Proyecto..." value={filters.ubicacion_proyecto} onChange={handleFilterChange} className={formBaseStyles.formGroupInput}/>
                        <input type="number" name="etapa" placeholder="Etapa" value={filters.etapa} onChange={handleFilterChange} className={formBaseStyles.formGroupInput} min="0" />
                        <input type="text" name="manzana" placeholder="Manzana" value={filters.manzana} onChange={handleFilterChange} className={formBaseStyles.formGroupInput}/>
                        <input type="text" name="numero_lote" placeholder="N° Lote" value={filters.numero_lote} onChange={handleFilterChange} className={formBaseStyles.formGroupInput}/>
                    </div>
                    <div className={styles.filterActions}>
                        <button type="submit" className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`}>Buscar</button>
                        <button type="button" onClick={handleResetFiltersAndSearch} className={`${formBaseStyles.button} ${formBaseStyles.buttonSecondary}`}>Limpiar</button>
                    </div>
                </form>

                {isLoading && <p className={formBaseStyles.loadingText}>Buscando lotes...</p>}
                {error && !isLoading && <p className={formBaseStyles.errorMessageForm}>{error}</p>}

                {!isLoading && lotes.length === 0 && !error && (
                     <p className={formBaseStyles.noDataMessage} style={{textAlign: 'center', padding: '20px'}}>No se encontraron lotes.</p>
                 )}

                {lotes.length > 0 && (
                    <div className={styles.resultsContainer}>
                        <table className={styles.lotesTable}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Proyecto</th>
                                    <th>Etapa</th>
                                    <th>Mz.</th>
                                    <th>Lote</th>
                                    <th style={{textAlign: 'right'}}>Área m²</th>
                                    <th style={{textAlign: 'right'}}>Precio Cont.</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lotes.map(lote => (
                                    <tr 
                                        key={lote.id_lote} 
                                        onClick={() => handleRowClick(lote)}
                                        className={`
                                            ${styles.loteItem}
                                            ${selectedLoteInModal?.id_lote === lote.id_lote ? styles.selectedRow : ''}
                                            ${currentLoteId === lote.id_lote ? styles.alreadySelectedRow : ''}
                                            ${lote.estado_lote === 'Vendido' && currentLoteId !== lote.id_lote ? styles.disabledRow : ''}
                                        `}
                                        title={
                                            lote.estado_lote === 'Vendido' && currentLoteId !== lote.id_lote 
                                            ? "Lote Vendido (no seleccionable)" 
                                            : (currentLoteId === lote.id_lote 
                                                ? "Este lote ya está seleccionado" 
                                                : `Seleccionar: ${lote.id_lote}`)
                                        }
                                    >
                                        <td>{lote.id_lote}</td>
                                        <td className={styles.textWrap}>{lote.ubicacion_proyecto}</td>
                                        <td>{lote.etapa || '-'}</td>
                                        <td>{lote.manzana || '-'}</td>
                                        <td>{lote.numero_lote || '-'}</td>
                                        <td style={{textAlign: 'right'}}>{parseFloat(lote.area_m2).toFixed(2)}</td>
                                        <td style={{textAlign: 'right'}}>{displayCurrency(lote.precio_lista_soles)}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles['status' + lote.estado_lote]}`}>
                                                {lote.estado_lote}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                
                <div className={formBaseStyles.formActions} style={{marginTop: 'auto', paddingTop: 'var(--spacing-md)'}}>
                    <button 
                        onClick={handleConfirmSelection} 
                        className={`${formBaseStyles.button} ${formBaseStyles.buttonPrimary}`}
                        disabled={!selectedLoteInModal || (selectedLoteInModal.estado_lote === 'Vendido' && selectedLoteInModal.id_lote !== currentLoteId)}
                        title={
                            !selectedLoteInModal ? "Seleccione un lote" : 
                            (selectedLoteInModal.id_lote === currentLoteId ? "Este lote ya está seleccionado" : 
                            (selectedLoteInModal.estado_lote === 'Vendido' ? "No puede seleccionar un lote vendido" : "Confirmar Selección"))
                        }
                    >
                        Confirmar Selección
                    </button>
                    <button type="button" onClick={onClose} className={`${formBaseStyles.button} ${formBaseStyles.buttonSecondary}`}>
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoteSelector;