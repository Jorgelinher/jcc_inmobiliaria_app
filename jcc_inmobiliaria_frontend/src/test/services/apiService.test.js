import { vi, describe, test, expect, beforeEach } from 'vitest'
import axios from 'axios'
import * as apiService from '../../services/apiService'

// Mock de axios
vi.mock('axios')
const mockedAxios = vi.mocked(axios)

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock de localStorage
    localStorage.getItem.mockReturnValue('test-token')
    // Mock de getCookie
    document.cookie = 'csrftoken=test-csrf-token'
  })

  describe('configuración de axios', () => {
    test('configura el interceptor de request correctamente', () => {
      expect(mockedAxios.interceptors.request.use).toHaveBeenCalled()
    })

    test('configura el interceptor de response correctamente', () => {
      expect(mockedAxios.interceptors.response.use).toHaveBeenCalled()
    })
  })

  describe('getClientes', () => {
    test('hace GET request a /api/gestion/clientes/', async () => {
      const mockResponse = { data: [{ id: 1, nombre: 'Cliente Test' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getClientes()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/clientes/')
      expect(result).toEqual(mockResponse.data)
    })

    test('maneja errores correctamente', async () => {
      const mockError = new Error('Network error')
      mockedAxios.get.mockRejectedValue(mockError)

      await expect(apiService.getClientes()).rejects.toThrow('Network error')
    })
  })

  describe('createCliente', () => {
    test('hace POST request con datos correctos', async () => {
      const mockData = {
        nombres_completos_razon_social: 'Nuevo Cliente',
        numero_documento: '12345678'
      }
      const mockResponse = { data: { id: 1, ...mockData } }
      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await apiService.createCliente(mockData)

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/gestion/clientes/', mockData)
      expect(result).toEqual(mockResponse.data)
    })

    test('maneja errores de validación del backend', async () => {
      const mockError = {
        response: {
          data: {
            numero_documento: ['Ya existe un cliente con ese número']
          }
        }
      }
      mockedAxios.post.mockRejectedValue(mockError)

      await expect(apiService.createCliente({})).rejects.toEqual(mockError)
    })
  })

  describe('getLotes', () => {
    test('hace GET request a /api/gestion/lotes/', async () => {
      const mockResponse = { data: [{ id_lote: 'L0001', estado: 'Disponible' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getLotes()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/lotes/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('getAsesores', () => {
    test('hace GET request a /api/gestion/asesores/', async () => {
      const mockResponse = { data: [{ id_asesor: 'A0001', nombre: 'Asesor Test' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getAsesores()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/asesores/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('createVenta', () => {
    test('hace POST request con datos de venta', async () => {
      const mockData = {
        id_venta: 'V0001',
        cliente: 'CLI0001',
        lote: 'L0001',
        valor_lote_venta: '50000.00'
      }
      const mockResponse = { data: { id: 1, ...mockData } }
      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await apiService.createVenta(mockData)

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/gestion/ventas/', mockData)
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('updateVenta', () => {
    test('hace PUT request con ID y datos actualizados', async () => {
      const mockData = { valor_lote_venta: '55000.00' }
      const mockResponse = { data: { id: 1, ...mockData } }
      mockedAxios.put.mockResolvedValue(mockResponse)

      const result = await apiService.updateVenta(1, mockData)

      expect(mockedAxios.put).toHaveBeenCalledWith('/api/gestion/ventas/1/', mockData)
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('deleteVenta', () => {
    test('hace DELETE request con ID correcto', async () => {
      mockedAxios.delete.mockResolvedValue({ status: 204 })

      await apiService.deleteVenta(1)

      expect(mockedAxios.delete).toHaveBeenCalledWith('/api/gestion/ventas/1/')
    })
  })

  describe('getPresencias', () => {
    test('hace GET request a /api/gestion/presencias/', async () => {
      const mockResponse = { data: [{ id_presencia: 'P0001' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getPresencias()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/presencias/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('createPresencia', () => {
    test('hace POST request con datos de presencia', async () => {
      const mockData = {
        id_presencia: 'P0001',
        cliente: 'CLI0001',
        fecha_hora_presencia: '2024-01-01T10:00:00Z'
      }
      const mockResponse = { data: { id: 1, ...mockData } }
      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await apiService.createPresencia(mockData)

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/gestion/presencias/', mockData)
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('getCobranzas', () => {
    test('hace GET request a /api/gestion/cobranzas/', async () => {
      const mockResponse = { data: [{ id_gestion: 'G0001' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getCobranzas()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/cobranzas/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('getComisiones', () => {
    test('hace GET request a /api/gestion/comisiones/', async () => {
      const mockResponse = { data: [{ id_comision: 'C0001' }] }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getComisiones()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/comisiones/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('getDashboardData', () => {
    test('hace GET request a /api/gestion/dashboard/', async () => {
      const mockResponse = { data: { ventas: 10, clientes: 50 } }
      mockedAxios.get.mockResolvedValue(mockResponse)

      const result = await apiService.getDashboardData()

      expect(mockedAxios.get).toHaveBeenCalledWith('/api/gestion/dashboard/')
      expect(result).toEqual(mockResponse.data)
    })
  })

  describe('login', () => {
    test('hace POST request con credenciales', async () => {
      const credentials = { username: 'testuser', password: 'testpass' }
      const mockResponse = { data: { token: 'test-token' } }
      mockedAxios.post.mockResolvedValue(mockResponse)

      const result = await apiService.login(credentials)

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/login/', credentials)
      expect(result).toEqual(mockResponse.data)
    })

    test('maneja errores de autenticación', async () => {
      const credentials = { username: 'wrong', password: 'wrong' }
      const mockError = {
        response: {
          data: 'Credenciales inválidas'
        }
      }
      mockedAxios.post.mockRejectedValue(mockError)

      await expect(apiService.login(credentials)).rejects.toEqual(mockError)
    })
  })

  describe('logout', () => {
    test('hace POST request a logout', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 })

      await apiService.logout()

      expect(mockedAxios.post).toHaveBeenCalledWith('/api/auth/logout/')
    })
  })
}) 