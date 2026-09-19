import React from 'react';

import type { SupportPurchaseService } from './support-purchase-service';
import { SupportScreen } from './support-screen.ios';

jest.mock('@/features/support/support-purchase-service-config', () => ({
  defaultSupportPurchaseService: {
    loadProducts: jest.fn(async () => []),
    purchase: jest.fn(),
  },
}));
jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  Form: 'Form',
  Host: 'Host',
  HStack: 'HStack',
  ProgressView: 'ProgressView',
  Section: 'Section',
  Spacer: 'Spacer',
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
}));
jest.mock('@/components/app-loading-screen', () => ({ AppLoadingScreen: 'AppLoadingScreen' }));
jest.mock('@/components/expo-ui-components', () => ({
  ActionButton: 'ActionButton',
  ValidationMessage: 'ValidationMessage',
}));
jest.mock('@/theme/use-app-theme', () => ({
  useAppTheme: () => ({ primary: 'purple' }),
}));

const products = [
  { displayPrice: 'US$1.99', id: 'small_tip', title: 'Small Tip' },
  { displayPrice: 'US$4.99', id: 'supporter_tip', title: 'Supporter Tip' },
  { displayPrice: 'US$9.99', id: 'big_tip', title: 'Big Tip' },
];

type TestNode = {
  props: {
    children?: React.ReactNode;
    label?: string;
    message?: string;
    onPress?: () => void;
  };
};
const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: { findAllByType: (type: string) => TestNode[] };
    unmount: () => void;
  };
};

function service(
  purchase: SupportPurchaseService['purchase'] = async () => ({ status: 'purchased' }),
  loadProducts: SupportPurchaseService['loadProducts'] = async () => products,
): SupportPurchaseService {
  return { loadProducts, purchase };
}

it('loads localized products and shows the thank-you state after purchase', async () => {
  const purchase = jest.fn(async () => ({ status: 'purchased' as const }));
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<SupportScreen purchaseService={service(purchase)} />); });

  const buttons = tree.root.findAllByType('Button');
  expect(buttons).toHaveLength(3);
  await renderer.act(async () => { buttons[0].props.onPress?.(); });

  expect(purchase).toHaveBeenCalledWith('small_tip');
  expect(tree.root.findAllByType('Text').some(
    (node) => node.props.children === 'Thank you for supporting Aligner Tracker.',
  )).toBe(true);
  expect(tree.root.findAllByType('ActionButton').some(
    (node) => node.props.label === 'Support again',
  )).toBe(true);

  await renderer.act(async () => tree.unmount());
});

it('returns to the products after cancellation without showing an error', async () => {
  const purchase = jest.fn(async () => ({ status: 'cancelled' as const }));
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => { tree = renderer.create(<SupportScreen purchaseService={service(purchase)} />); });
  await renderer.act(async () => { tree.root.findAllByType('Button')[0].props.onPress?.(); });

  expect(tree.root.findAllByType('Text').some(
    (node) => node.props.children === 'Purchase cancelled. You were not charged.',
  )).toBe(true);
  expect(tree.root.findAllByType('ValidationMessage')).toHaveLength(0);
  expect(tree.root.findAllByType('Button')).toHaveLength(3);

  await renderer.act(async () => tree.unmount());
});

it('shows retryable purchase and catalog failures', async () => {
  let tree!: ReturnType<typeof renderer.create>;
  await renderer.act(async () => {
    tree = renderer.create(<SupportScreen purchaseService={service(async () => { throw new Error('failed'); })} />);
  });
  await renderer.act(async () => { tree.root.findAllByType('Button')[0].props.onPress?.(); });
  expect(tree.root.findAllByType('ValidationMessage')[0].props.message).toBe(
    'The purchase could not be completed. Please try again.',
  );
  await renderer.act(async () => tree.unmount());

  await renderer.act(async () => {
    tree = renderer.create(<SupportScreen purchaseService={service(undefined, async () => [])} />);
  });
  expect(tree.root.findAllByType('ActionButton').some(
    (node) => node.props.label === 'Try again',
  )).toBe(true);
  await renderer.act(async () => tree.unmount());
});
