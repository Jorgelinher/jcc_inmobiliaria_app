import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthProvider, useAuth } from '../../context/AuthContext'
import { BrowserRouter } from 'react-router-dom'
import * as apiService from '../../services/apiService'

// Mock del servicio de API
vi.mock('../../services/apiService')

const TestComponent = () => {
  const { user, login, logout, isAuthenticated } = useAuth()
  
  return (
    <div>
      <div data-testid="user-info">
        {isAuthenticated ? `Usuario: ${user?.username}` : 'No autenticado'}
      </div>
      <button onClick={() => login({ username: 'test', password: 'test' })}>
        Login
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

const renderWithProviders = (component) => {
  return render(
    <BrowserRouter>
      <AuthProvider>
        {component}
      </AuthProvider>
    </BrowserRouter>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('proporciona estado inicial no autenticado', () => {
    renderWithProviders(<TestComponent />)
    
    expect(screen.getByTestId('user-info')).toHaveTextContent('No autenticado')
  })

  test('maneja login exitoso', async () => {
    const mockUser = { username: 'testuser', id: 1 }
    const mockResponse = { token: 'test-token', user: mockUser }
    
    apiService.login.mockResolvedValue(mockResponse)
    
    renderWithProviders(<TestComponent />)
    
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Usuario: testuser')
    })
    
    expect(apiService.login).toHaveBeenCalledWith({ username: 'test', password: 'test' })
    expect(localStorage.setItem).toHaveBeenCalledWith('token', 'test-token')
  })

  test('maneja errores de login', async () => {
    const mockError = new Error('Credenciales inválidas')
    apiService.login.mockRejectedValue(mockError)
    
    renderWithProviders(<TestComponent />)
    
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No autenticado')
    })
  })

  test('maneja logout correctamente', async () => {
    // Primero hacer login
    const mockUser = { username: 'testuser', id: 1 }
    const mockResponse = { token: 'test-token', user: mockUser }
    apiService.login.mockResolvedValue(mockResponse)
    
    renderWithProviders(<TestComponent />)
    
    const loginButton = screen.getByText('Login')
    fireEvent.click(loginButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('Usuario: testuser')
    })
    
    // Luego hacer logout
    apiService.logout.mockResolvedValue({})
    const logoutButton = screen.getByText('Logout')
    fireEvent.click(logoutButton)
    
    await waitFor(() => {
      expect(screen.getByTestId('user-info')).toHaveTextContent('No autenticado')
    })
    
    expect(apiService.logout).toHaveBeenCalled()
    expect(localStorage.removeItem).toHaveBeenCalledWith('token')
  })

  test('restaura sesión desde localStorage', () => {
    const mockUser = { username: 'saveduser', id: 1 }
    localStorage.getItem.mockReturnValue('saved-token')
    
    // Mock de la función que verifica el token
    apiService.verifyToken = vi.fn().mockResolvedValue({ user: mockUser })
    
    renderWithProviders(<TestComponent />)
    
    // El contexto debería restaurar la sesión automáticamente
    expect(localStorage.getItem).toHaveBeenCalledWith('token')
  })

  test('maneja token inválido en localStorage', () => {
    localStorage.getItem.mockReturnValue('invalid-token')
    
    // Mock de la función que verifica el token
    apiService.verifyToken = vi.fn().mockRejectedValue(new Error('Token inválido'))
    
    renderWithProviders(<TestComponent />)
    
    expect(screen.getByTestId('user-info')).toHaveTextContent('No autenticado')
  })
})

// Tests para ProtectedRoute
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'

describe('ProtectedRoute', () => {
  test('renderiza contenido cuando está autenticado', () => {
    const mockUser = { username: 'testuser', id: 1 }
    localStorage.getItem.mockReturnValue('valid-token')
    
    renderWithProviders(
      <ProtectedRoute>
        <div>Contenido protegido</div>
      </ProtectedRoute>
    )
    
    expect(screen.getByText('Contenido protegido')).toBeInTheDocument()
  })

  test('redirige a login cuando no está autenticado', () => {
    localStorage.getItem.mockReturnValue(null)
    
    renderWithProviders(
      <ProtectedRoute>
        <div>Contenido protegido</div>
      </ProtectedRoute>
    )
    
    expect(screen.queryByText('Contenido protegido')).not.toBeInTheDocument()
  })
}) 