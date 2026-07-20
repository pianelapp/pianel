/**
 * responsive-breakpoints Task 4 — MobileMenuSettingsItem.
 *
 * Requirements 4.3, 4.4:
 *  - renders the Settings icon and the literal "Settings" label
 *  - activating the row invokes onOpenSettings exactly once (the App wave wires
 *    this to open the Settings dialog and close the drawer)
 */
import * as React from 'react';
import {render, click} from '../utils/render';
import {MobileMenuSettingsItem} from '../../src/components/MobileMenuSettingsItem';

describe('MobileMenuSettingsItem', () => {
  it('renders the Settings label and an icon', () => {
    const {container, unmount} = render(
      <MobileMenuSettingsItem isLightMode onOpenSettings={() => {}} />,
    );
    expect(container.textContent).toContain('Settings');
    expect(container.querySelector('svg')).not.toBeNull();
    unmount();
  });

  it('calls onOpenSettings exactly once when the row is clicked', () => {
    const onOpenSettings = jest.fn();
    const {container, unmount} = render(
      <MobileMenuSettingsItem isLightMode onOpenSettings={onOpenSettings} />,
    );
    click(container.querySelector('button') as Element);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    unmount();
  });
});
