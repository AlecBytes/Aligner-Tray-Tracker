import { Form, Host, Picker, Section, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag, textSelection } from '@expo/ui/swift-ui/modifiers';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import {
  ActionButton,
  CenteredState,
  ValidationMessage,
} from '@/components/expo-ui-components';
import { shareProgressText } from '@/features/share-progress/share-progress-adapter.ios';
import { formatShareProgress } from '@/features/share-progress/share-progress-formatters';
import {
  createShareProgressSnapshot,
  type ShareProgressLevel,
  type ShareProgressSnapshot,
} from '@/features/share-progress/share-progress-model';
import { getStatisticsSnapshot } from '@/features/statistics/statistics-repository';
import { useAppTheme } from '@/theme/use-app-theme';

const CONTENT_LEVELS: { label: string; value: ShareProgressLevel }[] = [
  { label: 'Brief', value: 'brief' },
  { label: 'Summary', value: 'summary' },
  { label: 'Detailed', value: 'detailed' },
];

export function ShareProgressScreen() {
  const db = useSQLiteContext();
  const theme = useAppTheme();
  const [level, setLevel] = useState<ShareProgressLevel>('summary');
  const [snapshot, setSnapshot] = useState<ShareProgressSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const loadSnapshot = useCallback(async () => {
    const capturedAt = Date.now();
    const source = await getStatisticsSnapshot(db);
    const nextSnapshot = createShareProgressSnapshot(source, capturedAt);

    if (nextSnapshot === null) {
      throw new Error('No active treatment history exists.');
    }

    return nextSnapshot;
  }, [db]);

  const refreshSnapshot = useCallback(async () => {
    setIsLoading(true);
    setSnapshot(null);
    setLoadError(null);

    try {
      setSnapshot(await loadSnapshot());
    } catch {
      setLoadError('Your progress could not be loaded from this device. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [loadSnapshot]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLevel('summary');
      setSnapshot(null);
      setLoadError(null);
      setShareError(null);
      setIsSharing(false);
      setIsLoading(true);

      void loadSnapshot()
        .then((nextSnapshot) => {
          if (active) {
            setSnapshot(nextSnapshot);
          }
        })
        .catch(() => {
          if (active) {
            setLoadError(
              'Your progress could not be loaded from this device. Please try again.',
            );
          }
        })
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, [loadSnapshot]),
  );

  const previewText = useMemo(
    () => (snapshot === null ? '' : formatShareProgress(snapshot, level)),
    [level, snapshot],
  );

  const sharePreview = useCallback(async () => {
    setIsSharing(true);
    setShareError(null);

    try {
      await shareProgressText(previewText);
    } catch {
      setShareError('The share sheet could not be opened. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }, [previewText]);

  if (snapshot === null) {
    if (isLoading) {
      return <AppLoadingScreen message="Loading share preview…" />;
    }

    return (
      <Host seedColor={theme.primary} style={{ flex: 1 }}>
        <CenteredState
          actionLabel="Try again"
          message={loadError ?? 'No active treatment history was found.'}
          onAction={() => void refreshSnapshot()}
          title="Share Progress unavailable"
        />
      </Host>
    );
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <Section title="Content Level">
          <Picker<ShareProgressLevel>
            label="Content level"
            modifiers={[pickerStyle('segmented')]}
            onSelectionChange={setLevel}
            selection={level}>
            {CONTENT_LEVELS.map((option) => (
              <Text key={option.value} modifiers={[tag(option.value)]}>
                {option.label}
              </Text>
            ))}
          </Picker>
        </Section>

        <Section title="Preview">
          <Text modifiers={[textSelection(true)]}>{previewText}</Text>
        </Section>

        <Section>
          {shareError ? <ValidationMessage message={shareError} /> : null}
          <ActionButton
            disabled={isSharing}
            label={isSharing ? 'Opening Share…' : 'Share'}
            onPress={() => void sharePreview()}
            pending={isSharing}
          />
        </Section>
      </Form>
    </Host>
  );
}
