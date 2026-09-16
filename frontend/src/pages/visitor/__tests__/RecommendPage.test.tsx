import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import RecommendPage from '../RecommendPage';
import { visitorAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  visitorAPI: {
    recommend: vi.fn(),
    planRoute: vi.fn(),
  },
}));

describe('RecommendPage critical states', () => {
  it('shows an explicit route outcome returned by the scene planner', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'needs_clarification',
        route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
        scene_state: { missingCriticalFields: ['current_time'] },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    const input = screen.getByPlaceholderText(/我带腿脚不方便的妈妈/);
    fireEvent.change(input, { target: { value: '我在景区入口，还剩三小时' } });
    fireEvent.click(screen.getByRole('button', { name: '生成可执行路线' }));

    await waitFor(() => expect(screen.getByText('需要补充信息')).toBeInTheDocument());
    expect(screen.getByText(/需要补充：current_time/)).toBeInTheDocument();
  });
});
