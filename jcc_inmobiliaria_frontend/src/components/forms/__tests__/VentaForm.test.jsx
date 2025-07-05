import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../../services/apiService', () => ({}));
import VentaForm from '../VentaForm';

describe('VentaForm', () => {
  it('muestra el botón Guardar Venta', () => {
    render(<VentaForm show={true} onClose={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /guardar venta/i })).toBeInTheDocument();
  });
  it('muestra el botón Cancelar', () => {
    render(<VentaForm show={true} onClose={() => {}} onSubmit={() => {}} />);
    expect(screen.getByRole('button', { name: /cancelar/i })).toBeInTheDocument();
  });
}); 