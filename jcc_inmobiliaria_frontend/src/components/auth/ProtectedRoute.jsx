// src/components/auth/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; // Asegúrate que la ruta al AuthContext sea correcta

const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, isLoadingAuth } = useAuth(); // [cite: 71]
    const location = useLocation();

    if (isLoadingAuth) {
        // Puedes poner un componente de Spinner o un mensaje más elaborado aquí si lo deseas
        return <div>Cargando sesión...</div>; // [cite: 72]
    }

    if (!isAuthenticated) {
        // Redirige al login, guardando la ubicación actual para posible redirección post-login
        return <Navigate to="/login" state={{ from: location }} replace />; // [cite: 73]
    }

    return children; // [cite: 74]
};

export default ProtectedRoute;