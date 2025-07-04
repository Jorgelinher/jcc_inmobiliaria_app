import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import VentaForm from '../../components/forms/VentaForm'
import { AuthProvider } from '../../context/AuthContext'

// Mock de los servicios
vi.mock('../../services/apiService', () => ({
  getLotes: vi.fn(),
  getClientes: vi.fn(),
  getAsesores: vi.fn(),
  createVenta: vi.fn(),
  updateVenta: vi.fn(),
}))

const mockLotes = [
  {
    id_lote: 'L0001',
    ubicacion_proyecto: 'Proyecto Test',
    manzana: 'A',
    numero_lote: '1',
    estado_lote: 'Disponible',
    precio_lista_soles: '50000.00'
  }
]

const mockClientes = [
  {
    id_cliente: 'CLI0001',
    nombres_completos_razon_social: 'Cliente Test',
    numero_documento: '12345678'
  }
]

const mockAsesores = [
  {
    id_asesor: 'A0001',
    nombre_asesor: 'Asesor Test',
    tipo_asesor_actual: 'Junior'
  }
]

const renderWithAuth = (component) => {
  return render(
    <AuthProvider>
      {component}
    </AuthProvider>
  )
}

describe('VentaForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renderiza el formulario correctamente', async () => {
    const mockOnSubmit = vi.fn()
    
    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    expect(screen.getByText('Nueva Venta')).toBeInTheDocument()
    expect(screen.getByLabelText(/Cliente/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Lote/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Valor del Lote/)).toBeInTheDocument()
  })

  test('muestra errores de validación de campos específicos', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue({
      response: {
        data: {
          cliente: ['Debe seleccionar un cliente válido'],
          valor_lote_venta: ['El valor debe ser mayor a 0'],
          lote: ['El lote ya está vendido']
        }
      }
    })

    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    // Simular envío del formulario
    const submitButton = screen.getByText('Guardar Venta')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Debe seleccionar un cliente válido')).toBeInTheDocument()
      expect(screen.getByText('El valor debe ser mayor a 0')).toBeInTheDocument()
      expect(screen.getByText('El lote ya está vendido')).toBeInTheDocument()
    })
  })

  test('maneja errores generales del backend', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue({
      response: {
        data: 'Error interno del servidor'
      }
    })

    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    const submitButton = screen.getByText('Guardar Venta')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Error interno del servidor')).toBeInTheDocument()
    })
  })

  test('permite agregar y eliminar asesores involucrados', async () => {
    const mockOnSubmit = vi.fn()
    
    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    // Buscar botón de agregar asesor
    const addButton = screen.getByText('+ Agregar Asesor')
    expect(addButton).toBeInTheDocument()

    // Agregar asesor
    fireEvent.click(addButton)
    
    // Verificar que se agregó una nueva sección de asesor
    await waitFor(() => {
      expect(screen.getAllByText(/Asesor Involucrado/)).toHaveLength(2) // El original + 1 nuevo
    })

    // Eliminar asesor agregado
    const removeButtons = screen.getAllByText('Eliminar')
    fireEvent.click(removeButtons[1]) // El segundo botón eliminar

    await waitFor(() => {
      expect(screen.getAllByText(/Asesor Involucrado/)).toHaveLength(1) // Solo el original
    })
  })

  test('calcula automáticamente el valor en soles', async () => {
    const mockOnSubmit = vi.fn()
    
    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    // Llenar precio en dólares
    const precioDolaresInput = screen.getByLabelText(/Precio en Dólares/)
    fireEvent.change(precioDolaresInput, { target: { value: '10000' } })

    // Llenar tipo de cambio
    const tipoCambioInput = screen.getByLabelText(/Tipo de Cambio/)
    fireEvent.change(tipoCambioInput, { target: { value: '3.8' } })

    // Verificar que se calcula automáticamente
    const valorLoteInput = screen.getByLabelText(/Valor del Lote/)
    expect(valorLoteInput.value).toBe('38000.00')
  })

  test('valida campos requeridos antes de enviar', async () => {
    const mockOnSubmit = vi.fn()
    
    renderWithAuth(
      <VentaForm 
        show={true}
        onClose={vi.fn()}
        onSubmit={mockOnSubmit}
        initialData={null}
      />
    )

    // Intentar enviar sin llenar campos requeridos
    const submitButton = screen.getByText('Guardar Venta')
    fireEvent.click(submitButton)

    // Verificar que no se llama onSubmit
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })
}) 