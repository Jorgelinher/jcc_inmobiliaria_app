// src/pages/ClientesPage.jsx (Ejemplo de estructura necesaria)
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService';
import ClienteForm from '../components/forms/ClienteForm'; // Asegúrate que la ruta sea correcta
import styles from './ClientesPage.module.css'; // O el CSS que uses para esta página

function ClientesPage() {
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCliente, setEditingCliente] = useState(null);
    const [formError, setFormError] = useState(''); // Para errores del formulario modal

    const location = useLocation();
    const navigate = useNavigate();

    const fetchClientes = useCallback(async (/* Posibles filtros si los tienes */) => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.getClientes(/* queryParams */);
            setClientes(response.data.results || response.data || []);
        } catch (err) {
            setError("Error al cargar los clientes.");
            setClientes([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchClientes();
    }, [fetchClientes]);

    // --- INICIO: LÓGICA PARA ABRIR MODAL AL NAVEGAR CON ESTADO ---
    useEffect(() => {
        if (location.state?.accion === 'editarCliente' && location.state?.idClienteAEditar) {
            console.log(`[ClientesPage] Se recibió acción para editar cliente ID: ${location.state.idClienteAEditar}`);
            const clienteAEditar = clientes.find(c => c.id_cliente === location.state.idClienteAEditar);
            if (clienteAEditar) {
                console.log("[ClientesPage] Cliente encontrado para editar:", clienteAEditar);
                handleOpenModalForEdit(clienteAEditar);
            } else if (!loading && clientes.length > 0) {
                console.warn(`[ClientesPage] Cliente con ID ${location.state.idClienteAEditar} no encontrado en la lista actual.`);
                // Limpiar el estado para evitar reintentos si el usuario navega de nuevo
                navigate(location.pathname, { replace: true, state: {} });
            }
            // Si 'clientes' aún no ha cargado, este efecto se re-ejecutará cuando lo haga.
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state, clientes, loading]); // Añadir 'loading' a las dependencias
    // --- FIN: LÓGICA PARA ABRIR MODAL ---

    const handleOpenModalForCreate = () => {
        setEditingCliente(null);
        setFormError('');
        setIsModalOpen(true);
    };
    
    const handleOpenModalForEdit = (cliente) => {
        setEditingCliente(cliente);
        setFormError('');
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCliente(null);
        setFormError('');
        // Limpiar el estado de navegación para que no se reabra el modal al interactuar con la página
        if (location.state?.accion) {
            navigate(location.pathname, { replace: true, state: {} });
        }
    };

    const handleSubmitCliente = async (formDataDelModal) => {
        setFormError('');
        try {
            if (editingCliente && editingCliente.id_cliente) {
                await apiService.updateCliente(editingCliente.id_cliente, formDataDelModal);
                alert('Cliente actualizado con éxito!');
            } else {
                await apiService.createCliente(formDataDelModal);
                alert('Cliente creado con éxito!');
            }
            handleCloseModal();
            fetchClientes(); // Refrescar la lista
        } catch (err) {
            console.error("Error al guardar cliente:", err.response?.data || err.message);
            const errorData = err.response?.data;
            let errorMsg = "Error desconocido.";
            if (errorData) {
                if (typeof errorData === 'string') errorMsg = errorData;
                else if (errorData.detail) errorMsg = errorData.detail;
                else errorMsg = Object.entries(errorData).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join('; ');
            } else if (err.message) {
                errorMsg = err.message;
            }
            setFormError(`Error al guardar el cliente: ${errorMsg}`);
            // No cerrar el modal para que el error se muestre dentro o el usuario corrija
        }
    };

    const handleDeleteCliente = async (clienteId) => {
        if (window.confirm(`¿Eliminar cliente ${clienteId}?`)) {
            try {
                setLoading(true);
                await apiService.deleteCliente(clienteId);
                alert('Cliente eliminado!');
                fetchClientes(filters); 
            } catch (err) { 
                alert(`Error al eliminar el cliente: ${err.message || 'Error desconocido.'}`);
                setLoading(false);
            }
        }
    };
    
    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>Listado de Clientes</h1>
            {/* ... (filtros para clientes si los tienes) ... */}
            <div className={styles.createButtonContainer}>
                <button onClick={handleOpenModalForCreate} className={styles.createButton}>
                    Registrar Nuevo Cliente
                </button>
            </div>

            {error && <div className={`${styles.errorMessageCommon || styles.errorMessage}`}>{error}</div>}
            {loading && <div className={styles.loadingMessage}>Cargando clientes...</div>}

            {!loading && clientes.length === 0 && !error && (
                <p className={styles.noDataMessage}>No hay clientes para mostrar.</p>
            )}

            {clientes.length > 0 && (
                <div className={styles.tableResponsiveContainer}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID Cliente</th>
                                <th>Nombres/Razón Social</th>
                                <th>Documento</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientes.map(cliente => (
                                <tr key={cliente.id_cliente}>
                                    <td>{cliente.id_cliente}</td>
                                    <td>{cliente.nombres_completos_razon_social}</td>
                                    <td>{cliente.tipo_documento}: {cliente.numero_documento}</td>
                                    <td>{cliente.telefono_principal || '-'}</td>
                                    <td>{cliente.email_principal || '-'}</td>
                                    <td className={styles.actionButtons}>
                                        <Link to={`/clientes/${cliente.id_cliente}`} className={`${styles.button} ${styles.viewButton}`}>Ver</Link>
                                        <button onClick={() => handleOpenModalForEdit(cliente)} className={`${styles.button} ${styles.editButton}`}>Editar</button>
                                        {/* <button onClick={() => handleDeleteCliente(cliente.id_cliente)} className={`${styles.button} ${styles.deleteButton}`}>Eliminar</button> */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <ClienteForm
                    show={isModalOpen}
                    onClose={handleCloseModal}
                    onSubmit={handleSubmitCliente}
                    initialData={editingCliente}
                    formError={formError} // Pasar error del formulario al modal
                    clearExternalError={() => setFormError('')} // Para que el modal pueda limpiar este error
                />
            )}
        </div>
    );
}

export default ClientesPage;
