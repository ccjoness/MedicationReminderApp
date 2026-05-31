import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useMedicationStore } from '@/stores/medicationStore';
import { MedicationForm } from '@/components/MedicationForm';
import type { Medication } from '@/types';

export default function AddMedicationScreen() {
  const router = useRouter();
  const { addMedication } = useMedicationStore();

  const handleSubmit = async (
    values: Omit<Medication, 'id' | 'user_id' | 'created_at' | 'schedules'>,
    schedules: { time_of_day: string; days_of_week: number[] }[]
  ) => {
    await addMedication(values, schedules);
    Alert.alert('Medication Added', `${values.name} has been added and reminders are scheduled.`, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  };

  return (
    <MedicationForm
      onSubmit={handleSubmit}
      submitLabel="Add Medication"
    />
  );
}
