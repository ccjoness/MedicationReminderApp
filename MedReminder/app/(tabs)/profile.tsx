import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Text, TextInput, Button, Divider, Card, ActivityIndicator } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { compressAvatarPhoto, uriToBlob } from '@/utils/image';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { profile, user, signOut, updateProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ display_name: displayName.trim() });
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save profile';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo library access in settings.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1, // Pick at full quality; we compress afterward
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      if (!user) return;

      // Compress to 512 px max, JPEG 60% — avatars end up ~20–60 KB
      const compressed = await compressAvatarPhoto(result.assets[0].uri);
      const mimeType = compressed.mimeType;
      const ext = mimeType.split('/')[1] ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      // Use uriToBlob — fetch(file://...) can return empty body on Android
      const blob = await uriToBlob(compressed.uri, mimeType);

      const { error: uploadError } = await supabase.storage
        .from('medication-photos')
        .upload(path, blob, { upsert: true, contentType: mimeType });

      if (uploadError) throw uploadError;

      // Bucket is private — use a signed URL, not getPublicUrl
      const { data: signed, error: signErr } = await supabase.storage
        .from('medication-photos')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      if (signErr) throw signErr;
      await updateProfile({ avatar_url: signed.signedUrl });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to upload photo';
      Alert.alert('Upload Error', message);
    } finally {
      setUploading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all medication data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete user data (Supabase cascade handles the rest via FK)
              const { error } = await supabase.rpc('delete_user');
              if (error) throw error;
              await signOut();
            } catch {
              Alert.alert(
                'Delete Error',
                'Could not delete account. Please contact support.'
              );
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploading}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {(profile?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </TouchableOpacity>
        <Text variant="bodySmall" style={styles.changePhotoText}>
          Tap to change photo
        </Text>
      </View>

      {/* Profile info */}
      <Card style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionLabel}>
          Profile
        </Text>

        <TextInput
          label="Display Name"
          value={displayName}
          onChangeText={setDisplayName}
          mode="outlined"
          style={styles.input}
        />

        <TextInput
          label="Email"
          value={user?.email ?? ''}
          disabled
          mode="outlined"
          style={styles.input}
        />

        <Button
          mode="contained"
          onPress={handleSave}
          loading={saving}
          disabled={saving || !displayName.trim()}
          style={styles.saveButton}
        >
          Save Changes
        </Button>
      </Card>

      {/* Account actions */}
      <Card style={styles.section}>
        <Text variant="titleSmall" style={styles.sectionLabel}>
          Account
        </Text>

        <Button
          mode="outlined"
          onPress={handleSignOut}
          icon="logout"
          style={styles.signOutButton}
        >
          Sign Out
        </Button>

        <Divider style={styles.divider} />

        <Button
          mode="text"
          onPress={handleDeleteAccount}
          textColor="#C62828"
          icon="delete-forever"
        >
          Delete Account
        </Button>
      </Card>
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
    gap: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#6750A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    color: '#6750A4',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 12,
    elevation: 1,
  },
  sectionLabel: {
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#fff',
  },
  saveButton: {
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: '#6750A4',
  },
  signOutButton: {
    borderRadius: 8,
  },
  divider: {
    marginVertical: 4,
  },
});
