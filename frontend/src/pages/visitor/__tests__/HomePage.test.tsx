import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HomePage from '../HomePage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}{location.search}</output>;
}

describe('HomePage critical navigation', () => {
  it('opens the matching module when a core capability is clicked', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: '智能问答，点击进入' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/qa');
  });

  it('preserves the question when a hot question is selected', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <HomePage />
        <LocationProbe />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText(/灵山大佛有多高/));
    expect(screen.getByTestId('location')).toHaveTextContent('/qa?q=%E7%81%B5%E5%B1%B1%E5%A4%A7%E4%BD%9B%E6%9C%89%E5%A4%9A%E9%AB%98%EF%BC%9F');
  });
});
