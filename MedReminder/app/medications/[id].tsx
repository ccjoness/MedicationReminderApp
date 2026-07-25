import { useEffect } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMedicationStore } from '@/stores/medicationStore';
import { MedicationForm, ScheduleDraft } from '@/components/MedicationForm';
import type { Medication } from '@/types';
import { colors, spacing } from '@/theme';

export default function EditMedicationScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMedicationById, updateMedication, deleteMedication } = useMedicationStore();

  const medication = getMedicationById(id);

  const handleDelete = () => {
    Alert.alert(
      'Delete Medication',
      `Delete "${medication?.name}" and cancel all its reminders? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedication(id);
              router.back();
            } catch {
              Alert.alert('Error', 'Could not delete medication. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Add a delete (trash) icon to the navigation header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
          <MaterialCommunityIcons name="trash-can-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, medication]);

  if (!medication) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  headerButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
});
