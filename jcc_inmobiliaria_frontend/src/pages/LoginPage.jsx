    // src/pages/LoginPage.jsx
    import React, { useState } from 'react';
    // import { useNavigate, useLocation } from 'react-router-dom'; // No se usan directamente aquí si login() navega
    import { useAuth } from '../context/AuthContext';
    import styles from './LoginPage.module.css';

    function LoginPage() {
        const [username, setUsername] = useState('');
        const [password, setPassword] = useState('');
        const [errorMessage, setErrorMessage] = useState(''); // Cambiado a errorMessage para claridad
        
        const { login, loading: authActionLoading } = useAuth();
        // const navigate = useNavigate(); // No es necesario si login() en AuthContext navega
        // const location = useLocation();
        // const from = location.state?.from?.pathname || "/dashboard";

        console.log("Renderizando LoginPage.jsx (Formulario Real)");

        const handleSubmit = async (e) => {
            e.preventDefault();
            setErrorMessage(''); // Limpiar error anterior
            try {
                console.log("LoginPage: Intentando login con:", { username, password });
                await login(username, password);
                // La navegación al éxito la maneja la función login del AuthContext
            } catch (err) {
                console.error('LoginPage: Login fallido, error recibido:', err);
                // Mostrar el mensaje del error, o un mensaje genérico
                setErrorMessage(err.message || 'Error de login o credenciales incorrectas.');
            }
        };

        return (
            <div className={styles.loginPageContainer}>
                <div className={styles.loginFormContainer}>
                    <h2>Iniciar Sesión</h2>
                    <form onSubmit={handleSubmit}>
                        {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>} {/* MOSTRAR errorMessage */}
                        <div className={styles.formGroup}>
                            <label htmlFor="username">Usuario:</label>
                            <input
                                type="text"
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={authActionLoading}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="password">Contraseña:</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={authActionLoading}
                            />
                        </div>
                        <button type="submit" className={styles.loginButton} disabled={authActionLoading}>
                            {authActionLoading ? 'Ingresando...' : 'Ingresar'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    export default LoginPage;
    