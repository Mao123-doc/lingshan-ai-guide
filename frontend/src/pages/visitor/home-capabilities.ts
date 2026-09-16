const CAPABILITY_ROUTES: Record<string, string> = {
  智能问答: '/qa',
  多模态交互: '/qa',
  个性化推荐: '/recommend',
  情感互动: '/qa',
};

export function getCapabilityRoute(title: string): string {
  return CAPABILITY_ROUTES[title] ?? '/qa';
}
