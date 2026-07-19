import { useMediaQuery } from './useMediaQuery';
import {
  MEDIA,
  SIDEBAR_BREAKPOINTS,
  type Breakpoint,
} from '../constants/breakpoints';

export function useBreakpoint(): Breakpoint {
  const isMobile = useMediaQuery(MEDIA.mobile);
  const isTablet = useMediaQuery(MEDIA.tablet);

  const isSidebarMobile = useMediaQuery(SIDEBAR_BREAKPOINTS.mobile);
  const isSidebarTablet = useMediaQuery(SIDEBAR_BREAKPOINTS.tablet);

  return {
    viewport: isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop',
    sidebar: isSidebarMobile
      ? 'mobile'
      : isSidebarTablet
        ? 'tablet'
        : 'desktop',
  };
}
