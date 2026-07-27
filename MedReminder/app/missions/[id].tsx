import { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MissionForm, type MissionScheduleDraft } from '@/components/MissionForm';
import { useMissionStore } from '@/stores/missionStore';
import type { Mission } from '@/types';
import { colors, spacing } from '@/theme';

export default function EditMissionScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMissionById, updateMission, deleteMission } = useMissionStore();
  const mission = getMissionById(id);
  const remove = () => Alert.alert('Delete Mission', `Delete “${mission?.title}” and cancel its reminders?`, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMission(id); router.back(); } },
  ]);
  useEffect(() => navigation.setOptions({ headerRight: () => <TouchableOpacity onPress={remove} style={styles.headerButton}><MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.error} /></TouchableOpacity> }), [navigation, mission]);
  if (!mission) return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>;
  const initialSchedules = (mission.schedules ?? []).map(({ time_of_day, days_of_week }) => ({ time_of_day, days_of_week }));
  const submit = async (values: Omit<Mission, 'id' | 'user_id' | 'created_at' | 'schedules'>, schedules: MissionScheduleDraft[]) => {
    await updateMission(id, values, schedules);
    Alert.alert('Mission Updated', `“${values.title}” has been updated.`, [{ text: 'OK', onPress: () => router.back() }]);
  };
  return <MissionForm initialValues={mission} initialSchedules={initialSchedules} onSubmit={submit} submitLabel="Save Changes" />;
}

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, headerButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs } });
