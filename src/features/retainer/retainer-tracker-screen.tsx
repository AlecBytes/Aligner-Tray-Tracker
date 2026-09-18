import { Button, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { retainerDuration, useRetainer } from './use-retainer';
export function RetainerTrackerScreen() {
  const { snapshot, now, error, busy, toggle } = useRetainer(); const router = useRouter();
  const [latest, previous] = snapshot?.punches ?? [];
  return <View style={{ flex: 1, justifyContent: 'space-evenly', padding: 24 }}>
    <Button title="Menu" onPress={() => router.push('/menu')} /><Text>RETAINER MODE</Text>
    <Button title={`Retainers are ${latest?.status ?? 'OUT'}`} disabled={busy || !latest} onPress={() => void toggle()} />
    <Text>{latest?.status === 'IN' ? retainerDuration(now - latest.timestamp) : previous?.status === 'IN' ? `Last wear: ${retainerDuration(latest.timestamp - previous.timestamp)}` : 'No wear recorded'}</Text>
    {error ? <Text>{error}</Text> : null}
    <Button title="Edit In/Out Times" onPress={() => router.push('/edit-times')} />
  </View>;
}
