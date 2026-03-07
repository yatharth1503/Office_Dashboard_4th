import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../theme';
import { Button, Card, Input } from '../components';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context';
import { authService } from '../services';

// ── Image validation — guard against truncated/invalid data URLs ────────────
const isValidPhoto = (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('http://') || url.startsWith('https://')) return true;
  // data URL must start correctly and have a non-empty data section
  return url.startsWith('data:image/') && url.includes(';base64,') && url.length > 50;
};

// ── Date helpers using LOCAL date parts (avoids UTC-offset shift) ────────────
const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parse a YYYY-MM-DD string as local midnight (not UTC) for DateTimePicker
const dateToObj = (dateStr) => {
  if (!dateStr) return new Date(2000, 0, 1);
  const [y, m, d] = dateStr.split('-');
  return new Date(Number(y), Number(m) - 1, Number(d));
};

// Display DOB without any Date() construction that could shift the day
const formatDob = (dob) => {
  if (!dob) return '—';
  const datePart = typeof dob === 'string' ? dob.split('T')[0] : toLocalDateString(new Date(dob));
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return String(dob);
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(`${title}: ${msg}`);
  else Alert.alert(title, msg);
};

// ── Screen ───────────────────────────────────────────────────────────────────
const DashboardScreen = () => {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation();

  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [showDobPicker, setShowDobPicker] = useState(false);
  const [showFullImageModal, setShowFullImageModal] = useState(false);
  const [form, setForm] = useState({ profile_photo: '', dob: '', address: '', mobile: '' });
  const [formErrors, setFormErrors] = useState({});

  // Hidden file input for web photo picking
  const fileInputRef = useRef(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  };

  // ── Photo helpers ──────────────────────────────────────────────────────────
  const pickNative = async (useCamera) => {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission denied', useCamera ? 'Camera access required.' : 'Gallery access required.');
      return null;
    }
    const result = await (useCamera
      ? ImagePicker.launchCameraAsync
      : ImagePicker.launchImageLibraryAsync)({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
    // Guard: reject images whose base64 exceeds ~1 MB to avoid DB truncation
    if (dataUrl.length > 1_400_000) {
      showAlert('Image too large', 'Please choose a smaller image.');
      return null;
    }
    return dataUrl;
  };

  // Immediately persist photo to backend (when changed outside edit mode)
  const savePhotoNow = async (dataUrl) => {
    setPhotoSaving(true);
    try {
      const dobStr = user?.dob ? String(user.dob).split('T')[0] : null;
      const data = await authService.updateProfile({
        profile_photo: dataUrl || null,
        dob: dobStr,
        address: user?.address || null,
        mobile: user?.mobile || null,
      });
      if (data.success) {
        await updateUser({ ...data.data, profile_photo: dataUrl || null });
      }
    } catch {
      showAlert('Error', 'Failed to save photo');
    } finally {
      setPhotoSaving(false);
    }
  };

  const applyPhoto = (dataUrl) => {
    if (editMode) {
      setForm((f) => ({ ...f, profile_photo: dataUrl }));
    } else {
      savePhotoNow(dataUrl);
    }
  };

  const openPhotoPicker = () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
      return;
    }
    const existingPhoto = editMode ? form.profile_photo : user?.profile_photo;
    Alert.alert('Profile Photo', 'Choose an option', [
      { text: 'Camera', onPress: async () => { const url = await pickNative(true); if (url) applyPhoto(url); } },
      { text: 'Gallery', onPress: async () => { const url = await pickNative(false); if (url) applyPhoto(url); } },
      ...(existingPhoto ? [{ text: 'Remove Photo', style: 'destructive', onPress: () => applyPhoto('') }] : []),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleWebFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => applyPhoto(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const openEdit = () => {
    setForm({
      profile_photo: user?.profile_photo || '',
      dob: user?.dob ? String(user.dob).split('T')[0] : '',
      address: user?.address || '',
      mobile: user?.mobile || '',
    });
    setFormErrors({});
    setShowDobPicker(false);
    setEditMode(true);
  };

  const validateForm = () => {
    const errs = {};
    if (form.mobile && !/^[6-9][0-9]{9}$/.test(form.mobile)) {
      errs.mobile = 'Please enter a valid 10-digit Indian mobile number';
    }
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const data = await authService.updateProfile({
        profile_photo: form.profile_photo || null,
        dob: form.dob || null,
        address: form.address || null,
        mobile: form.mobile || null,
      });
      if (data.success) {
        // Keep the locally-chosen photo (data.data.profile_photo echoed back from DB)
        await updateUser({ ...data.data, profile_photo: form.profile_photo || null });
        setEditMode(false);
        showAlert('Success', 'Profile updated successfully!');
      }
    } catch (error) {
      showAlert('Error',
        error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.error ||
        'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const currentPhoto = editMode ? form.profile_photo : user?.profile_photo;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Hidden file input — web only */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
      )}

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>

          {/* Tappable avatar — view full image if exists, else open picker */}
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => {
              if (isValidPhoto(currentPhoto)) {
                setShowFullImageModal(true);
              } else {
                openPhotoPicker();
              }
            }}
            activeOpacity={0.8}
            disabled={photoSaving}
          >
            {photoSaving ? (
              <View style={styles.avatar}>
                <ActivityIndicator color={Colors.white} size="small" />
              </View>
            ) : isValidPhoto(currentPhoto) ? (
              <Image source={{ uri: currentPhoto }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
            )}
            <View style={styles.avatarCamBadge}>
              <Text style={styles.avatarCamIcon}>📷</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile card ── */}
        <Card>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Profile Information</Text>
            {!editMode && (
              <TouchableOpacity onPress={openEdit} style={styles.editProfileBtn}>
                <Text style={styles.editProfileBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {editMode ? (
            /* ── EDIT FORM ── */
            <View>
              {/* Photo preview + change / remove */}
              <View style={styles.photoEditRow}>
                <TouchableOpacity onPress={openPhotoPicker} activeOpacity={0.8} style={styles.photoPreviewTouch}>
                  {isValidPhoto(form.profile_photo) ? (
                    <Image source={{ uri: form.profile_photo }} style={styles.photoPreview} resizeMode="cover" />
                  ) : (
                    <View style={[styles.photoPreview, styles.photoPreviewPlaceholder]}>
                      <Text style={styles.photoPreviewInitials}>{getInitials(user?.name)}</Text>
                    </View>
                  )}
                  <View style={styles.photoOverlay}>
                    <Text style={styles.photoOverlayText}>Change</Text>
                  </View>
                </TouchableOpacity>
                {form.profile_photo ? (
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => setForm((f) => ({ ...f, profile_photo: '' }))}
                  >
                    <Text style={styles.removePhotoBtnText}>Remove Photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* ── Date of Birth picker ── */}
              <View style={styles.dpContainer}>
                <Text style={styles.dpLabel}>Date of Birth</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    value={form.dob}
                    max={toLocalDateString(new Date())}
                    onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
                    style={{
                      border: `1px solid ${Colors.border}`,
                      borderRadius: 12,
                      padding: '0 12px',
                      lineHeight: '44px',
                      fontSize: 16,
                      color: Colors.black,
                      backgroundColor: Colors.white,
                      outline: 'none',
                      width: '100%',
                      height: 44,
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dpButton}
                      onPress={() => setShowDobPicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={form.dob ? styles.dpButtonText : styles.dpButtonPlaceholder}>
                        {form.dob || 'Select date of birth'}
                      </Text>
                      <Text style={styles.dpChevron}>▼</Text>
                    </TouchableOpacity>
                    {showDobPicker && (
                      <DateTimePicker
                        value={dateToObj(form.dob)}
                        mode="date"
                        display="default"
                        maximumDate={new Date()}
                        onChange={(event, selected) => {
                          setShowDobPicker(false);
                          if (selected && event.type !== 'dismissed') setForm((f) => ({ ...f, dob: toLocalDateString(selected) }));
                        }}
                      />
                    )}
                  </>
                )}
              </View>

              <Input
                label="Mobile Number"
                value={form.mobile}
                onChangeText={(v) => setForm((f) => ({ ...f, mobile: v }))}
                placeholder="9876500001"
                keyboardType="phone-pad"
                error={formErrors.mobile}
              />
              <Input
                label="Address"
                value={form.address}
                onChangeText={(v) => setForm((f) => ({ ...f, address: v }))}
                placeholder="123, Street, City, State"
                multiline
                numberOfLines={3}
              />

              <View style={styles.editActions}>
                {saving ? (
                  <ActivityIndicator color={Colors.primary} />
                ) : (
                  <>
                    <Button title="Save Changes" onPress={handleSave} style={styles.saveBtn} />
                    <Button title="Cancel" variant="outline" onPress={() => setEditMode(false)} style={styles.cancelBtn} />
                  </>
                )}
              </View>
            </View>
          ) : (
            /* ── DISPLAY ── */
            <View>
              <ProfileRow label="Name" value={user?.name} />
              <View style={styles.divider} />
              <ProfileRow label="Email" value={user?.email} />
              <View style={styles.divider} />
              <ProfileRow label="Mobile" value={user?.mobile || '—'} />
              <View style={styles.divider} />
              <ProfileRow label="Date of Birth" value={formatDob(user?.dob)} />
              <View style={styles.divider} />
              <ProfileRow label="Address" value={user?.address || '—'} />
              <View style={styles.divider} />
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role</Text>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleText}>
                    {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* ── Quick Stats ── */}
        <Text style={styles.sectionTitle}>Quick Overview</Text>
        <View style={styles.statsRow}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('DAR')}>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>📋</Text>
              <Text style={styles.statLabel}>DAR Reports</Text>
              <Text style={styles.statHint}>Submit daily activity</Text>
            </Card>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('Leaves')}>
            <Card style={styles.statCard}>
              <Text style={styles.statNumber}>🗓️</Text>
              <Text style={styles.statLabel}>Leaves</Text>
              <Text style={styles.statHint}>Manage applications</Text>
            </Card>
          </TouchableOpacity>
        </View>

        <Button title="Logout" onPress={logout} variant="outline" style={styles.logoutButton} />
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={showFullImageModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowFullImageModal(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.modalClose}
            onPress={() => setShowFullImageModal(false)}
          >
            <Text style={styles.modalCloseText}>✕</Text>
          </TouchableOpacity>
          <Image
            source={{ uri: currentPhoto }}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

/* ── Small display-only row ── */
const ProfileRow = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, styles.infoValueRight]} numberOfLines={3}>
      {value || '—'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.lightGray },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 16, color: 'rgba(255,255,255,0.8)' },
  userName: { fontSize: 24, fontWeight: 'bold', color: Colors.white, marginTop: 2 },
  avatarWrapper: { width: 56, height: 56, borderRadius: 28 },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.darkRed,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImage: { width: 56, height: 56, borderRadius: 28 },
  avatarText: { color: Colors.white, fontSize: 18, fontWeight: 'bold' },
  avatarCamBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary,
  },
  avatarCamIcon: { fontSize: 11 },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 100 },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalCloseText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.black,
  },
  fullImage: {
    width: '90%',
    height: '70%',
  },
  cardTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: Colors.black },
  editProfileBtn: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
  },
  editProfileBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 8,
  },
  infoLabel: { fontSize: 14, color: Colors.darkGray, flexShrink: 0, marginRight: 8 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.black },
  infoValueRight: { flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: Colors.border },
  roleBadge: { backgroundColor: '#FFEBEE', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  roleText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  // Photo in edit form
  photoEditRow: { alignItems: 'center', marginBottom: 20 },
  photoPreviewTouch: { position: 'relative' },
  photoPreview: { width: 96, height: 96, borderRadius: 48 },
  photoPreviewPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  photoPreviewInitials: { color: Colors.white, fontSize: 30, fontWeight: 'bold' },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
    borderBottomLeftRadius: 48, borderBottomRightRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  photoOverlayText: { color: Colors.white, fontSize: 12, fontWeight: '600' },
  removePhotoBtn: {
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 16,
    borderRadius: 8, borderWidth: 1, borderColor: Colors.error,
  },
  removePhotoBtnText: { fontSize: 13, color: Colors.error, fontWeight: '600' },
  // Date picker
  dpContainer: { marginBottom: 16 },
  dpLabel: { fontSize: 14, fontWeight: '600', color: Colors.black, marginBottom: 6 },
  dpButton: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.white,
  },
  dpButtonText: { fontSize: 16, color: Colors.black },
  dpButtonPlaceholder: { fontSize: 16, color: Colors.gray },
  dpChevron: { fontSize: 12, color: Colors.darkGray },
  // Edit actions
  editActions: { marginTop: 8, gap: 10 },
  saveBtn: { marginBottom: 0 },
  cancelBtn: { marginTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.black, marginBottom: 12, marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, alignItems: 'center' },
  statNumber: { fontSize: 32, marginBottom: 4 },
  statLabel: { fontSize: 15, fontWeight: '600', color: Colors.black, marginTop: 4 },
  statHint: { fontSize: 12, color: Colors.gray, marginTop: 2 },
  logoutButton: { marginTop: 8 },
});

export default DashboardScreen;
