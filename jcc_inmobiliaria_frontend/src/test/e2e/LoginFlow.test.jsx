import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/LoginPage';
import { AuthProvider } from '../../context/AuthContext';

// Mock del apiService
jest.mock('../../services/apiService', () => ({
  login: jest.fn(),
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

describe('Login Flow E2E', () => {
  beforeEach(() => {
    // Limpiar todos los mocks antes de cada test
    jest.clearAllMocks();
  });

  test('Flujo completo de login exitoso', async () => {
    const user = userEvent.setup();
    const mockLogin = require('../../services/apiService').login;
    const mockGetCsrfToken = require('../../services/apiService').getCsrfToken;

    // Mock de respuestas exitosas
    mockGetCsrfToken.mockResolvedValue({ data: { csrfToken: 'test-token' } });
    mockLogin.mockResolvedValue({ 
      data: { 
        user: { username: 'testuser', id: 1 },
        message: 'Login exitoso'
      } 
    });

    renderWithProviders(<LoginPage />);

    // Verificar que el formulario esté presente
    expect(screen.getByLabelText(/usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();

    // Llenar el formulario
    await user.type(screen.getByLabelText(/usuario/i), 'testuser');
    await user.type(screen.getByLabelText(/contraseña/i), 'testpass123');

    // Enviar el formulario
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    // Verificar que se llamó al API
    await waitFor(() => {
      expect(mockGetCsrfToken).toHaveBeenCalled();
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass123'
      });
    });
  });

  test('Flujo de login con credenciales incorrectas', async () => {
    const user = userEvent.setup();
    const mockLogin = require('../../services/apiService').login;
    const mockGetCsrfToken = require('../../services/apiService').getCsrfToken;

    // Mock de error de autenticación
    mockGetCsrfToken.mockResolvedValue({ data: { csrfToken: 'test-token' } });
    mockLogin.mockRejectedValue({ 
      response: { 
        data: { message: 'Credenciales incorrectas' },
        status: 401
      } 
    });

    renderWithProviders(<LoginPage />);

    // Llenar el formulario con credenciales incorrectas
    await user.type(screen.getByLabelText(/usuario/i), 'wronguser');
    await user.type(screen.getByLabelText(/contraseña/i), 'wrongpass');

    // Enviar el formulario
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    // Verificar que se muestra el error
    await waitFor(() => {
      expect(screen.getByText(/credenciales incorrectas/i)).toBeInTheDocument();
    });
  });

  test('Validación de campos requeridos', async () => {
    const user = userEvent.setup();

    renderWithProviders(<LoginPage />);

    // Intentar enviar sin llenar campos
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));

    // Verificar que se muestran errores de validación
    await waitFor(() => {
      expect(screen.getByText(/el usuario es requerido/i)).toBeInTheDocument();
      expect(screen.getByText(/la contraseña es requerida/i)).toBeInTheDocument();
    });
  });
}); 