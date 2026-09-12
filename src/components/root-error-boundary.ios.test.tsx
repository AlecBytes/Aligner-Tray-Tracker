import React from 'react';
import { RootErrorBoundary } from './root-error-boundary.ios';

jest.mock('@expo/ui/swift-ui', () => ({
  Button: 'Button',
  Host: 'Host',
  Text: 'Text',
  VStack: 'VStack',
}));

jest.mock('@expo/ui/swift-ui/modifiers', () => ({
  buttonStyle: (value: unknown) => ({ buttonStyle: value }),
  disabled: (value: unknown) => ({ disabled: value }),
  font: (value: unknown) => ({ font: value }),
  frame: (value: unknown) => ({ frame: value }),
  padding: (value: unknown) => ({ padding: value }),
}));

const renderer = jest.requireActual('react-test-renderer') as {
  act: (callback: () => void | Promise<void>) => Promise<void>;
  create: (element: React.ReactElement) => {
    root: {
      findByType: (type: string) => { props: Record<string, unknown> };
      findAllByType: (type: string) => { props: { children?: unknown } }[];
    };
  };
};

describe('RootErrorBoundary on iOS', () => {
  it('offers a safe retry after an initialization failure without exposing error details', async () => {
    const retry = jest.fn(async () => undefined);
    let tree!: ReturnType<typeof renderer.create>;

    await renderer.act(async () => {
      tree = renderer.create(
        <RootErrorBoundary error={new Error('migration contained private details')} retry={retry} />,
      );
    });

    const visibleText = tree.root
      .findAllByType('Text')
      .map((node) => node.props.children)
      .join(' ');

    expect(visibleText).toContain('Your local data has not been reset');
    expect(visibleText).not.toContain('migration contained private details');

    await renderer.act(async () => {
      const button = tree.root.findByType('Button');
      (button.props.onPress as () => void)();
      await Promise.resolve();
    });

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
