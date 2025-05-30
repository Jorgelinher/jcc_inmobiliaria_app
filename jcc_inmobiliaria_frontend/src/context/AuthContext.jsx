// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as apiService from '../services/apiService'; // Importa todo desde apiService

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoadingAuth, setIsLoadingAuth] = useState(true);
    const [authActionLoading, setAuthActionLoading] = useState(false);
    const navigate = useNavigate();

    // Nombre de la función corregido aquí para que coincida con apiService.js
    const performCheckAuthStatus = useCallback(async () => { // Renombrado para evitar conflicto de nombres si se exporta checkAuthStatus
        setIsLoadingAuth(true);
        try {
            await apiService.fetchCsrfToken(); 
            
            // CORRECCIÓN AQUÍ: Cambiado de getAuthStatus a checkAuthStatus
            const response = await apiService.checkAuthStatus(); 
            
            if (response.data.isAuthenticated && response.data.user) {
                setUser(response.data.user);
                setIsAuthenticated(true);
            } else {
                setUser(null);
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error("AuthContext: Error verificando estado de auth o fetchCsrfToken inicial:", error.response?.data || error.message);
            setUser(null);
            setIsAuthenticated(false);
        } finally {
            setIsLoadingAuth(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // No necesita navigate como dependencia si no se usa directamente aquí para redirigir en error inicial

    useEffect(() => {
        performCheckAuthStatus(); // Llamar a la función renombrada
    }, [performCheckAuthStatus]);

    // useEffect(() => {
    //     // console.log("AuthContext STATE CHANGE: isLoadingAuth:", isLoadingAuth, "isAuthenticated:", isAuthenticated);
    // }, [isLoadingAuth, isAuthenticated]);

    const login = async (username, password) => {
        setAuthActionLoading(true);
        try {
            const response = await apiService.loginUser({ username, password });
            if (response.data.success && response.data.user) {
                setUser(response.data.user);
                setIsAuthenticated(true);
                setAuthActionLoading(false);
                navigate('/dashboard'); // Redirige después de un login exitoso
                return true;
            } else {
                throw new Error(response.data.error || "Respuesta de login no exitosa desde AuthContext");
            }
        } catch (error) {
            setUser(null);
            setIsAuthenticated(false);
            setAuthActionLoading(false);
            console.error("AuthContext: Falló el login", error.response?.data || error.message);
            throw error; // Re-lanza el error para que el componente LoginPage pueda manejarlo (ej. mostrar mensaje)
        }
    };

    const logout = async () => {
        setAuthActionLoading(true);
        try {
            await apiService.logoutUser();
        } catch (error) {
            console.error("AuthContext: Error en API de logout", error.response?.data || error.message);
            // Incluso si el logout de API falla, procedemos a limpiar el estado del frontend
        } finally {
            setUser(null);
            setIsAuthenticated(false);
            setAuthActionLoading(false);
            // apiService.clearCsrfTokenInMemory(); // Si implementas esta función en apiService.js
            navigate('/login'); // Redirige a login después del logout
        }
    };

    const value = {
        user,
        isAuthenticated,
        isLoadingAuth,
        loading: authActionLoading, // Usado para feedback en botones de login/logout
        login,
        logout,
        checkAuthStatus: performCheckAuthStatus // Exportar la función para re-verificar si es necesario desde fuera
    };

    return (
        <AuthContext.Provider value={value}>
            {isLoadingAuth ? (
                <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '1.2em'}}>
                    Cargando aplicación...
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
