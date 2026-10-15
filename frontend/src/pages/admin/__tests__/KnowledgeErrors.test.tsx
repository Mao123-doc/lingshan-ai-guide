import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { message } from 'antd';
import KnowledgeBasePage from '../KnowledgeBasePage';
import { adminAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({ adminAPI: { getDocuments: vi.fn(), deleteDocument: vi.fn() } }));
describe('knowledge request errors', () => {
  it('does not report deletion success when the backend rejects it', async () => {
    vi.mocked(adminAPI.getDocuments).mockResolvedValue({ data: [{ id: 'a', name: 'guide.txt', size: 2, status: 'indexed' }] } as never);
    vi.mocked(adminAPI.deleteDocument).mockRejectedValue(new Error('HTTP 403'));
    const success = vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
    const error = vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    render(<MemoryRouter><KnowledgeBasePage /></MemoryRouter>);
    await screen.findByText('guide.txt');
    fireEvent.click(screen.getByRole('button', { name: /delete/ }));
    fireEvent.click(await screen.findByRole('button', { name: /确.*定|OK/ }));
    await waitFor(() => expect(error).toHaveBeenCalledWith('删除失败'));
    expect(success).not.toHaveBeenCalled();
    success.mockRestore(); error.mockRestore();
  });
});
