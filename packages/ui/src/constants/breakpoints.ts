export type Breakpoint = {
  viewport: 'mobile' | 'tablet' | 'desktop';
  sidebar: 'mobile' | 'tablet' | 'desktop';
};

export const MEDIA = {
  mobile: '(max-width: 599.98px)',
  tablet: '(min-width: 600px) and (max-width: 1279.98px)',
  desktop: '(min-width: 1280px)',
} as const;

export const SIDEBAR_BREAKPOINTS = {
  mobile: '(max-width: 999.98px)',
  tablet: '(min-width: 1000px) and (max-width: 1279.98px)',
  desktop: '(min-width: 1280px)',
} as const;
