import React, { useState, useCallback, useEffect } from 'react';
import Select from 'react-select/async';
import * as apiService from '../../services/apiService';
import styles from './AsesorAutocomplete.module.css';

const AsesorAutocomplete = ({ 
    value, 
    onChange, 
    placeholder = "Buscar asesor...", 
    isClearable = true,
    isDisabled = false,
    className = "",
    name = "",
    asesoresList = null
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);

    // Cargar información del asesor cuando el componente se inicializa con un valor
    useEffect(() => {
        const loadSelectedAsesor = async () => {
            if (value && typeof value === 'string') {
                // Si hay asesoresList, buscar localmente
                if (asesoresList && Array.isArray(asesoresList)) {
                    const asesor = asesoresList.find(a => a.id_asesor === value);
                    if (asesor) {
                        const option = {
                            value: asesor.id_asesor,
                            label: `${asesor.nombre_asesor} (${asesor.id_asesor}) - ${asesor.tipo_asesor_actual}`,
                            asesor: asesor
                        };
                        setSelectedOption(option);
                        return;
                    }
                }
                // Si no, buscar remoto solo si no tenemos la opción seleccionada o es diferente
                if (!selectedOption || selectedOption.value !== value) {
                    try {
                        const response = await apiService.getAsesorById(value);
                        const asesor = response.data;
                        const option = {
                            value: asesor.id_asesor,
                            label: `${asesor.nombre_asesor} (${asesor.id_asesor}) - ${asesor.tipo_asesor_actual}`,
                            asesor: asesor
                        };
                        setSelectedOption(option);
                    } catch (error) {
                        console.error('Error cargando asesor seleccionado:', error);
                        onChange('');
                    }
                }
            } else if (!value) {
                setSelectedOption(null);
            }
        };
        loadSelectedAsesor();
    }, [value, asesoresList]); // Removido onChange y selectedOption de las dependencias para evitar bucles

    // Función para cargar opciones de asesores
    const loadOptions = useCallback(async (inputValue) => {
        console.log("Filtrando asesoresList:", asesoresList, "inputValue:", inputValue);
        if (asesoresList && Array.isArray(asesoresList)) {
            if (!inputValue || inputValue.length < 2) return [];
            return asesoresList
                .filter(a => ((a.nombre_asesor || a.nombres_completos_razon_social || '').toLowerCase().includes(inputValue.toLowerCase()) || (a.id_asesor || '').toLowerCase().includes(inputValue.toLowerCase())))
                .map(asesor => ({
                    value: asesor.id_asesor,
                    label: `${asesor.nombre_asesor || asesor.nombres_completos_razon_social} (${asesor.id_asesor}) - ${asesor.tipo_asesor_actual || ''}`,
                    asesor: asesor
                }));
        } else {
            // Remoto
            if (!inputValue || inputValue.length < 2) {
                return [];
            }
            setIsLoading(true);
            try {
                const response = await apiService.searchAsesores(inputValue);
                const asesores = response.data.results || response.data || [];
                return asesores.map(asesor => ({
                    value: asesor.id_asesor,
                    label: `${asesor.nombre_asesor} (${asesor.id_asesor}) - ${asesor.tipo_asesor_actual}`,
                    asesor: asesor
                }));
            } catch (error) {
                console.error('Error cargando asesores:', error);
                return [];
            } finally {
                setIsLoading(false);
            }
        }
    }, [asesoresList]);

    // Función para manejar el cambio de selección
    const handleChange = (selectedOption) => {
        setSelectedOption(selectedOption);
        onChange(selectedOption ? selectedOption.value : '');
    };

    // Función para obtener el valor actual para react-select
    const getCurrentValue = () => {
        if (!value) return null;
        
        // Si ya tenemos un objeto con value/label, usarlo directamente
        if (value && typeof value === 'object' && value.value) {
            return value;
        }
        
        // Si es solo el ID y tenemos la opción seleccionada, usarla
        if (selectedOption && selectedOption.value === value) {
            return selectedOption;
        }
        
        // Si es solo el ID pero no tenemos la opción, retornar null
        // (el useEffect se encargará de cargarla)
        return null;
    };

    return (
        <div className={`${styles.asesorAutocomplete} ${className}`}>
            <Select
                name={name}
                value={getCurrentValue()}
                onChange={handleChange}
                loadOptions={loadOptions}
                placeholder={placeholder}
                isClearable={isClearable}
                isDisabled={isDisabled}
                isLoading={isLoading}
                noOptionsMessage={() => "No se encontraron asesores"}
                loadingMessage={() => "Buscando asesores..."}
                cacheOptions
                defaultOptions={asesoresList && Array.isArray(asesoresList) ? asesoresList.map(asesor => ({
                    value: asesor.id_asesor,
                    label: `${asesor.nombre_asesor || asesor.nombres_completos_razon_social} (${asesor.id_asesor}) - ${asesor.tipo_asesor_actual || ''}`,
                    asesor: asesor
                })) : true}
                blurInputOnSelect={true}
                closeMenuOnSelect={true}
                className={styles.select}
                classNamePrefix="asesor-select"
                styles={{
                    control: (provided, state) => ({
                        ...provided,
                        minHeight: '38px',
                        borderColor: state.isFocused ? '#2A4A6B' : '#CED4DA',
                        boxShadow: state.isFocused ? '0 0 0 0.2rem rgba(42, 74, 107, 0.25)' : 'none',
                        '&:hover': {
                            borderColor: '#2A4A6B'
                        }
                    }),
                    option: (provided, state) => ({
                        ...provided,
                        backgroundColor: state.isSelected 
                            ? '#2A4A6B' 
                            : state.isFocused 
                                ? '#F8F9FA' 
                                : 'white',
                        color: state.isSelected ? 'white' : '#343A40',
                        '&:hover': {
                            backgroundColor: state.isSelected ? '#2A4A6B' : '#E9ECEF'
                        }
                    }),
                    menu: (provided) => ({
                        ...provided,
                        zIndex: 9999
                    })
                }}
            />
        </div>
    );
};

export default AsesorAutocomplete; 