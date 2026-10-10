import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import HomePage from '../HomePage';
function LocationProbe() { const location = useLocation(); return <output data-testid="location">{location.pathname}{location.search}</output>; }
function renderHome() { render(<MemoryRouter><HomePage /><LocationProbe /></MemoryRouter>); }
describe('core homepage navigation', () => {
  it.each([['开始提问', '/qa'], ['规划路线', '/recommend'], ['知识库管理', '/admin/knowledge']])('opens %s', (name, path) => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name }));
    expect(screen.getByTestId('location')).toHaveTextContent(path);
  });
  it('preserves the selected question', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '灵山大佛有多高？' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/qa?q=' + encodeURIComponent('灵山大佛有多高？'));
  });
});
