/**
 * Test stub for lucide-react icon modules.
 *
 * lucide-react ships ESM-only `.js` files that Jest's CommonJS transform does
 * not parse. Icon visuals are not under test in this workspace's unit tests, so
 * every `lucide-react/dist/esm/icons/*` import is mapped to this stub that
 * renders a simple <svg> placeholder.
 */
import type { SVGProps } from 'react';

export default function LucideIconStub(props: SVGProps<SVGSVGElement>) {
  return <svg data-testid="lucide-icon-stub" {...props} />;
}
