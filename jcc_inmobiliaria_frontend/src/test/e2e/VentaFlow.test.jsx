import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import VentaForm from '../../components/forms/VentaForm';
import { AuthProvider } from '../../context/AuthContext';

// Mock del apiService
jest.mock('../../services/apiService', () => ({
  getClientes: jest.fn(),
  getLotes: jest.fn(),
  getAsesores: jest.fn(),
  createVenta: jest.fn(),
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

describe('Venta Flow E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock de datos iniciales
    const mockApi = require('../../services/apiService');
    mockApi.getClientes.mockResolvedValue({
      data: [
        { id: 1, nombre: 'Juan Pérez', numero_documento: '12345678' },
        { id: 2, nombre: 'María García', numero_documento: '87654321' }
      ]
    });
    mockApi.getLotes.mockResolvedValue({
      data: [
        { id: 1, numero: 'L-001', precio: 50000, estado: 'disponible' },
        { id: 2, numero: 'L-002', precio: 75000, estado: 'disponible' }
      ]
    });
    mockApi.getAsesores.mockResolvedValue({
      data: [
        { id: 1, nombre: 'Asesor 1', comision: 5 },
        { id: 2, nombre: 'Asesor 2', comision: 3 }
      ]
    });
    mockApi.getCsrfToken.mockResolvedValue({ data: { csrfToken: 'test-token' } });
  });

  test('Flujo completo de crear venta exitosa', async () => {
    const user = userEvent.setup();
    const mockCreateVenta = require('../../services/apiService').createVenta;
    
    // Mock de creación exitosa
    mockCreateVenta.mockResolvedValue({
      data: { 
        id: 1, 
        message: 'Venta creada exitosamente',
        venta: {
          id: 1,
          cliente: { nombre: 'Juan Pérez' },
          lote: { numero: 'L-001' },
          precio_venta: 50000
        }
      }
    });

    renderWithProviders(<VentaForm />);

    // Esperar a que se carguen los datos
    await waitFor(() => {
      expect(screen.getByText(/nueva venta/i)).toBeInTheDocument();
    });

    // Seleccionar cliente
    const clienteSelect = screen.getByLabelText(/cliente/i);
    await user.click(clienteSelect);
    await user.click(screen.getByText('Juan Pérez'));

    // Seleccionar lote
    const loteSelect = screen.getByLabelText(/lote/i);
    await user.click(loteSelect);
    await user.click(screen.getByText('L-001'));

    // Llenar precio de venta
    const precioInput = screen.getByLabelText(/precio de venta/i);
    await user.clear(precioInput);
    await user.type(precioInput, '55000');

    // Llenar fecha de venta
    const fechaInput = screen.getByLabelText(/fecha de venta/i);
    await user.clear(fechaInput);
    await user.type(fechaInput, '2024-01-15');

    // Agregar asesor
    const agregarAsesorBtn = screen.getByText(/agregar asesor/i);
    await user.click(agregarAsesorBtn);

    // Seleccionar asesor en la lista dinámica
    const asesorSelect = screen.getByDisplayValue(/seleccionar asesor/i);
    await user.click(asesorSelect);
    await user.click(screen.getByText('Asesor 1'));

    // Llenar comisión
    const comisionInput = screen.getByLabelText(/comisión/i);
    await user.clear(comisionInput);
    await user.type(comisionInput, '5');

    // Guardar la venta
    const guardarBtn = screen.getByText(/guardar/i);
    await user.click(guardarBtn);

    // Verificar que se llamó al API con los datos correctos
    await waitFor(() => {
      expect(mockCreateVenta).toHaveBeenCalledWith({
        cliente: 1,
        lote: 1,
        precio_venta: 55000,
        fecha_venta: '2024-01-15',
        asesores_involucrados: [
          {
            asesor: 1,
            comision: 5
          }
        ]
      });
    });
  });

  test('Flujo de crear venta con validaciones', async () => {
    const user = userEvent.setup();

    renderWithProviders(<VentaForm />);

    // Esperar a que se cargue el formulario
    await waitFor(() => {
      expect(screen.getByText(/nueva venta/i)).toBeInTheDocument();
    });

    // Intentar guardar sin llenar campos requeridos
    const guardarBtn = screen.getByText(/guardar/i);
    await user.click(guardarBtn);

    // Verificar que se muestran errores de validación
    await waitFor(() => {
      expect(screen.getByText(/el cliente es requerido/i)).toBeInTheDocument();
      expect(screen.getByText(/el lote es requerido/i)).toBeInTheDocument();
      expect(screen.getByText(/el precio de venta es requerido/i)).toBeInTheDocument();
    });
  });

  test('Flujo de agregar y eliminar asesores', async () => {
    const user = userEvent.setup();

    renderWithProviders(<VentaForm />);

    // Esperar a que se cargue el formulario
    await waitFor(() => {
      expect(screen.getByText(/nueva venta/i)).toBeInTheDocument();
    });

    // Agregar primer asesor
    const agregarAsesorBtn = screen.getByText(/agregar asesor/i);
    await user.click(agregarAsesorBtn);

    // Verificar que aparece la sección de asesor
    expect(screen.getByText(/asesor 1/i)).toBeInTheDocument();

    // Agregar segundo asesor
    await user.click(agregarAsesorBtn);

    // Verificar que aparecen dos secciones de asesores
    const asesorSections = screen.getAllByText(/asesor/i);
    expect(asesorSections).toHaveLength(2);

    // Eliminar el primer asesor
    const eliminarBtns = screen.getAllByText(/eliminar/i);
    await user.click(eliminarBtns[0]);

    // Verificar que solo queda un asesor
    await waitFor(() => {
      const remainingAsesorSections = screen.getAllByText(/asesor/i);
      expect(remainingAsesorSections).toHaveLength(1);
    });
  });

  test('Flujo de cancelar venta', async () => {
    const user = userEvent.setup();

    renderWithProviders(<VentaForm />);

    // Esperar a que se cargue el formulario
    await waitFor(() => {
      expect(screen.getByText(/nueva venta/i)).toBeInTheDocument();
    });

    // Llenar algunos campos
    const clienteSelect = screen.getByLabelText(/cliente/i);
    await user.click(clienteSelect);
    await user.click(screen.getByText('Juan Pérez'));

    // Hacer clic en cancelar
    const cancelarBtn = screen.getByText(/cancelar/i);
    await user.click(cancelarBtn);

    // Verificar que el formulario se resetea o se cierra
    // (esto dependerá de la implementación específica del modal)
    await waitFor(() => {
      expect(screen.queryByText(/nueva venta/i)).not.toBeInTheDocument();
    });
  });
}); 