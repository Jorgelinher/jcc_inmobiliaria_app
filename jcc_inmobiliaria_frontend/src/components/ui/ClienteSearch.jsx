import React, { useState, useEffect, useRef } from 'react';
import { searchClientes, getClientesSinPresencia, getClientesParaVentas } from '../../services/apiService';
import styles from './ClienteSearch.module.css';

const ClienteSearch = ({ 
    value, 
    onChange, 
    placeholder = "Buscar cliente...", 
    required = false,
    disabled = false,
    showCreateOption = true,
    onClienteSelect = null,
    context = 'search' // 'search', 'presencias', 'ventas'
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedCliente, setSelectedCliente] = useState(null);
    const searchRef = useRef(null);
    const dropdownRef = useRef(null);

    // Cargar cliente seleccionado si hay un value inicial
    useEffect(() => {
        if (value && !selectedCliente) {
            // Aquí podrías hacer una llamada para obtener los datos del cliente
            // Por ahora asumimos que el value es el ID del cliente
            setSelectedCliente({ id_cliente: value, display_text: `Cliente ID: ${value}` });
        }
    }, [value, selectedCliente]);

    // Cerrar dropdown cuando se hace clic fuera
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target) &&
                dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Búsqueda con debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (searchTerm.length >= 2) {
                performSearch();
            } else {
                setResults([]);
                setShowDropdown(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    const performSearch = async () => {
        setIsLoading(true);
        try {
            let response;
            
            // Usar endpoint específico según el contexto
            if (context === 'presencias') {
                response = await getClientesSinPresencia(searchTerm, 20);
            } else if (context === 'ventas') {
                response = await getClientesParaVentas(searchTerm, 20);
            } else {
                response = await searchClientes(searchTerm);
            }
            
            setResults(response.data.results || []);
            setShowDropdown(true);
        } catch (error) {
            console.error('Error buscando clientes:', error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const newValue = e.target.value;
        setSearchTerm(newValue);
        
        if (!newValue) {
            setSelectedCliente(null);
            setResults([]);
            setShowDropdown(false);
            onChange && onChange('');
        }
    };

    const handleClienteSelect = (cliente) => {
        setSelectedCliente(cliente);
        setSearchTerm(cliente.display_text);
        setShowDropdown(false);
        setResults([]);
        
        // Llamar a los callbacks
        onChange && onChange(cliente.id_cliente);
        onClienteSelect && onClienteSelect(cliente);
    };

    const handleCreateNew = () => {
        setShowDropdown(false);
        // Aquí podrías abrir un modal para crear nuevo cliente
        // Por ahora solo llamamos al callback
        onChange && onChange('_CREAR_NUEVO_');
    };

    const clearSelection = () => {
        setSelectedCliente(null);
        setSearchTerm('');
        setResults([]);
        setShowDropdown(false);
        onChange && onChange('');
    };

    return (
        <div className={styles.clienteSearchContainer} ref={searchRef}>
            <div className={styles.inputContainer}>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className={styles.searchInput}
                    onFocus={() => {
                        if (searchTerm.length >= 2) {
                            setShowDropdown(true);
                        }
                    }}
                />
                {selectedCliente && (
                    <button
                        type="button"
                        onClick={clearSelection}
                        className={styles.clearButton}
                        title="Limpiar selección"
                    >
                        ×
                    </button>
                )}
                {isLoading && (
                    <div className={styles.loadingSpinner}>
                        <div className={styles.spinner}></div>
                    </div>
                )}
            </div>

            {showDropdown && (results.length > 0 || showCreateOption) && (
                <div className={styles.dropdown} ref={dropdownRef}>
                    {results.length > 0 ? (
                        results.map((cliente) => (
                            <div
                                key={cliente.id_cliente}
                                className={styles.dropdownItem}
                                onClick={() => handleClienteSelect(cliente)}
                            >
                                <div className={styles.clienteName}>
                                    {cliente.nombres_completos_razon_social}
                                    {cliente.tiene_presencia && (
                                        <span className={styles.presenciaIndicator} title="Cliente con presencia previa">
                                            *
                                        </span>
                                    )}
                                </div>
                                <div className={styles.clienteDetails}>
                                    <span className={styles.telefono}>
                                        📞 {cliente.telefono_principal || 'Sin teléfono'}
                                    </span>
                                    <span className={styles.documento}>
                                        📄 {cliente.numero_documento}
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : searchTerm.length >= 2 && !isLoading ? (
                        <div className={styles.noResults}>
                            No se encontraron clientes
                        </div>
                    ) : null}

                    {showCreateOption && (
                        <div
                            className={`${styles.dropdownItem} ${styles.createNewOption}`}
                            onClick={handleCreateNew}
                        >
                            ➕ Crear nuevo cliente
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ClienteSearch; 