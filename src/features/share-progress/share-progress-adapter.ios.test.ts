import { shareProgressText } from '@/features/share-progress/share-progress-adapter.ios';

describe('shareProgressText', () => {
  it('passes the exact preview string as the native share message', async () => {
    const share = jest.fn().mockResolvedValue({ action: 'sharedAction' });
    const preview = 'Aligner Tracker\n\nCurrent tray: 9 of 48';

    await shareProgressText(preview, share);

    expect(share).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledWith({ message: preview });
  });

  it('treats a resolved dismissal as a normal result', async () => {
    const share = jest.fn().mockResolvedValue({ action: 'dismissedAction' });

    await expect(shareProgressText('Preview', share)).resolves.toBeUndefined();
  });

  it('surfaces native share failures for the screen to present as retryable', async () => {
    const share = jest.fn().mockRejectedValue(new Error('Unavailable'));

    await expect(shareProgressText('Preview', share)).rejects.toThrow('Unavailable');
  });
});
