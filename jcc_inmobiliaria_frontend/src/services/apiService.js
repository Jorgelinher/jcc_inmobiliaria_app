// src/services/apiService.js
import axios from 'axios';

// Configuración de baseURL para desarrollo y producción
const API_BASE_URL = import.meta.env.VITE_API_URL || 
    (import.meta.env.DEV ? '/api' : 'https://jcc-inmobiliaria-app.onrender.com/api');

console.log('[apiService] API_BASE_URL configurado:', API_BASE_URL);
console.log('[apiService] Environment:', import.meta.env.MODE);
console.log('[apiService] VITE_API_URL:', import.meta.env.VITE_API_URL);

const apiClient = axios.create({
    baseURL: API_BASE_URL, 
    withCredentials: true, 
    headers: {
        'Content-Type': 'application/json',
    }
});

// No usaremos csrfTokenInMemory para el header, confiaremos en la cookie
// y en la respuesta de get-csrf-token para la petición actual si la cookie no existe.
// let csrfTokenInMemory = null; 

function getCsrfTokenFromCookie() {
    const match = document.cookie.match(new RegExp('(^| )csrftoken=([^;]+)'));
    if (match) {
        console.log("[CSRF] Token encontrado en cookie:", match[2]);
        return match[2];
    }
    console.log("[CSRF] Token no encontrado en cookie.");
    return null;
}

// Interceptor de Solicitud (Request)
apiClient.interceptors.request.use(
    async (config) => {
        console.log(`[apiService Request Interceptor] Method: ${config.method.toUpperCase()}, URL: ${config.baseURL}${config.url}`);
        
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method.toUpperCase())) {
            let token = getCsrfTokenFromCookie();

            if (!token) {
                console.warn("[CSRF] No se encontró token en cookie. Intentando obtener uno nuevo del API...");
                try {
                    // Usamos axios.get directamente para evitar problemas con el interceptor de apiClient
                    // y asegurar que withCredentials se envíe para esta solicitud específica.
                    const csrfResponse = await axios.get('/api/auth/get-csrf-token/', { withCredentials: true });
                    if (csrfResponse.data && csrfResponse.data.csrfToken) {
                        token = csrfResponse.data.csrfToken;
                        console.log("[CSRF] Token obtenido del API y se usará para la cabecera:", token);
                        // No es necesario setear csrfTokenInMemory si siempre leemos de la cookie o de esta respuesta.
                        // La cookie debería haberse seteado en el navegador por la respuesta de esta llamada.
                    } else {
                        console.error("[CSRF] Respuesta de /get-csrf-token/ no contenía csrfToken.");
                    }
                } catch (error) {
                    console.error("[CSRF] Error crítico al obtener token CSRF del API:", error.response || error.message);
                    // No se pudo obtener el token, la petición principal probablemente fallará.
                }
            }
            
            if (token) {
                config.headers['X-CSRFToken'] = token;
                console.log(`[CSRF] X-CSRFToken establecido para ${config.method.toUpperCase()} ${config.url}: ${token}`);
            } else {
                console.error(`[CSRF] FALLO AL OBTENER TOKEN CSRF para ${config.method.toUpperCase()} ${config.url}. La petición fallará.`);
            }
        }
        return config;
    },
    (error) => {
        console.error("[apiService Request Interceptor] Error en configuración de solicitud:", error);
        return Promise.reject(error);
    }
);

// Interceptor de Respuesta (Response)
apiClient.interceptors.response.use(
    (response) => {
        console.log(`[apiService Response Interceptor] Respuesta Exitosa para URL: ${response.config.url}, Status: ${response.status}`, response.data); // Log response.data
        return response;
    },
    (error) => {
        console.error(`[apiService Response Interceptor] Error en Respuesta para URL: ${error.config?.url}, Status: ${error.response?.status}`, error.response?.data || error.message || error);
        return Promise.reject(error);
    }
);

export const fetchCsrfToken = async () => {
    try {
        console.log("[apiService] llamando a fetchCsrfToken (GET /api/auth/get-csrf-token/)");
        // Esta llamada es principalmente para asegurar que la cookie CSRF esté seteada al inicio.
        // El valor del token en la respuesta JSON es útil para el primer POST si la cookie no se lee inmediatamente.
        const response = await apiClient.get('/auth/get-csrf-token/');
        return response.data; 
    } catch (error) {
        console.error("[apiService] Error en fetchCsrfToken:", error.response || error.message);
        throw error; 
    }
};

export const loginUser = (credentials) => {
    console.log("[apiService] llamando a loginUser");
    return apiClient.post('/auth/login/', credentials);
};
export const logoutUser = () => {
    console.log("[apiService] llamando a logoutUser");
    // csrfTokenInMemory = null; // Ya no lo usamos centralmente para el header
    return apiClient.post('/auth/logout/');
};
export const checkAuthStatus = () => {
    console.log("[apiService] llamando a checkAuthStatus");
    return apiClient.get('/auth/status/');
};

// --- CRUD Lotes ---
export const getLotes = (queryParams = '') => apiClient.get(`/gestion/lotes/${queryParams ? `?${queryParams}` : ''}`);
export const createLote = (data) => apiClient.post('/gestion/lotes/', data);
export const updateLote = (id, data) => apiClient.put(`/gestion/lotes/${id}/`, data);
export const deleteLote = (id) => apiClient.delete(`/gestion/lotes/${id}/`);
export const getLoteById = (id) => apiClient.get(`/gestion/lotes/${id}/`);
export const getUbicacionesProyecto = () => apiClient.get('/gestion/lotes/ubicaciones_proyecto/');

// --- CRUD Clientes ---
export const getClientes = (queryParams = '') => apiClient.get(`/gestion/clientes/${queryParams ? `?${queryParams}` : ''}`);
export const createCliente = (data) => apiClient.post('/gestion/clientes/', data);
export const updateCliente = (id, data) => apiClient.put(`/gestion/clientes/${id}/`, data);
export const deleteCliente = (id) => apiClient.delete(`/gestion/clientes/${id}/`);
export const getClienteById = (id) => apiClient.get(`/gestion/clientes/${id}/`);

// --- Nuevos endpoints para clientes ---
export const getClientesSinPresencia = (search = '', limit = 50) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit);
    return apiClient.get(`/gestion/clientes/sin_presencia/?${params.toString()}`);
};

export const getClientesParaVentas = (search = '', limit = 50) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (limit) params.append('limit', limit);
    return apiClient.get(`/gestion/clientes/para_ventas/?${params.toString()}`);
};

export const searchClientes = (query) => {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    return apiClient.get(`/gestion/clientes/search/?${params.toString()}`);
};

// --- CRUD Asesores ---
export const getAsesores = (queryParams = '') => apiClient.get(`/gestion/asesores/${queryParams ? `?${queryParams}` : ''}`);
export const searchAsesores = (searchTerm) => apiClient.get(`/gestion/asesores/search/?search=${encodeURIComponent(searchTerm)}`);
export const createAsesor = (data) => apiClient.post('/gestion/asesores/', data);
export const updateAsesor = (id, data) => apiClient.put(`/gestion/asesores/${id}/`, data);
export const deleteAsesor = (id) => apiClient.delete(`/gestion/asesores/${id}/`);
export const getAsesorById = (id) => apiClient.get(`/gestion/asesores/${id}/`);
export const getAdvisorsForFilter = () => apiClient.get('/gestion/get-advisors-list/');

// --- CRUD Ventas ---
export const getVentas = (queryParams = '') => apiClient.get(`/gestion/ventas/${queryParams ? `?${queryParams}` : ''}`);
export const createVenta = (data) => apiClient.post('/gestion/ventas/', data);
export const updateVenta = (id, data) => apiClient.put(`/gestion/ventas/${id}/`, data);
export const deleteVenta = (id) => apiClient.delete(`/gestion/ventas/${id}/`);
export const getVentaById = (id) => apiClient.get(`/gestion/ventas/${id}/`);

// --- CRUD Actividades Diarias ---
export const getActividadesDiarias = (queryParams = '') => apiClient.get(`/gestion/actividades/${queryParams ? `?${queryParams}` : ''}`);
export const createActividadDiaria = (data) => apiClient.post('/gestion/actividades/', data);
export const updateActividadDiaria = (id, data) => apiClient.put(`/gestion/actividades/${id}/`, data);
export const deleteActividadDiaria = (id) => apiClient.delete(`/gestion/actividades/${id}/`);
export const getActividadDiariaById = (id) => apiClient.get(`/gestion/actividades/${id}/`);
export const marcarVentaComoFirmada = (ventaId, fechaFirma = null) => {
    const payload = {};
    if (fechaFirma) {
        payload.fecha_firma_contrato = fechaFirma; // En formato YYYY-MM-DD
    }
    console.log(`[apiService] POST marcarVentaComoFirmada para Venta ID: ${ventaId} con payload:`, payload);
    return apiClient.post(`/gestion/ventas/${ventaId}/marcar_firma_contrato/`, payload);
};

export const revertirFirmaContrato = (ventaId) => {
    console.log(`[apiService] POST revertirFirmaContrato para Venta ID: ${ventaId}`);
    return apiClient.post(`/gestion/ventas/${ventaId}/revertir_firma_contrato/`, {});
};

// --- Dashboard y Comisiones ---
export const getDashboardDataFromApi = (filters = {}) => {
    const activeFilters = Object.entries(filters).filter(([_, value]) => value !== '' && value !== null).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
    const queryParams = new URLSearchParams(activeFilters).toString();
    const url = `/gestion/dashboard-data/${queryParams ? `?${queryParams}` : ''}`;
    console.log("[apiService] GET Dashboard URL:", url);
    return apiClient.get(url);
};
export const getCommissionSummary = (filters = {}) => {
    const activeFilters = Object.entries(filters).filter(([_, value]) => value !== '' && value !== null).reduce((obj, [key, value]) => { obj[key] = value; return obj; }, {});
    const queryParams = new URLSearchParams(activeFilters).toString();
    const url = `/gestion/commission-summary/${queryParams ? `?${queryParams}` : ''}`;
    console.log("[apiService] GET Commission Summary URL:", url);
    return apiClient.get(url);
};
export const getDefaultCommissionRate = (params) => {
    const queryParams = new URLSearchParams(params).toString();
    const url = `/gestion/get-default-commission-rate/?${queryParams}`;
    console.log("[apiService] GET Default Commission Rate URL:", url);
    return apiClient.get(url);
};

// --- CRUD Registros de Pago ---
export const getRegistrosPagoByVenta = (ventaId, queryParams = '') => {
    let url = `/gestion/registropagos/?venta=${ventaId}`;
    if (queryParams) { url += `&${queryParams}`; }
    return apiClient.get(url);
};
export const createRegistroPago = (data) => {
    console.log("[apiService] POST createRegistroPago con data:", data);
    return apiClient.post('/gestion/registropagos/', data);
};
export const updateRegistroPago = (id, data) => apiClient.put(`/gestion/registropagos/${id}/`, data);
export const deleteRegistroPago = (id) => {
    console.log(`[apiService] DELETE deleteRegistroPago ID: ${id}`);
    return apiClient.delete(`/gestion/registropagos/${id}/`);
};
export const getRegistroPagoById = (id) => apiClient.get(`/gestion/registropagos/${id}/`);

// --- CRUD Presencias ---
export const getPresencias = (queryParams = '') => apiClient.get(`/gestion/presencias/${queryParams ? `?${queryParams}` : ''}`);
export const createPresencia = (data) => apiClient.post('/gestion/presencias/', data);
export const updatePresencia = (id, data) => apiClient.put(`/gestion/presencias/${id}/`, data);
export const deletePresencia = (id) => apiClient.delete(`/gestion/presencias/${id}/`);
export const getPresenciaById = (id) => apiClient.get(`/gestion/presencias/${id}/`);

// --- Plan de Pagos y Cuotas ---
export const getPlanPagoByVentaId = (ventaId) => apiClient.get(`/gestion/planespago/?venta__id_venta=${ventaId}`);
export const getCuotasByPlanPagoId = (planPagoId) => apiClient.get(`/gestion/cuotasplanpago/?plan_pago_venta=${planPagoId}`);
export const updateCuotaPlanPago = (idCuota, data) => apiClient.patch(`/gestion/cuotasplanpago/${idCuota}/`, data);

// --- Otras ---
export const calculateCommission = (params) => apiClient.get('/gestion/calculate-commission/', { params }); 
export const getCommissionStructure = () => apiClient.get('/gestion/commission-structure/');
export const getGeneralConfigs = () => apiClient.get('/gestion/general-configs/');

export const get = (url, config) => apiClient.get(url, config);
export const post = (url, data, config) => apiClient.post(url, data, config);

// Exportación default para compatibilidad con import apiService from '...'
const apiService = { get, post };
export default apiService;

