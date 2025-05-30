// src/components/layout/Layout.jsx
import React from 'react';
import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';
import styles from './Layout.module.css'; // Asegúrate que este archivo exista y tenga estilos para .layoutContainer y .mainContent

function Layout() {
    console.log("Renderizando Layout.jsx (Final)");
    return (
        <div className={styles.layoutContainer}>
            <Navbar />
            <main className={styles.mainContent}>
                <Outlet />
            </main>
        </div>
    );
}
export default Layout;