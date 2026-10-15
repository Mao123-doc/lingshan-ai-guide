import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import DashboardPage from '../DashboardPage';
import { adminAPI } from '../../../services/api';

vi.mock('echarts-for-react', () => ({ default: () => <div /> }));
vi.mock('../../../services/admin-live', () => ({ subscribeOperations: () => () => {} }));
vi.mock('../../../services/api', () => ({ adminAPI: { getDashboard: vi.fn() } }));
it('shows a recoverable error rather than permanent loading after a failed snapshot', async () => {
  vi.mocked(adminAPI.getDashboard).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({data:{today_queries:3}} as never);
  render(<MemoryRouter><DashboardPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: '重试加载' }));
  expect(await screen.findByText('今日问答')).toBeInTheDocument();
  expect(adminAPI.getDashboard).toHaveBeenCalledTimes(2);
});
