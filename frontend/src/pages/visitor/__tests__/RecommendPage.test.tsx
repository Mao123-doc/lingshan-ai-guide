import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecommendPage from '../RecommendPage';
import { visitorAPI } from '../../../services/api';

vi.mock('../../../services/api', () => ({
  visitorAPI: {
    recommend: vi.fn(),
    planRoute: vi.fn(),
  },
}));

describe('RecommendPage critical states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('还需要一点信息')).toBeInTheDocument());
    expect(screen.getByText(/请告诉我现在几点/)).toBeInTheDocument();
  });

  it('shows visitor language instead of route engine details', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible_with_rejected_preferences',
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
          rejectedRequests: [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_outside_time_budget' }],
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ name: '灵山大佛', confidence: 'high' }],
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    expect(screen.getByText(/按你的情况规划路线/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('已为你安排替代方案')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/灵山大佛/)).toBeInTheDocument());
    expect(screen.getByText('有一项安排暂时无法加入路线')).toBeInTheDocument();
    expect(screen.getByText(/在剩余时间内赶不上这场演出/)).toBeInTheDocument();
    expect(screen.queryByText('LS-011')).not.toBeInTheDocument();
    expect(screen.queryByText(/证据来源/)).not.toBeInTheDocument();
  });

  it('explains arrival, waiting, and the exact performance time', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        route: {
          steps: [{
            spotId: 'LS-013',
            start: '14:00',
            end: '14:20',
            arrive: '13:02',
            walkMinutes: 25,
            visitMinutes: 20,
            waitingMinutes: 58,
            performanceId: 'performance_lingshan_jixiangsong',
            performanceName: '《灵山吉祥颂》',
            performanceStartTime: '14:00',
          }],
          totalMinutes: 173,
          walkingMinutes: 45,
          visitingMinutes: 70,
          waitingMinutes: 58,
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ name: '灵山梵宫', confidence: 'verified' }],
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText(/观看《灵山吉祥颂》/)).toBeInTheDocument());
    expect(screen.getByText(/13:02 到达灵山梵宫/)).toBeInTheDocument();
    expect(screen.getByText('等待 58 分钟')).toBeInTheDocument();
    expect(screen.getByText(/13:02 到达灵山梵宫，步行 25 分钟，等待 58 分钟后观看/)).toBeInTheDocument();
  });

  it('resubmits the original route request after the user supplies missing time', async () => {
    vi.mocked(visitorAPI.planRoute)
      .mockResolvedValueOnce({
        data: {
          outcome: 'needs_clarification',
          route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
          scene_state: { missingCriticalFields: ['currentTime'] },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          outcome: 'feasible',
          feasibility: true,
          route: { steps: [{ spotId: 'LS-011' }], totalMinutes: 120, walkingMinutes: 20, visitingMinutes: 100 },
          scene_state: { missingCriticalFields: [] },
        },
      } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    const supplement = await screen.findByPlaceholderText(/现在上午10点/);
    fireEvent.change(supplement, { target: { value: '现在上午10点' } });
    fireEvent.click(screen.getByRole('button', { name: '补充并重新规划' }));

    await waitFor(() => expect(visitorAPI.planRoute).toHaveBeenLastCalledWith(
      expect.stringContaining('现在上午10点'),
    ));
  });

  it('renders a natural question instead of raw field names when current time is missing', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'needs_clarification',
        route: { steps: [], totalMinutes: 0, walkingMinutes: 0, visitingMinutes: 0 },
        scene_state: { missingCriticalFields: ['currentTime'] },
        scene_extraction: {
          source: 'rules',
          confidence: {},
          missingFields: ['currentTime'],
          conflicts: [],
          trace: { configured: true, executed: true, status: 'success', fallbackUsed: false },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('还需要一点信息')).toBeInTheDocument());
    expect(screen.getByText(/还需要知道您现在大约几点开始游览/)).toBeInTheDocument();
    expect(screen.queryByText('currentTime')).not.toBeInTheDocument();
    expect(screen.queryByText(/missingCriticalFields/i)).not.toBeInTheDocument();
  });

  it('renders visitor language and conceals internal trace terms when fallback is used', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible',
        feasibility: true,
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ name: '灵山大佛', confidence: 'high' }],
        scene_extraction: {
          source: 'fallback',
          confidence: {},
          missingFields: [],
          conflicts: [],
          trace: {
            configured: true,
            executed: true,
            status: 'fallback',
            fallbackUsed: true,
            reason: 'llm_unavailable',
            model: 'qwen-plus-internal',
            latencyMs: 120,
          },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('我先按您提供的信息安排路线。')).toBeInTheDocument());
    expect(screen.getByText(/灵山大佛/)).toBeInTheDocument();
    expect(screen.queryByText(/fallback/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/configured/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/executed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/llm_unavailable/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/qwen-plus-internal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trace/i)).not.toBeInTheDocument();
  });

  it('preserves route rejection explanation when a preferred performance cannot be scheduled', async () => {
    vi.mocked(visitorAPI.planRoute).mockResolvedValue({
      data: {
        outcome: 'feasible_with_rejected_preferences',
        route: {
          steps: [{ spotId: 'LS-011', start: '10:00', end: '11:00', arrive: '10:10', walkMinutes: 10, visitMinutes: 50 }],
          totalMinutes: 60,
          walkingMinutes: 10,
          visitingMinutes: 50,
          rejectedRequests: [{ item: 'performance_lingshan_jixiangsong', reasonCode: 'performance_outside_time_budget' }],
        },
        scene_state: { missingCriticalFields: [] },
        evidence: [{ name: '灵山大佛', confidence: 'high' }],
        scene_extraction: {
          source: 'llm',
          confidence: { partyType: 0.95 },
          missingFields: [],
          conflicts: [],
          trace: { configured: true, executed: true, status: 'success', fallbackUsed: false },
        },
      },
    } as never);

    render(<MemoryRouter><RecommendPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: '帮我规划路线' }));

    await waitFor(() => expect(screen.getByText('已为你安排替代方案')).toBeInTheDocument());
    expect(screen.getByText('有一项安排暂时无法加入路线')).toBeInTheDocument();
    expect(screen.getByText(/在剩余时间内赶不上这场演出/)).toBeInTheDocument();
    expect(screen.getByText(/你想看的演出/)).toBeInTheDocument();
  });
});
