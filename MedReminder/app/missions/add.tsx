import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MissionForm, type MissionScheduleDraft } from '@/components/MissionForm';
import { useMissionStore } from '@/stores/missionStore';
import type { Mission } from '@/types';

export default function AddMissionScreen() {
  const router = useRouter();
  const { addMission } = useMissionStore();
  const submit = async (values: Omit<Mission, 'id' | 'user_id' | 'created_at' | 'schedules'>, schedules: MissionScheduleDraft[]) => {
    await addMission(values, schedules);
    Alert.alert('Mission Added', `“${values.title}” is ready.`, [{ text: 'OK', onPress: () => router.back() }]);
  };
  return <MissionForm onSubmit={submit} submitLabel="Add Mission" />;
}
