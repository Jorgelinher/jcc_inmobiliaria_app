// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import styles from './HomePage.module.css';

function HomePage() {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentBox}>
        <h1 className={styles.title}>
          Bienvenido al Sistema Inmobiliario JCC
        </h1>
        <p className={styles.subtitle}>
          Gestione sus lotes, clientes, ventas y comisiones de forma eficiente y profesional.
        </p>
        <div className={styles.buttonContainer}>
          <Link to="/dashboard" className={styles.buttonPurple}>
            Ir al Dashboard
          </Link>
          <Link to="/lotes" className={styles.buttonBlue}>
            Ver Lotes
          </Link>
        </div>
      </div>
    </div>
  );
}
export default HomePage;