// src/pages/ClienteDetailPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import * as apiService from '../services/apiService';
import styles from './DetailPage.module.css';
import ClienteForm from '../components/forms/ClienteForm'; // <--- IMPORTAR ClienteForm

// --- INICIO: Función para calcular la edad ---
const getAgeFromBirthDate = (birthDateStr) => {
    if (!birthDateStr) return null;
    try {
        const birthDate = new Date(birthDateStr + 'T00:00:00Z');
        if (isNaN(birthDate.getTime())) return null;
        const today = new Date();
        const birthYear = birthDate.getUTCFullYear();
        const birthMonth = birthDate.getUTCMonth();
        const birthDay = birthDate.getUTCDate();
        let age = today.getUTCFullYear() - birthYear;
        const currentMonth = today.getUTCMonth();
        const currentDay = today.getUTCDate();
        if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
            age--;
        }
        return (age >= 0 && age < 120) ? age : null;
    } catch (e) { return null; }
};
// --- FIN: Función para calcular la edad ---

function ClienteDetailPage() {
    const { idCliente } = useParams();
    const navigate = useNavigate(); // Se mantiene por si se usa para otra cosa
    const location = useLocation();
    const [cliente, setCliente] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- INICIO: Estados para el modal de edición de Cliente ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [formError, setFormError] = useState(''); // Para errores dentro del ClienteForm
    // --- FIN: Estados para el modal ---

    const fetchClienteDetalle = useCallback(async () => {
        if (!idCliente) {
            setError("No se proporcionó un ID de cliente para cargar.");
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getClienteById(idCliente);
            if (response.data) {
                setCliente(response.data);
            } else {
                setError("La respuesta del API no tiene el formato esperado.");
                setCliente(null);
            }
        } catch (err) {
            setError(err.response?.data?.detail || err.message || "Ocurrió un error al cargar el detalle del cliente.");
            setCliente(null);
        } finally {
            setLoading(false);
        }
    }, [idCliente]);

    useEffect(() => {
        fetchClienteDetalle();
    }, [fetchClienteDetalle]);

    const displayValue = (value, suffix = '') => (value !== null && value !== undefined && value !== '') ? `${value}${suffix}` : '-';
    const displayDate = (dateStr) => { /* ... (como estaba) ... */ };
    const displayDateTime = (dateTimeStr) => { /* ... (como estaba) ... */ };

    // --- INICIO: Funciones para manejar el modal de edición ---
    const handleOpenEditModal = () => {
        if (cliente) {
            setFormError(''); // Limpiar errores previos del formulario
            setIsEditModalOpen(true);
        }
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setFormError('');
    };

    const handleSubmitClienteEditado = async (formDataFromModal) => {
        if (!cliente || !cliente.id_cliente) {
            setFormError("No se puede actualizar el cliente: ID de cliente no encontrado.");
            return;
        }
        setFormError('');
        try {
            // setLoading(true); // Opcional: un loading específico para el submit del modal
            await apiService.updateCliente(cliente.id_cliente, formDataFromModal);
            alert('Cliente actualizado con éxito!');
            handleCloseEditModal();
            fetchClienteDetalle(); // Refrescar los datos del detalle del cliente
        } catch (err) {
            console.error("Error al actualizar cliente:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido al actualizar el cliente.";
            if (errorData) {
                if (typeof errorData === 'string') errorMsg = errorData;
                else if (errorData.detail) errorMsg = errorData.detail;
                else errorMsg = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
            } else if (err.message) {
                errorMsg = err.message;
            }
            setFormError(`Error al actualizar el cliente: ${errorMsg}`);
            // No cerrar el modal para que el error se muestre dentro o el usuario corrija
        } finally {
            // setLoading(false);
        }
    };
    // --- FIN: Funciones para manejar el modal de edición ---

    if (loading) return <div className={styles.loadingMessage}>Cargando detalle del cliente...</div>;
    if (error && !cliente) return ( /* ... (manejo de error como estaba, pero el botón volver ahora solo va a /clientes o /presencias) ... */ 
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Error al Cargar Cliente</h1>
            <div className={`${styles.errorMessageCommon || styles.errorMessage} ${styles.marginBottom}`}>{error}</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                <Link 
                    to={location.state?.fromPresenciaDetail ? `/presencias/${location.state.fromPresenciaDetail}` : (location.state?.fromVentaDetail ? `/ventas/${location.state.fromVentaDetail}` : "/presencias")} 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                >
                    {location.state?.fromPresenciaDetail ? 'Volver a Detalle de Presencia' : (location.state?.fromVentaDetail ? 'Volver a Detalle de Venta' : 'Volver a Presencias')}
                </Link>
            </div>
        </div>
    );
    if (!cliente) return ( /* ... (manejo de no encontrado como estaba) ... */ 
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Cliente no Encontrado</h1>
            <div className={styles.noDataMessage}>No se encontró información para el cliente solicitado.</div>
            <div className={styles.actionsContainer} style={{ justifyContent: 'flex-start', marginTop: '20px' }}>
                 <Link 
                    to={location.state?.fromPresenciaDetail ? `/presencias/${location.state.fromPresenciaDetail}` : (location.state?.fromVentaDetail ? `/ventas/${location.state.fromVentaDetail}` : "/presencias")} 
                    className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                >
                    {location.state?.fromPresenciaDetail ? 'Volver a Detalle de Presencia' : (location.state?.fromVentaDetail ? 'Volver a Detalle de Venta' : 'Volver a Presencias')}
                </Link>
            </div>
        </div>
    );

    const edadCalculada = getAgeFromBirthDate(cliente.fecha_nacimiento_constitucion);

    return (
        <> {/* Envolver en Fragment para el modal */}
            <div className={styles.pageContainer}>
                <div className={styles.headerActions}>
                    <h1 className={styles.title}>Detalle del Cliente: {cliente.nombres_completos_razon_social}</h1>
                    {/* --- BOTÓN EDITAR CLIENTE MODIFICADO --- */}
                    <button 
                        onClick={handleOpenEditModal} // Llama a la función para abrir el modal
                        className={`${styles.detailButton} ${styles.detailButtonPrimary}`}
                    >
                        Editar Cliente
                    </button> 
                </div>

                {/* ... (Secciones de Información Personal, Contacto, Dirección, Auditoría como estaban) ... */}
                <div className={styles.sectionContainer}>
                    <h2 className={styles.sectionTitle}>Información Personal / Empresa</h2>
                    <div className={styles.detailGrid}>
                        <div className={styles.detailItem}><strong>ID Cliente:</strong> <span>{displayValue(cliente.id_cliente)}</span></div>
                        <div className={styles.detailItem}><strong>Nombres/Razón Social:</strong> <span>{displayValue(cliente.nombres_completos_razon_social)}</span></div>
                        <div className={styles.detailItem}><strong>Tipo Documento:</strong> <span>{displayValue(cliente.tipo_documento)}</span></div>
                        <div className={styles.detailItem}><strong>N° Documento:</strong> <span>{displayValue(cliente.numero_documento)}</span></div>
                        
                        {edadCalculada !== null && (
                            <div className={styles.detailItem}><strong>Edad Aprox.:</strong> <span>{edadCalculada} años</span></div>
                        )}
                        {(cliente.fecha_nacimiento_constitucion && !cliente.fecha_nacimiento_constitucion.endsWith('-01-01')) || !edadCalculada ? (
                            <div className={styles.detailItem}><strong>Fecha Nacimiento/Constitución:</strong> <span>{displayDate(cliente.fecha_nacimiento_constitucion)}</span></div>
                        ) : null}

                        <div className={styles.detailItem}><strong>Estado Civil:</strong> <span>{displayValue(cliente.estado_civil_display || cliente.estado_civil)}</span></div>
                        <div className={styles.detailItem}><strong>Profesión/Ocupación:</strong> <span>{displayValue(cliente.profesion_ocupacion)}</span></div>
                    </div>
                </div>

                <div className={styles.sectionContainer}>
                    <h2 className={styles.sectionTitle}>Información de Contacto</h2>
                    <div className={styles.detailGrid}>
                        <div className={styles.detailItem}><strong>Email Principal:</strong> <span>{displayValue(cliente.email_principal)}</span></div>
                        <div className={styles.detailItem}><strong>Email Secundario:</strong> <span>{displayValue(cliente.email_secundario)}</span></div>
                        <div className={styles.detailItem}><strong>Teléfono Principal:</strong> <span>{displayValue(cliente.telefono_principal)}</span></div>
                        <div className={styles.detailItem}><strong>Teléfono Secundario:</strong> <span>{displayValue(cliente.telefono_secundario)}</span></div>
                    </div>
                </div>
                
                <div className={styles.sectionContainer}>
                    <h2 className={styles.sectionTitle}>Dirección</h2>
                    <div className={styles.detailGrid}>
                        <div className={styles.detailItemFull}><strong>Dirección Completa:</strong> <span>{displayValue(cliente.direccion)}</span></div>
                        <div className={styles.detailItem}><strong>Distrito:</strong> <span>{displayValue(cliente.distrito)}</span></div>
                        <div className={styles.detailItem}><strong>Provincia:</strong> <span>{displayValue(cliente.provincia)}</span></div>
                        <div className={styles.detailItem}><strong>Departamento:</strong> <span>{displayValue(cliente.departamento)}</span></div>
                    </div>
                </div>

                <div className={styles.sectionContainer}>
                     <h2 className={styles.sectionTitle}>Auditoría</h2>
                    <div className={styles.detailGrid}>
                        <div className={styles.detailItem}><strong>Fecha Registro:</strong> <span>{displayDateTime(cliente.fecha_registro)}</span></div>
                        <div className={styles.detailItem}><strong>Última Modificación:</strong> <span>{displayDateTime(cliente.ultima_modificacion)}</span></div>
                    </div>
                </div>

                <div className={styles.actionsContainer}>
                    <Link 
                        to={location.state?.fromPresenciaDetail ? `/presencias/${location.state.fromPresenciaDetail}` : (location.state?.fromVentaDetail ? `/ventas/${location.state.fromVentaDetail}` : "/presencias")} 
                        className={`${styles.detailButton} ${styles.detailButtonSecondary}`}
                    >
                        {location.state?.fromPresenciaDetail ? 'Volver a Detalle de Presencia' : (location.state?.fromVentaDetail ? 'Volver a Detalle de Venta' : 'Volver a Presencias')}
                    </Link>
                </div>
            </div>

            {/* --- INICIO: Renderizado Condicional de ClienteForm --- */}
            {isEditModalOpen && cliente && (
                <ClienteForm
                    show={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    onSubmit={handleSubmitClienteEditado}
                    initialData={cliente} // Pasar los datos del cliente actual para edición
                    formError={formError}
                    clearExternalError={() => setFormError('')}
                />
            )}
            {/* --- FIN: Renderizado Condicional de ClienteForm --- */}
        </>
    );
}

export default ClienteDetailPage;