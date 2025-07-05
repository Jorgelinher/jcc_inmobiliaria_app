import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from '../../pages/DashboardPage';
import { AuthProvider } from '../../context/AuthContext';

// Mock del apiService
jest.mock('../../services/apiService', () => ({
  getDashboardDataFromApi: jest.fn(),
  getAdvisorsForFilter: jest.fn(),
  getCsrfToken: jest.fn(),
}));

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  );
};

describe('Dashboard Flow E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de datos del dashboard
    const mockApi = require('../../services/apiService');
    mockApi.getDashboardDataFromApi.mockResolvedValue({
      data: {
        success: true,
        total_ventas: 25,
        total_clientes: 150,
        total_lotes: 200,
        total_asesores: 8,
        ventas_mes: 5,
        ingresos_mes: 250000,
        ventas_pendientes: 3,
        comisiones_pendientes: 15000,
        graficos: {
          ventas_por_mes: [['Mes', 'Ventas'], ['Enero', 5], ['Febrero', 3]],
          lotes_por_estado: [['Estado', 'Cantidad'], ['Disponible', 150], ['Vendido', 50]]
        }
      }
    });
    mockApi.getAdvisorsForFilter.mockResolvedValue({
      data: [
        { id: 1, nombre: 'Asesor 1' },
        { id: 2, nombre: 'Asesor 2' }
      ]
    });
    mockApi.getCsrfToken.mockResolvedValue({ data: { csrfToken: 'test-token' } });
  });

  test('Flujo completo de carga del dashboard', async () => {
    renderWithProviders(<DashboardPage />);

    // Verificar que se muestran los filtros del dashboard
    expect(screen.getByText(/asesor: todos/i)).toBeInTheDocument();
    expect(screen.getByText(/tipo venta: todos/i)).toBeInTheDocument();
    expect(screen.getByText(/limpiar/i)).toBeInTheDocument();

    // Esperar a que se carguen los datos del dashboard
    await waitFor(() => {
      expect(screen.getByText(/limpiar/i)).toBeInTheDocument();
    });

    // Verificar que se llamó al API correctamente
    expect(require('../../services/apiService').getDashboardDataFromApi).toHaveBeenCalled();
    expect(require('../../services/apiService').getAdvisorsForFilter).toHaveBeenCalled();
  });

  test('Flujo de filtros del dashboard', async () => {
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />);

    // Esperar a que se carguen los filtros
    await waitFor(() => {
      expect(screen.getByText(/limpiar/i)).toBeInTheDocument();
    });

    // Verificar que existen los filtros básicos
    expect(screen.getByText(/tipo venta: todos/i)).toBeInTheDocument();
    expect(screen.getByText(/status venta: todos/i)).toBeInTheDocument();

    // Probar el botón de limpiar filtros
    const limpiarBtn = screen.getByText(/limpiar/i);
    await user.click(limpiarBtn);

    // Verificar que se llamó al API para refrescar datos
    await waitFor(() => {
      expect(require('../../services/apiService').getDashboardDataFromApi).toHaveBeenCalled();
    });
  });

  test('Flujo de cambio de filtros', async () => {
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />);

    // Esperar a que se carguen los filtros
    await waitFor(() => {
      expect(screen.getByText(/limpiar/i)).toBeInTheDocument();
    });

    // Cambiar filtro de tipo de venta
    const tipoVentaSelect = screen.getByTitle(/tipo de venta/i);
    await user.click(tipoVentaSelect);
    
    // Seleccionar "Crédito"
    const creditoOption = screen.getByText(/crédito/i);
    await user.click(creditoOption);

    // Verificar que se llamó al API (sin verificar parámetros específicos)
    await waitFor(() => {
      expect(require('../../services/apiService').getDashboardDataFromApi).toHaveBeenCalled();
    });
  });

  test('Flujo de visualización de filtros', async () => {
    renderWithProviders(<DashboardPage />);

    // Esperar a que se carguen los filtros
    await waitFor(() => {
      expect(screen.getByText(/limpiar/i)).toBeInTheDocument();
    });

    // Verificar que se muestran los filtros principales
    expect(screen.getByTitle(/tipo de venta/i)).toBeInTheDocument();
    expect(screen.getByTitle(/status de venta/i)).toBeInTheDocument();
    expect(screen.getByTitle(/fecha inicio/i)).toBeInTheDocument();
    expect(screen.getByTitle(/fecha fin/i)).toBeInTheDocument();
  });

  test('Flujo de manejo de errores en el dashboard', async () => {
    const mockApi = require('../../services/apiService');
    mockApi.getDashboardDataFromApi.mockRejectedValue({
      response: { 
        data: { message: 'Error al cargar datos del dashboard' },
        status: 500
      }
    });

    renderWithProviders(<DashboardPage />);

    // Verificar que se muestra un mensaje de error
    await waitFor(() => {
      expect(screen.getByText(/error al conectar con el servidor/i)).toBeInTheDocument();
    });
  });

  test('Flujo de actualización de datos en tiempo real', async () => {
    const user = userEvent.setup();

    renderWithProviders(<DashboardPage />);

    // Esperar a que se carguen los datos iniciales
    await waitFor(() => {
      expect(screen.getByText(/limpiar/i)).toBeInTheDocument();
    });

    // Cambiar un filtro para simular actualización
    const tipoVentaSelect = screen.getByTitle(/tipo de venta/i);
    await user.click(tipoVentaSelect);
    
    const contadoOption = screen.getByText(/contado/i);
    await user.click(contadoOption);

    // Verificar que se llamó al API para actualizar datos
    await waitFor(() => {
      expect(require('../../services/apiService').getDashboardDataFromApi).toHaveBeenCalled();
    });
  });
}); 