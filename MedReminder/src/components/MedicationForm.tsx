/**
 * Shared Add/Edit medication form.
 * Handles: all fields, image picker, schedule builder, day-of-week selector, time picker.
 */
import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Divider,
  Checkbox,
  ActivityIndicator,
} from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { compressMedicationPhoto, readFileAsArrayBuffer } from '../utils/image';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ScheduleItem } from './ScheduleItem';
import { DAY_LABELS, dateToTimeString } from '../utils/date';
import { useIs24HourFormat } from '../hooks/useTimeFormat';
import type { Medication, MedicationSchedule } from '../types';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const schema = z.object({
  name: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  notes: z.string().optional(),
  snooze_interval_minutes: z.coerce
    .number({ invalid_type_error: 'Must be a number' })
    .min(1, 'Must be at least 1 minute')
    .max(480, 'Cannot exceed 480 minutes'),
  refill_count: z.string().optional(),
  low_refill_threshold: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScheduleDraft = {
  time_of_day: string; // "HH:MM:00"
  days_of_week: number[]; // empty = every day
};

interface Props {
  initialValues?: Partial<Medication>;
  initialSchedules?: ScheduleDraft[];
  onSubmit: (
    values: Omit<Medication, 'id' | 'user_id' | 'created_at' | 'schedules'>,
    schedules: ScheduleDraft[]
  ) => Promise<void>;
  submitLabel?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MedicationForm({
  initialValues,
  initialSchedules = [],
  onSubmit,
  submitLabel = 'Save Medication',
}: Props) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValues?.name ?? '',
      dosage: initialValues?.dosage ?? '',
      notes: initialValues?.notes ?? '',
      snooze_interval_minutes: initialValues?.snooze_interval_minutes ?? 30,
      refill_count:
        initialValues?.refill_count !== null && initialValues?.refill_count !== undefined
          ? String(initialValues.refill_count)
          : '',
      low_refill_threshold:
        initialValues?.low_refill_threshold !== null && initialValues?.low_refill_threshold !== undefined
          ? String(initialValues.low_refill_threshold)
          : '',
    },
  });

  // Photo state
  const [photoUri, setPhotoUri] = useState<string | null>(initialValues?.photo_url ?? null);
  const [photoMimeType, setPhotoMimeType] = useState<string>('image/jpeg');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Schedule state
  const [schedules, setSchedules] = useState<ScheduleDraft[]>(initialSchedules);

  // Time picker state
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editingScheduleIndex, setEditingScheduleIndex] = useState<number | null>(null);
  const [draftTime, setDraftTime] = useState<Date>(new Date());
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const [addingSchedule, setAddingSchedule] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const is24Hour = useIs24HourFormat();

  // ---------------------------------------------------------------------------
  // Photo handling
  // ---------------------------------------------------------------------------

  const pickPhoto = async (source: 'library' | 'camera') => {
    let result: ImagePicker.ImagePickerResult;
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to take a photo.');
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // Pick at full quality; we compress afterward with expo-image-manipulator
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Photo library access is needed.');
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // Pick at full quality; we compress afterward with expo-image-manipulator
        mediaTypes: ['images'],
      });
    }

    if (result.canceled || !result.assets[0]) return;

    // Compress before storing — resize to 1024 px max, re-encode as JPEG at 50% quality.
    // This brings any camera image (typically 5–30 MB) down to ~60–150 KB.
    try {
      const compressed = await compressMedicationPhoto(result.assets[0].uri);
      setPhotoUri(compressed.uri);
      setPhotoMimeType(compressed.mimeType);
    } catch {
      // Fall back to original if compression fails
      setPhotoUri(result.assets[0].uri);
      setPhotoMimeType(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const handlePhotoPress = () => {
    Alert.alert('Medication Photo', 'Choose source', [
      { text: 'Camera', onPress: () => pickPhoto('camera') },
      { text: 'Photo Library', onPress: () => pickPhoto('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const uploadPhoto = async (userId: string): Promise<string | null> => {
    if (!photoUri) return initialValues?.photo_url ?? null;
    if (photoUri === initialValues?.photo_url) return photoUri; // unchanged

    setUploadingPhoto(true);
    try {
      // Supabase's documented React Native flow uses an ArrayBuffer decoded
      // from base64. Blob, FormData, and Uint8Array can be serialized incorrectly.
      const ext = photoMimeType.split('/')[1] ?? 'jpg';
      const path = `${userId}/${Date.now()}.${ext}`;

      const fileData = await readFileAsArrayBuffer(photoUri);

      const { error: uploadError } = await supabase.storage
        .from('medication-photos')
        .upload(path, fileData, {
          upsert: false,
          contentType: photoMimeType,
          cacheControl: '3600',
        });

      if (uploadError) {
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      // Use a signed URL — bucket is private so getPublicUrl would return a broken URL
      const { data: signed, error: signErr } = await supabase.storage
        .from('medication-photos')
        .createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year TTL

      if (signErr) {
        throw new Error(`Image URL creation failed: ${signErr.message}`);
      }
      return signed.signedUrl;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown image upload error';
      throw new Error(message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Schedule editing
  // ---------------------------------------------------------------------------

  const openAddSchedule = () => {
    setDraftTime(new Date());
    setDraftDays([]);
    setEditingScheduleIndex(null);
    setAddingSchedule(true);
    setShowTimePicker(true);
  };

  const openEditSchedule = (index: number) => {
    const s = schedules[index];
    const [h, m] = s.time_of_day.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    setDraftTime(d);
    setDraftDays([...s.days_of_week]);
    setEditingScheduleIndex(index);
    setAddingSchedule(true);
    setShowTimePicker(true);
  };

  const toggleDay = (day: number) => {
    setDraftDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const confirmSchedule = () => {
    const newSchedule: ScheduleDraft = {
      time_of_day: dateToTimeString(draftTime),
      days_of_week: draftDays,
    };

    setSchedules((prev) => {
      if (editingScheduleIndex !== null) {
        const updated = [...prev];
        updated[editingScheduleIndex] = newSchedule;
        return updated;
      }
      return [...prev, newSchedule];
    });

    setAddingSchedule(false);
    setShowTimePicker(false);
    setEditingScheduleIndex(null);
  };

  const removeSchedule = (index: number) => {
    setSchedules((prev) => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Form submit
  // ---------------------------------------------------------------------------

  const handleFormSubmit = async (values: FormValues) => {
    if (schedules.length === 0) {
      Alert.alert('No Schedule', 'Please add at least one reminder time.');
      return;
    }

    setSubmitting(true);
    try {
      // Read user from Zustand store — already populated when navigated past login
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');

      const photoUrl = await uploadPhoto(user.id);

      await onSubmit(
        {
          name: values.name,
          dosage: values.dosage,
          notes: values.notes || null,
          photo_url: photoUrl,
          snooze_interval_minutes: values.snooze_interval_minutes,
          refill_count:
            values.refill_count && values.refill_count !== ''
              ? Number(values.refill_count)
              : null,
          low_refill_threshold:
            values.low_refill_threshold && values.low_refill_threshold !== ''
              ? Number(values.low_refill_threshold)
              : null,
          is_active: true,
        },
        schedules
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save medication';
      Alert.alert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Photo */}
      <TouchableOpacity style={styles.photoButton} onPress={handlePhotoPress}>
        {uploadingPhoto ? (
          <ActivityIndicator size="small" color="#6750A4" />
        ) : photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <MaterialCommunityIcons name="camera-plus" size={32} color="#6750A4" />
            <Text style={styles.photoLabel}>Add Photo</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Basic info */}
      <Text variant="titleSmall" style={styles.sectionTitle}>
        Medication Details
      </Text>

      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, value } }) => (
          <TextInput
            label="Medication Name *"
            value={value}
            onChangeText={onChange}
            mode="outlined"
            style={styles.input}
            error={!!errors.name}
          />
        )}
      />
      {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

      <Controller
        control={control}
        name="dosage"
        render={({ field: { onChange, value } }) => (
          <TextInput
            label="Dosage / Strength *"
            value={value}
            onChangeText={onChange}
            placeholder="e.g. 500mg, 1 tablet"
            mode="outlined"
            style={styles.input}
            error={!!errors.dosage}
          />
        )}
      />
      {errors.dosage && <Text style={styles.errorText}>{errors.dosage.message}</Text>}

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, value } }) => (
          <TextInput
            label="Notes (optional)"
            value={value}
            onChangeText={onChange}
            placeholder="e.g. Take with food"
            mode="outlined"
            style={styles.input}
            multiline
            numberOfLines={2}
          />
        )}
      />

      <Divider style={styles.divider} />

      {/* Refill tracking */}
      <Text variant="titleSmall" style={styles.sectionTitle}>
        Refill Tracking (optional)
      </Text>

      <View style={styles.row}>
        <Controller
          control={control}
          name="refill_count"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Current pill count"
              value={value}
              onChangeText={onChange}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
          )}
        />
        <Controller
          control={control}
          name="low_refill_threshold"
          render={({ field: { onChange, value } }) => (
            <TextInput
              label="Warn when below"
              value={value}
              onChangeText={onChange}
              keyboardType="numeric"
              mode="outlined"
              style={[styles.input, styles.halfInput]}
            />
          )}
        />
      </View>

      <Divider style={styles.divider} />

      {/* Snooze */}
      <Text variant="titleSmall" style={styles.sectionTitle}>
        Reminder Settings
      </Text>

      <Controller
        control={control}
        name="snooze_interval_minutes"
         render={({ field: { onChange, value } }) => (
          <TextInput
            label="Snooze interval (minutes)"
            value={String(value)}
            onChangeText={(text) => onChange(text === '' ? '' : text)}
            keyboardType="numeric"
            mode="outlined"
            style={styles.input}
            error={!!errors.snooze_interval_minutes}
            right={<TextInput.Affix text="min" />}
          />
        )}
      />
      {errors.snooze_interval_minutes && (
        <Text style={styles.errorText}>{errors.snooze_interval_minutes.message as string}</Text>
      )}

      <Divider style={styles.divider} />

      {/* Schedules */}
      <View style={styles.schedulesHeader}>
        <Text variant="titleSmall" style={styles.sectionTitle}>
          Reminder Schedule
        </Text>
        <Button
          mode="contained-tonal"
          icon="plus"
          compact
          onPress={openAddSchedule}
          disabled={addingSchedule}
        >
          Add Time
        </Button>
      </View>

      {schedules.length === 0 && !addingSchedule && (
        <Text style={styles.noScheduleText}>
          No reminder times added yet. Tap "Add Time" to add one.
        </Text>
      )}

      {schedules.map((s, i) => (
        <ScheduleItem
          key={i}
          schedule={s}
          onRemove={() => removeSchedule(i)}
          onPress={() => openEditSchedule(i)}
        />
      ))}

      {/* Inline schedule builder */}
      {addingSchedule && (
        <View style={styles.schedulePicker}>
          <Text variant="titleSmall" style={styles.pickerTitle}>
            {editingScheduleIndex !== null ? 'Edit Time' : 'New Reminder'}
          </Text>

          {showTimePicker && (
            <DateTimePicker
              value={draftTime}
              mode="time"
              display="default"
              onChange={(_, date) => {
                if (date) setDraftTime(date);
                setShowTimePicker(false);
              }}
            />
          )}
          {!showTimePicker && (
            <TouchableOpacity
              style={styles.timeButton}
              onPress={() => setShowTimePicker(true)}
            >
              <MaterialCommunityIcons name="clock-outline" size={20} color="#6750A4" />
              <Text style={styles.timeButtonText}>
                {draftTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !is24Hour })}
              </Text>
            </TouchableOpacity>
          )}

          <Text variant="bodySmall" style={styles.daysLabel}>
            Days (leave all unchecked for every day)
          </Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayChip,
                  draftDays.includes(day) && styles.dayChipSelected,
                ]}
                onPress={() => toggleDay(day)}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    draftDays.includes(day) && styles.dayChipTextSelected,
                  ]}
                >
                  {label.slice(0, 2)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.pickerActions}>
            <Button
              mode="text"
              onPress={() => {
                setAddingSchedule(false);
                setShowTimePicker(false);
              }}
            >
              Cancel
            </Button>
            <Button mode="contained" onPress={confirmSchedule}>
              {editingScheduleIndex !== null ? 'Update' : 'Add'}
            </Button>
          </View>
        </View>
      )}

      <Divider style={styles.divider} />

      <Button
        mode="contained"
        onPress={handleSubmit(handleFormSubmit)}
        loading={submitting || uploadingPhoto}
        disabled={submitting || uploadingPhoto}
        style={styles.submitButton}
        contentStyle={styles.submitButtonContent}
      >
        {submitLabel}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F3FA',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 8,
  },
  photoButton: {
    alignSelf: 'center',
    marginBottom: 16,
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  photoPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoLabel: {
    color: '#6750A4',
    fontSize: 12,
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#333',
    marginTop: 4,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#B00020',
    fontSize: 12,
    marginTop: -4,
    marginLeft: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  halfInput: {
    flex: 1,
  },
  divider: {
    marginVertical: 12,
  },
  schedulesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  noScheduleText: {
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
    fontStyle: 'italic',
  },
  schedulePicker: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    marginVertical: 8,
    elevation: 2,
    gap: 8,
  },
  pickerTitle: {
    fontWeight: '600',
    color: '#333',
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    backgroundColor: '#EDE7F6',
    borderRadius: 8,
  },
  timeButtonText: {
    color: '#6750A4',
    fontWeight: '600',
    fontSize: 16,
  },
  daysLabel: {
    color: '#555',
    marginTop: 4,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 4,
  },
  dayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EDE7F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipSelected: {
    backgroundColor: '#6750A4',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6750A4',
  },
  dayChipTextSelected: {
    color: '#fff',
  },
  pickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#6750A4',
  },
  submitButtonContent: {
    paddingVertical: 6,
  },
});
