import { preload, setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import type { TrackerToggleOutcome } from './use-ios-tracker';

const trayInSound = require('../../../assets/sounds/tray-in.wav');
const trayOutSound = require('../../../assets/sounds/tray-out.wav');

let audioModeConfigured = false;
let audioModePreparation: Promise<boolean> | null = null;

function runBestEffort(effect: () => void | Promise<void>) {
  try {
    const result = effect();
    if (result && typeof result.then === 'function') {
      void result.catch(() => undefined);
    }
  } catch {
    // Supplemental feedback must never affect tracker persistence or presentation.
  }
}

runBestEffort(() => preload(trayInSound));
runBestEffort(() => preload(trayOutSound));

function prepareAudioMode() {
  if (audioModeConfigured) return Promise.resolve(true);
  if (audioModePreparation) return audioModePreparation;

  try {
    audioModePreparation = setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: false,
      shouldPlayInBackground: false,
    }).then(
      () => {
        audioModeConfigured = true;
        audioModePreparation = null;
        return true;
      },
      () => {
        audioModePreparation = null;
        return false;
      },
    );
  } catch {
    audioModePreparation = null;
    return Promise.resolve(false);
  }
  return audioModePreparation;
}

export function useTrackerStatusFeedback() {
  const inPlayer = useAudioPlayer(trayInSound, { keepAudioSessionActive: true });
  const outPlayer = useAudioPlayer(trayOutSound, { keepAudioSessionActive: true });
  const audioModeReady = useRef(false);
  const focused = useRef(false);
  const appActive = useRef(AppState.currentState === 'active');
  const generation = useRef(0);
  const playbackSequence = useRef(0);

  const stopPlayers = useCallback(() => {
    playbackSequence.current += 1;
    for (const player of [inPlayer, outPlayer]) {
      runBestEffort(() => player.pause());
      runBestEffort(() => player.seekTo(0));
    }
  }, [inPlayer, outPlayer]);

  useEffect(() => {
    let cancelled = false;
    audioModeReady.current = audioModeConfigured;
    void prepareAudioMode().then((ready) => {
      if (!cancelled) audioModeReady.current = ready;
    });
    return () => {
      cancelled = true;
      audioModeReady.current = false;
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      return () => {
        focused.current = false;
        generation.current += 1;
        stopPlayers();
      };
    }, [stopPlayers]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const nextActive = state === 'active';
      if (appActive.current && !nextActive) {
        generation.current += 1;
      }
      appActive.current = nextActive;
      if (!nextActive) stopPlayers();
    });
    return () => subscription.remove();
  }, [stopPlayers]);

  return useCallback(() => {
    const acceptedGeneration = generation.current;

    return (outcome: TrackerToggleOutcome) => {
      if (
        generation.current !== acceptedGeneration ||
        !focused.current ||
        !appActive.current
      ) {
        return;
      }

      const playbackAttempt = ++playbackSequence.current;

      if (outcome.kind === 'failed') {
        runBestEffort(() =>
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
        );
        return;
      }

      runBestEffort(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
      if (!audioModeReady.current) return;

      const player = outcome.status === 'IN' ? inPlayer : outPlayer;
      const otherPlayer = outcome.status === 'IN' ? outPlayer : inPlayer;
      if (!player.isLoaded) return;

      runBestEffort(() => otherPlayer.pause());
      runBestEffort(() => player.pause());
      void (async () => {
        try {
          await player.seekTo(0);
        } catch {
          return;
        }

        if (
          playbackSequence.current !== playbackAttempt ||
          generation.current !== acceptedGeneration ||
          !focused.current ||
          !appActive.current ||
          !audioModeReady.current ||
          !player.isLoaded
        ) {
          return;
        }

        runBestEffort(() => {
          player.volume = outcome.status === 'IN' ? 0.28 : 0.34;
        });
        runBestEffort(() => player.play());
      })();
    };
  }, [inPlayer, outPlayer]);
}
