# Tests End-to-End (E2E)

Este directorio contiene tests E2E que simulan flujos completos de la aplicación, probando la interacción real del usuario con la interfaz.

## 📋 Tests Disponibles

### 1. LoginFlow.test.jsx
Simula el flujo completo de autenticación:
- ✅ Login exitoso con credenciales válidas
- ❌ Login fallido con credenciales incorrectas
- ⚠️ Validación de campos requeridos

### 2. VentaFlow.test.jsx
Simula el flujo completo de creación de ventas:
- ✅ Crear venta exitosa con todos los campos
- ⚠️ Validaciones de campos requeridos
- 🔄 Agregar y eliminar asesores dinámicamente
- ❌ Cancelar venta

### 3. DashboardFlow.test.jsx
Simula el flujo completo del dashboard:
- ✅ Carga de métricas y datos
- 🔗 Navegación entre secciones
- 🔍 Filtrado de ventas recientes
- 📊 Visualización de métricas
- ❌ Manejo de errores
- 🔄 Actualización de datos

## 🚀 Ejecutar Tests E2E

### Ejecutar todos los tests E2E:
```bash
npm run test:e2e
```

### Ejecutar tests E2E con Jest directamente:
```bash
npm run test:e2e:jest
```

### Ejecutar un test específico:
```bash
npx jest src/test/e2e/LoginFlow.test.jsx --config jest.e2e.config.js
```

### Ejecutar todos los tests (unitarios + E2E):
```bash
npm run test:all
```

## 🧪 Configuración

Los tests E2E usan:
- **Jest** como framework de testing
- **React Testing Library** para renderizado y queries
- **@testing-library/user-event** para simular interacciones de usuario
- **jsdom** como entorno de testing

### Configuración específica:
- `jest.e2e.config.js` - Configuración específica para tests E2E
- `src/test/setup.js` - Setup global para todos los tests
- Mocks automáticos para CSS modules y archivos estáticos

## 📝 Escribir Nuevos Tests E2E

### Estructura recomendada:
```jsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../context/AuthContext';

// Mock del apiService
jest.mock('../../services/apiService', () => ({
  // Mocks específicos del test
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

describe('Nombre del Flujo E2E', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Setup de mocks
  });

  test('Descripción del flujo', async () => {
    const user = userEvent.setup();
    
    // 1. Renderizar componente
    renderWithProviders(<MiComponente />);
    
    // 2. Verificar estado inicial
    expect(screen.getByText(/texto inicial/i)).toBeInTheDocument();
    
    // 3. Simular interacciones del usuario
    await user.click(screen.getByText(/botón/i));
    
    // 4. Verificar cambios esperados
    await waitFor(() => {
      expect(screen.getByText(/texto esperado/i)).toBeInTheDocument();
    });
  });
});
```

### Mejores Prácticas:

1. **Usar `userEvent.setup()`** para simular interacciones reales
2. **Usar `waitFor()`** para esperar cambios asíncronos
3. **Mockear APIs** para controlar respuestas
4. **Probar flujos completos** desde inicio hasta fin
5. **Verificar estados de UI** en cada paso
6. **Usar queries accesibles** (getByRole, getByLabelText, etc.)

## 🔍 Debugging

### Ver tests en modo watch:
```bash
npx jest src/test/e2e/ --config jest.e2e.config.js --watch
```

### Ver output detallado:
```bash
npx jest src/test/e2e/ --config jest.e2e.config.js --verbose
```

### Debug con console.log:
Los tests E2E pueden usar `console.log()` para debugging. El output aparecerá en la consola.

## 📊 Cobertura

Los tests E2E generan reportes de cobertura en `coverage/e2e/`:
- **HTML**: `coverage/e2e/index.html`
- **LCOV**: `coverage/e2e/lcov.info`
- **Texto**: En la consola

## ⚠️ Consideraciones

1. **Tests lentos**: Los tests E2E son más lentos que los unitarios
2. **Dependencias**: Requieren que todos los componentes y servicios estén disponibles
3. **Mocks**: Es importante mockear correctamente las APIs externas
4. **Estado**: Los tests deben ser independientes y no afectarse entre sí 