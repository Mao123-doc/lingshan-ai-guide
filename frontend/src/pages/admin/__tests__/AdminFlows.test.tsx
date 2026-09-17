import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import AdminLoginPage from '../LoginPage';
import { adminAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  adminAPI: { login: vi.fn() },
}));

describe('admin critical states', () => {
  it('shows login failure without navigating away', async () => {
    vi.mocked(adminAPI.login).mockRejectedValue(new Error('账号或密码错误'));
    const errorMessage = vi.spyOn(message, 'error').mockImplementation(() => ({
      then: () => Promise.resolve(),
      promise: Promise.resolve(),
    }) as never);
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByPlaceholderText('用户名'), { target: { value: 'admin' } });
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /登.*录/ }));

    await waitFor(() => expect(errorMessage).toHaveBeenCalledWith('登录失败'));
    expect(adminAPI.login).toHaveBeenCalledWith('admin', 'wrong');
    errorMessage.mockRestore();
  });
});
