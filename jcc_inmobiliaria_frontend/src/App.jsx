// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';

import DashboardPage from './pages/DashboardPage';
import LotesPage from './pages/LotesPage';
import LoteDetailPage from './pages/LoteDetailPage';

// --- INICIO: DESCOMENTAR Y ASEGURAR IMPORTACIÓN ---
import ClienteDetailPage from './pages/ClienteDetailPage'; 
// --- FIN: DESCOMENTAR Y ASEGURAR IMPORTACIÓN ---

import PresenciasPage from './pages/PresenciasPage';
import PresenciaDetailPage from './pages/PresenciaDetailPage';

import AsesoresPage from './pages/AsesoresPage';
import AsesorDetailPage from './pages/AsesorDetailPage'; 
import VentasPage from './pages/VentasPage';
import VentaDetailPage from './pages/VentaDetailPage'; 
import ActividadesPage from './pages/ActividadesPage';
import ActividadDetailPage from './pages/ActividadDetailPage'; 
import ComisionesPage from './pages/ComisionesPage'; 
import CobranzasPage from './pages/CobranzasPage';
import CierreComisionesPage from './pages/CierreComisionesPage';
import ReporteCierrePage from './pages/ReporteCierrePage';

const RootRedirect = () => {
    const { isAuthenticated, isLoadingAuth } = useAuth();
    if (isLoadingAuth) return null; 
    // Solo redirigir si no está autenticado, si está autenticado dejar que React Router maneje la ruta
    return isAuthenticated ? null : <Navigate to="/login" replace />;
};

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<Layout />}> {/* Layout envuelve las rutas protegidas */}
                        <Route index element={<RootRedirect />} />
                        <Route path="dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                        
                        <Route path="lotes" element={<ProtectedRoute><LotesPage /></ProtectedRoute>} />
                        <Route path="lotes/:idLote" element={<ProtectedRoute><LoteDetailPage /></ProtectedRoute>} /> 
                        
                        <Route path="presencias" element={<ProtectedRoute><PresenciasPage /></ProtectedRoute>} />
                        <Route path="presencias/:idPresencia" element={<ProtectedRoute><PresenciaDetailPage /></ProtectedRoute>} />
                        
                        {/* --- INICIO: AÑADIR RUTA PARA ClienteDetailPage --- */}
                        <Route path="clientes/:idCliente" element={<ProtectedRoute><ClienteDetailPage /></ProtectedRoute>} />
                        {/* --- FIN: AÑADIR RUTA --- */}

                        <Route path="asesores" element={<ProtectedRoute><AsesoresPage /></ProtectedRoute>} />
                        <Route path="asesores/:idAsesor" element={<ProtectedRoute><AsesorDetailPage /></ProtectedRoute>} /> 

                        <Route path="ventas" element={<ProtectedRoute><VentasPage /></ProtectedRoute>} />
                        <Route path="ventas/:idVenta" element={<ProtectedRoute><VentaDetailPage /></ProtectedRoute>} /> 

                        <Route path="actividades" element={<ProtectedRoute><ActividadesPage /></ProtectedRoute>} />
                        <Route path="actividades/:idActividad" element={<ProtectedRoute><ActividadDetailPage /></ProtectedRoute>} /> 
                        
                        <Route path="comisiones" element={<ProtectedRoute><ComisionesPage /></ProtectedRoute>} /> 

                        <Route path="cobranzas" element={<ProtectedRoute><CobranzasPage /></ProtectedRoute>} />

                        <Route path="cierres-comisiones/:mes/:anio" element={<ProtectedRoute><ReporteCierrePage /></ProtectedRoute>} />
                        <Route path="cierres-comisiones" element={<ProtectedRoute><CierreComisionesPage /></ProtectedRoute>} />
                    </Route>
                    <Route path="*" element={ <Layout> <div style={{ padding: '50px', textAlign: 'center' }}> <h2>404 - Página No Encontrada</h2> <p>Lo sentimos, la página que buscas no existe.</p> <Link to="/">Volver al Inicio</Link> </div> </Layout> } />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;