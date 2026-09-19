import React from 'react';

import { HelpScreen } from './help-screen.ios';

jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  DisclosureGroup: 'DisclosureGroup',
  Form: 'Form',
  Host: 'Host',
  HStack: 'HStack',
  Section: 'Section',
  Text: 'Text',
  VStack: 'VStack',
}));
jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  accessibilityLabel: (value: unknown) => ({ accessibilityLabel: value }),
  buttonStyle: (value: unknown) => ({ buttonStyle: value }),
  disabled: (value: unknown) => ({ disabled: value }),
  font: (value: unknown) => ({ font: value }),
  foregroundStyle: (value: unknown) => ({ foregroundStyle: value }),
  frame: (value: unknown) => ({ frame: value }),
  padding: (value: unknown) => ({ padding: value }),
  textSelection: (value: unknown) => ({ textSelection: value }),
}));
jest.mock('@/components/expo-ui-components', () => ({ ValidationMessage: 'ValidationMessage' }));
jest.mock('@/config/app-config', () => ({ supportContact: 'help@example.com' }));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({ error: 'red', primary: 'purple' }),
}));

type TestNode = { props: { children?: unknown; isExpanded?: boolean; label?: string; onIsExpandedChange?: (isExpanded: boolean) => void; title?: string } };
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

it('starts with task guidance collapsed and expands it before Contact Support', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<HelpScreen />); });

  const disclosures = tree.root.findAllByType('DisclosureGroup');
  expect(disclosures.map((section) => section.props.label)).toEqual([
    'Getting Started',
    'Recording IN and OUT Time',
    'Changing Trays',
    'Correcting a Time',
    'Notifications',
    'Retainer Mode',
  ]);
  expect(disclosures.every((section) => section.props.isExpanded === false)).toBe(true);
  expect(tree.root.findAllByType('Section').at(-1)?.props.title).toBe('Contact Support');

  for (const disclosure of disclosures) {
    await renderer.act(async () => disclosure.props.onIsExpandedChange?.(true));
  }

  const copy = tree.root.findAllByType('Text').map((node) => node.props.children).join(' ');
  expect(copy).toContain('saved on this device');
  expect(copy).toContain('Edit In/Out Times');
  expect(copy).toContain('notification permission');
  expect(copy).toContain("clinician's instructions");
  expect(copy).not.toMatch(/Premium Support|purchase/i);

  await renderer.act(async () => tree.unmount());
});
