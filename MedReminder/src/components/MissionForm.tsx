import { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Divider, Text, TextInput } from 'react-native-paper';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { compressMissionImage, readFileAsArrayBuffer } from '../utils/image';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { ScheduleItem } from './ScheduleItem';
import { DAY_LABELS, dateToTimeString } from '../utils/date';
import { useIs24HourFormat } from '../hooks/useTimeFormat';
import type { Mission } from '../types';
import { colors, layout, radii, spacing } from '../theme';

const schema = z.object({
  title: z.string().min(1, 'Mission title is required'),
  description: z.string().optional(),
  notes: z.string().optional(),
  snooze_interval_minutes: z.coerce.number().min(1).max(480),
});

type FormValues = z.infer<typeof schema>;
export type MissionScheduleDraft = { time_of_day: string; days_of_week: number[] };

interface Props {
  initialValues?: Partial<Mission>;
  initialSchedules?: MissionScheduleDraft[];
  onSubmit: (
    values: Omit<Mission, 'id' | 'user_id' | 'created_at' | 'schedules'>,
    schedules: MissionScheduleDraft[]
  ) => Promise<void>;
  submitLabel?: string;
}

export function MissionForm({ initialValues, initialSchedules = [], onSubmit, submitLabel = 'Save Mission' }: Props) {
  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? '',
      description: initialValues?.description ?? '',
      notes: initialValues?.notes ?? '',
      snooze_interval_minutes: initialValues?.snooze_interval_minutes ?? 15,
    },
  });
  const [imageUri, setImageUri] = useState<string | null>(initialValues?.image_url ?? null);
  const [imageMimeType, setImageMimeType] = useState('image/jpeg');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [schedules, setSchedules] = useState<MissionScheduleDraft[]>(initialSchedules);
  const [addingSchedule, setAddingSchedule] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [draftTime, setDraftTime] = useState(new Date());
  const [draftDays, setDraftDays] = useState<number[]>([]);
  const is24Hour = useIs24HourFormat();

  const pickImage = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission required', 'Camera access is needed to add an image.');
        return;
      }
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 1, mediaTypes: ['images'] });
    if (result.canceled || !result.assets[0]) return;
    try {
      const compressed = await compressMissionImage(result.assets[0].uri);
      setImageUri(compressed.uri);
      setImageMimeType(compressed.mimeType);
    } catch {
      setImageUri(result.assets[0].uri);
      setImageMimeType(result.assets[0].mimeType ?? 'image/jpeg');
    }
  };

  const chooseImage = () => Alert.alert('Mission Image', 'Choose source', [
    { text: 'Camera', onPress: () => pickImage('camera') },
    { text: 'Photo Library', onPress: () => pickImage('library') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const uploadImage = async (userId: string) => {
    if (!imageUri) return initialValues?.image_url ?? null;
    if (imageUri === initialValues?.image_url) return imageUri;
    setUploading(true);
    try {
      const extension = imageMimeType.split('/')[1] ?? 'jpg';
      const path = `${userId}/${Date.now()}.${extension}`;
      const fileData = await readFileAsArrayBuffer(imageUri);
      const { error } = await supabase.storage.from('mission-images').upload(path, fileData, {
        contentType: imageMimeType,
        cacheControl: '3600',
      });
      if (error) throw error;
      const signed = await supabase.storage.from('mission-images').createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signed.error) throw signed.error;
      return signed.data.signedUrl;
    } finally {
      setUploading(false);
    }
  };

  const openSchedule = (index?: number) => {
    if (index === undefined) {
      setDraftTime(new Date());
      setDraftDays([]);
      setEditingIndex(null);
    } else {
      const schedule = schedules[index];
      const [hours, minutes] = schedule.time_of_day.split(':').map(Number);
      const time = new Date();
      time.setHours(hours, minutes, 0, 0);
      setDraftTime(time);
      setDraftDays([...schedule.days_of_week]);
      setEditingIndex(index);
    }
    setAddingSchedule(true);
    setShowTimePicker(true);
  };

  const confirmSchedule = () => {
    const schedule = { time_of_day: dateToTimeString(draftTime), days_of_week: draftDays };
    setSchedules((current) => {
      if (editingIndex === null) return [...current, schedule];
      const updated = [...current];
      updated[editingIndex] = schedule;
      return updated;
    });
    setAddingSchedule(false);
    setEditingIndex(null);
  };

  const submit = async (values: FormValues) => {
    if (!schedules.length) {
      Alert.alert('No Schedule', 'Add at least one reminder time.');
      return;
    }
    setSubmitting(true);
    try {
      const user = useAuthStore.getState().user;
      if (!user) throw new Error('Not authenticated');
      await onSubmit({
        title: values.title,
        description: values.description || null,
        notes: values.notes || null,
        image_url: await uploadImage(user.id),
        snooze_interval_minutes: values.snooze_interval_minutes,
        is_active: true,
      }, schedules);
    } catch (error) {
      Alert.alert('Could Not Save Mission', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TouchableOpacity style={styles.imageButton} onPress={chooseImage}>
        {uploading ? <ActivityIndicator color={colors.primary} /> : imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <MaterialCommunityIcons name="image-plus" size={32} color={colors.primary} />
            <Text style={styles.imageLabel}>Add Image</Text>
          </View>
        )}
      </TouchableOpacity>

      <Text variant="titleSmall" style={styles.sectionTitle}>Mission Details</Text>
      <Controller control={control} name="title" render={({ field }) => (
        <TextInput label="Mission Title *" value={field.value} onChangeText={field.onChange} placeholder="e.g. Clear the kitchen counter" mode="outlined" style={styles.input} error={!!errors.title} />
      )} />
      {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}
      <Controller control={control} name="description" render={({ field }) => (
        <TextInput label="Description (optional)" value={field.value} onChangeText={field.onChange} placeholder="What does done look like?" mode="outlined" style={styles.input} multiline />
      )} />
      <Controller control={control} name="notes" render={({ field }) => (
        <TextInput label="First step or helpful cue (optional)" value={field.value} onChangeText={field.onChange} placeholder="Start with a five-minute step" mode="outlined" style={styles.input} multiline />
      )} />

      <Divider style={styles.divider} />
      <Text variant="titleSmall" style={styles.sectionTitle}>Reminder Settings</Text>
      <Controller control={control} name="snooze_interval_minutes" render={({ field }) => (
        <TextInput label="Snooze interval" value={String(field.value)} onChangeText={field.onChange} keyboardType="numeric" mode="outlined" style={styles.input} right={<TextInput.Affix text="min" />} />
      )} />

      <Divider style={styles.divider} />
      <View style={styles.scheduleHeader}>
        <Text variant="titleSmall" style={styles.sectionTitle}>Mission Schedule</Text>
        <Button mode="contained-tonal" icon="plus" compact onPress={() => openSchedule()} disabled={addingSchedule}>Add Time</Button>
      </View>
      {!schedules.length && !addingSchedule && <Text style={styles.emptySchedule}>No reminder times yet.</Text>}
      {schedules.map((schedule, index) => (
        <ScheduleItem key={`${schedule.time_of_day}-${index}`} schedule={schedule} onPress={() => openSchedule(index)} onRemove={() => setSchedules((current) => current.filter((_, i) => i !== index))} />
      ))}

      {addingSchedule && (
        <View style={styles.schedulePicker}>
          <Text variant="titleSmall" style={styles.pickerTitle}>{editingIndex === null ? 'New Reminder' : 'Edit Reminder'}</Text>
          {showTimePicker ? (
            <DateTimePicker value={draftTime} mode="time" display="default" onChange={(_, time) => { if (time) setDraftTime(time); setShowTimePicker(false); }} />
          ) : (
            <TouchableOpacity style={styles.timeButton} onPress={() => setShowTimePicker(true)}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={colors.primary} />
              <Text style={styles.timeText}>{draftTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: !is24Hour })}</Text>
            </TouchableOpacity>
          )}
          <Text variant="bodySmall" style={styles.daysLabel}>Days (none selected means every day)</Text>
          <View style={styles.daysRow}>
            {DAY_LABELS.map((label, day) => {
              const selected = draftDays.includes(day);
              return (
                <TouchableOpacity key={day} style={[styles.dayChip, selected && styles.dayChipSelected]} onPress={() => setDraftDays((current) => selected ? current.filter((value) => value !== day) : [...current, day])}>
                  <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{label.slice(0, 2)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.pickerActions}>
            <Button onPress={() => setAddingSchedule(false)}>Cancel</Button>
            <Button mode="contained" onPress={confirmSchedule}>{editingIndex === null ? 'Add' : 'Update'}</Button>
          </View>
        </View>
      )}

      <Divider style={styles.divider} />
      <Button mode="contained" onPress={handleSubmit(submit)} loading={submitting || uploading} disabled={submitting || uploading} contentStyle={styles.submitContent}>{submitLabel}</Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.formPadding, paddingBottom: spacing.xxxl, gap: spacing.sm },
  imageButton: { alignSelf: 'center', marginBottom: spacing.lg },
  image: { width: 100, height: 100, borderRadius: radii.large },
  imagePlaceholder: { width: 100, height: 100, borderRadius: radii.large, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  imageLabel: { color: colors.primary, fontSize: 12 },
  sectionTitle: { fontWeight: '700', color: colors.textStrong, marginVertical: spacing.xs },
  input: { backgroundColor: colors.surface },
  errorText: { color: colors.errorDark, fontSize: 12 },
  divider: { marginVertical: spacing.md },
  scheduleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptySchedule: { color: colors.textDisabled, textAlign: 'center', padding: spacing.md },
  schedulePicker: { backgroundColor: colors.surface, borderRadius: radii.large, padding: spacing.md, gap: spacing.sm, elevation: 2 },
  pickerTitle: { fontWeight: '600', color: colors.textStrong },
  timeButton: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, backgroundColor: colors.primaryContainer, borderRadius: radii.medium },
  timeText: { color: colors.primary, fontWeight: '600' },
  daysLabel: { color: colors.textSecondary },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  dayChipSelected: { backgroundColor: colors.primary },
  dayText: { color: colors.primary, fontWeight: '600', fontSize: 12 },
  dayTextSelected: { color: colors.onPrimary },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  submitContent: { paddingVertical: 6 },
});
