import { View, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMedicationStore } from '@/stores/medicationStore';
import { MedicationForm, ScheduleDraft } from '@/components/MedicationForm';
import type { Medication } from '@/types';

export default function EditMedicationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMedicationById, updateMedication } = useMedicationStore();

  const medication = getMedicationById(id);

  if (!medication) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6750A4" />
      </View>
    );
  }

  const initialSchedules: ScheduleDraft[] = (medication.schedules ?? []).map((s) => ({
    time_of_day: s.time_of_day,
    days_of_week: s.days_of_week,
  }));

  const handleSubmit = async (
    values: Omit<Medication, 'id' | 'user_id' | 'created_at' | 'schedules'>,
    schedules: ScheduleDraft[]
  ) => {
    await updateMedication(id, values, schedules);
    Alert.alert('Updated', `${values.name} has been updated.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <MedicationForm
      initialValues={medication}
      initialSchedules={initialSchedules}
      onSubmit={handleSubmit}
      submitLabel="Save Changes"
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
