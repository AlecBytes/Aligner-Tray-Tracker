import { createModifier } from '@expo/ui/swift-ui/modifiers';

export function trackerStatusControlStyle(colors: {
  faceColor: string;
  baseColor: string;
  foregroundColor: string;
  liquidGlass: boolean;
}) {
  return createModifier('trackerStatusControlStyle', colors);
}
