// src/components/layout/Navbar.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext'; 
import styles from './Navbar.module.css'; 

function Navbar() {
    const { isAuthenticated, logout, user } = useAuth();

    const getLinkClassName = ({ isActive }) => {
        return isActive ? `${styles.link} ${styles.activeLink}` : styles.link;
    };

    return (
        <nav className={styles.navbar}>
            <NavLink to={isAuthenticated ? "/dashboard" : "/"} className={styles.brandLink}>
                JCC App
            </NavLink>
            <div className={styles.navLinks}>
                {isAuthenticated && (
                    <>
                        <NavLink to="/dashboard" className={getLinkClassName}>Dashboard</NavLink>
                        <NavLink to="/lotes" className={getLinkClassName}>Lotes</NavLink>
                        <NavLink to="/presencias" className={getLinkClassName}>Presencias</NavLink>
                        <NavLink to="/asesores" className={getLinkClassName}>Asesores</NavLink>
                        <NavLink to="/ventas" className={getLinkClassName}>Ventas</NavLink>
                        <NavLink to="/actividades" className={getLinkClassName}>Actividades</NavLink>
                        <NavLink to="/comisiones" className={getLinkClassName}>Comisiones</NavLink>
                        <NavLink to="/cierres-comisiones" className={getLinkClassName}>Cierre de Comisiones</NavLink>
                        <NavLink to="/cobranzas" className={getLinkClassName}>Cobranzas</NavLink>
                    </>
                )}
            </div>
            <div className={styles.authControls}>
                {isAuthenticated ? (
                    <>
                        <span className={styles.saludo} title={user?.username || 'Usuario'}>Hola, {user?.username || 'Usuario'}</span>
                        <button 
                            onClick={logout} 
                            // Añadir clase 'explicitButton' si quieres que parezca más un botón que un enlace
                            className={`${styles.logoutButton} ${styles.explicitButton}`} 
                        >
                            Logout
                        </button>
                    </>
                ) : (
                    <NavLink to="/login" className={getLinkClassName}>Login</NavLink>
                )}
            </div>
        </nav>
    );
}
export default Navbar;