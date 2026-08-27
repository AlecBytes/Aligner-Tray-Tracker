import { Share } from 'react-native';

type ShareInvoker = (content: { message: string }) => Promise<unknown>;

export async function shareProgressText(
  message: string,
  share: ShareInvoker = (content) => Share.share(content),
) {
  await share({ message });
}
