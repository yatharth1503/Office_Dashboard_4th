import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  SectionList,
  RefreshControl,
  Alert,
  Platform,
  SafeAreaView,
  useWindowDimensions,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme';
import { Button, Input, Card } from '../components';
import { darService, activityTypeService } from '../services';
import { useAuth } from '../context';
import DateTimePicker from '@react-native-community/datetimepicker';

// ─── Date Helpers ───────────────────────────────────────────────────────────
const toDateString = (d) => d.toISOString().split('T')[0];

const getTodayDate    = () => toDateString(new Date());
const getYesterdayDate = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
};

const isDateAllowed = (dateStr) => {
  const today     = getTodayDate();
  const yesterday = getYesterdayDate();
  return dateStr === today || dateStr === yesterday;
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const showAlert = (title, msg) => {
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert(title, msg);
};

const confirmAction = (title, msg) =>
  new Promise((resolve) => {
    if (Platform.OS === 'web') {
      resolve(window.confirm(msg));
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'OK', onPress: () => resolve(true) },
      ]);
    }
  });

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VIEW — view-only, pick employee → see their DARs → tap a date
// ═══════════════════════════════════════════════════════════════════════════
const AdminDARView = () => {
  const [groupedActivities, setGroupedActivities] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await darService.getEmployees();
      if (data.success) setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }, []);

  const fetchDars = useCallback(async (empId) => {
    try {
      setLoading(true);
      const data = await darService.getAllDars(empId || undefined);
      if (data.success) {
        // Flatten and group activities by date
        const allActivities = [];
        data.data.forEach(dar => {
          dar.activities.forEach(activity => {
            allActivities.push({
              ...activity,
              date: dar.date,
              user_name: dar.user_name,
              dar_id: dar.id,
            });
          });
        });

        // Group by date and then by employee
        const groups = {};
        allActivities.forEach(activity => {
          if (!groups[activity.date]) {
            groups[activity.date] = {
              date: activity.date,
              employees: {},
              totalMinutes: 0,
            };
          }
          if (!groups[activity.date].employees[activity.user_name]) {
            groups[activity.date].employees[activity.user_name] = [];
          }
          groups[activity.date].employees[activity.user_name].push(activity);
          groups[activity.date].totalMinutes += activity.minutes;
        });

        // Convert to array and sort by date descending
        const groupedArray = Object.values(groups).sort((a, b) => new Date(b.date) - new Date(a.date));
        setGroupedActivities(groupedArray);
      }
    } catch (error) {
      console.error('Failed to fetch DARs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchDars('');
  }, [fetchEmployees, fetchDars]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDars(selectedEmployeeId);
  };

  const handleEmployeeChange = (empId) => {
    setSelectedEmployeeId(empId);
    fetchDars(empId);
  };

  const sectionTitle = selectedEmployeeId
    ? `${employees.find((e) => e.id.toString() === selectedEmployeeId.toString())?.name || 'Employee'}'s DARs`
    : 'Latest DARs (All Employees)';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>DAR Management</Text>
      </View>

      {/* Employee picker */}
      <View style={styles.dropdownSection}>
        <Text style={styles.dropdownLabel}>Filter by Employee</Text>
        {employees.length === 0 ? (
          <Text style={{ color: Colors.error, marginTop: 8 }}>No employees found.</Text>
        ) : Platform.OS === 'web' ? (
          <select
            value={selectedEmployeeId}
            onChange={(e) => handleEmployeeChange(e.target.value)}
            style={{
              border: `1px solid ${Colors.border}`,
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 15,
              color: Colors.black,
              backgroundColor: Colors.white,
              width: '100%',
              cursor: 'pointer',
              outline: 'none',
              marginTop: 4,
            }}
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        ) : (
          <TouchableOpacity
            style={styles.customPickerButton}
            onPress={() => setShowEmployeeModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.customPickerText}>
              {selectedEmployeeId
                ? employees.find((e) => e.id.toString() === selectedEmployeeId.toString())?.name || 'Employee'
                : 'All Employees'}
            </Text>
            <Text style={styles.customPickerChevron}>▼</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>{sectionTitle}</Text>

      <SectionList
        sections={groupedActivities.map(group => ({
          title: formatDate(group.date),
          data: Object.keys(group.employees).sort().map(name => ({ name, activities: group.employees[name] })),
          totalMinutes: group.totalMinutes,
        }))}
        keyExtractor={(item) => item.name}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        renderSectionHeader={({ section }) => (
          <>
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{section.title}</Text>
              <View style={styles.minutesBadge}>
                <Text style={styles.minutesText}>{section.totalMinutes} min total</Text>
              </View>
            </View>
            {Platform.OS !== 'web' && <View style={styles.headerSpacer} />}
          </>
        )}
        renderItem={({ item }) => (
          <View style={styles.employeeGroup}>
            <Text style={styles.employeeName}>{item.name}</Text>
            {item.activities.map(activity => (
              <Card key={activity.id}>
                <View style={styles.activityRow}>
                  <View style={styles.activityDot} />
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityName}>
                      {activity.activity_type_name || `Activity #${activity.activity_type_id}`}
                    </Text>
                    <Text style={styles.activityMeta}>
                      {activity.minutes} min{activity.message ? ` — ${activity.message}` : ''}
                    </Text>
                    {activity.remarks ? <Text style={styles.remarksText}>Remarks: {activity.remarks}</Text> : null}
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No DAR entries found</Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEE VIEW — list, detail (with add / edit / delete for today/yesterday)
// ═══════════════════════════════════════════════════════════════════════════
const EmployeeDARView = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const [dars, setDars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activityTypes, setActivityTypes] = useState([]);

  // Views: 'list' | 'detail' | 'form' | 'editActivity'
  const [view, setView] = useState('list');
  const [selectedDar, setSelectedDar] = useState(null);

  // ── Add-form state (used for both "New DAR" and "Add to existing") ──
  const [date, setDate] = useState(getTodayDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activities, setActivities] = useState([
    { activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [pickerOpenIndex, setPickerOpenIndex] = useState(null);
  const [hoursPickerIndex, setHoursPickerIndex] = useState(null);
  const [minutesPickerIndex, setMinutesPickerIndex] = useState(null);

  // ── Edit-activity state ──
  const [editItem, setEditItem] = useState(null);
  const [editForm, setEditForm] = useState({ activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' });
  const [editErrors, setEditErrors] = useState({});
  const [editPickerOpen, setEditPickerOpen] = useState(false);
  const [editHoursPickerOpen, setEditHoursPickerOpen] = useState(false);
  const [editMinutesPickerOpen, setEditMinutesPickerOpen] = useState(false);

  // ── Data fetching ──
  const fetchDars = useCallback(async () => {
    try {
      setLoading(true);
      const data = await darService.getMyDars();
      if (data.success) setDars(data.data);
    } catch (error) {
      console.error('Failed to fetch DARs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDars(); }, [fetchDars]);

  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const data = await activityTypeService.getAll();
        if (data.success) setActivityTypes(data.data || []);
      } catch (error) {
        console.error('Failed to fetch activity types:', error);
      }
    };
    fetchTypes();
  }, []);

  const onRefresh = () => { setRefreshing(true); fetchDars(); };

  // Refresh selected DAR after mutations
  const refreshSelectedDar = async () => {
    const data = await darService.getMyDars();
    if (data.success) {
      setDars(data.data);
      if (selectedDar) {
        const updated = data.data.find((d) => d.id === selectedDar.id);
        if (updated) setSelectedDar(updated);
      }
    }
  };

  // ── Add-form helpers ──
  const resetForm = () => {
    setDate(getTodayDate());
    setActivities([{ activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' }]);
    setErrors({});
  };

  const openNewForm = () => { resetForm(); setView('form'); };

  const openAddToExisting = (dar) => {
    setDate(toDateString(new Date(dar.date)));
    setActivities([{ activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' }]);
    setErrors({});
    setView('form');
  };

  const addActivity = () => {
    setActivities((prev) => [
      ...prev,
      { activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' },
    ]);
  };

  const removeActivity = (index) => {
    if (activities.length === 1) return;
    setActivities((prev) => prev.filter((_, i) => i !== index));
  };

  const updateActivity = (index, field, value) => {
    setActivities((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!date) newErrors.date = 'Date is required';
    else if (!isDateAllowed(date)) newErrors.date = 'Only today or yesterday is allowed';

    activities.forEach((activity, index) => {
      if (!activity.activity_type_id) newErrors[`activity_${index}_type`] = 'Activity type required';
      const totalMin = (parseInt(activity.hours) || 0) * 60 + (parseInt(activity.minutes) || 0);
      if (totalMin <= 0) newErrors[`activity_${index}_minutes`] = 'Time must be > 0';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const formattedActivities = activities.map((a) => {
        const totalMinutes = (parseInt(a.hours) || 0) * 60 + (parseInt(a.minutes) || 0);
        return {
          activity_type_id: parseInt(a.activity_type_id),
          minutes: totalMinutes,
          message: a.message || null,
          remarks: a.remarks || null,
        };
      });
      const data = await darService.create(date, formattedActivities);
      if (data.success) {
        showAlert('Success', 'DAR activities added successfully!');
        resetForm();
        await fetchDars();
        // If we were adding to an existing, go back to detail
        if (selectedDar) {
          const updated = (await darService.getMyDars()).data?.find(
            (d) => d.id === selectedDar.id || toDateString(new Date(d.date)) === date
          );
          if (updated) { setSelectedDar(updated); setView('detail'); }
          else setView('list');
        } else {
          setView('list');
        }
      }
    } catch (error) {
      const message =
        error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.error ||
        'Failed to submit DAR';
      showAlert('Error', message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Edit activity ──
  const openEdit = (activity) => {
    const hrs = Math.floor(activity.minutes / 60).toString();
    const mins = (activity.minutes % 60).toString();
    setEditItem(activity);
    setEditForm({
      activity_type_id: activity.activity_type_id.toString(),
      hours: hrs,
      minutes: mins,
      message: activity.message || '',
      remarks: activity.remarks || '',
    });
    setEditErrors({});
    setView('editActivity');
  };

  const validateEdit = () => {
    const errs = {};
    if (!editForm.activity_type_id) errs.type = 'Activity type required';
    const totalMin = (parseInt(editForm.hours) || 0) * 60 + (parseInt(editForm.minutes) || 0);
    if (totalMin <= 0) errs.minutes = 'Time must be > 0';
    setEditErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleEditSubmit = async () => {
    if (!validateEdit()) return;
    setSubmitting(true);
    try {
      const totalMinutes = (parseInt(editForm.hours) || 0) * 60 + (parseInt(editForm.minutes) || 0);
      const data = await darService.updateActivity(editItem.id, {
        activity_type_id: parseInt(editForm.activity_type_id),
        minutes: totalMinutes,
        message: editForm.message || null,
        remarks: editForm.remarks || null,
      });
      if (data.success) {
        showAlert('Success', 'Activity updated!');
        await refreshSelectedDar();
        setView('detail');
      }
    } catch (error) {
      showAlert('Error', error.response?.data?.error || 'Failed to update activity');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete activity ──
  const handleDelete = async (activityId) => {
    const ok = await confirmAction('Delete', 'Are you sure you want to delete this activity?');
    if (!ok) return;
    try {
      const data = await darService.deleteActivity(activityId);
      if (data.success) {
        showAlert('Success', 'Activity deleted!');
        await refreshSelectedDar();
      }
    } catch (error) {
      showAlert('Error', error.response?.data?.error || 'Failed to delete activity');
    }
  };

  // ── Activity type name helper ──
  const getTypeName = (id) => {
    const t = activityTypes.find((x) => x.id.toString() === id.toString());
    return t ? t.name : `Activity #${id}`;
  };

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — EDIT ACTIVITY
  // ══════════════════════════════════════════════════════════════════════
  if (view === 'editActivity' && editItem) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.screenTitle}>Edit Activity</Text>
          <Card>
            {/* Activity type */}
            {activityTypes.length > 0 ? (
              Platform.OS === 'web' ? (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.label}>Activity Type</Text>
                  <select
                    value={editForm.activity_type_id || ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, activity_type_id: e.target.value }))}
                    style={styles.select}
                  >
                    <option value="">Select</option>
                    {activityTypes.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {editErrors.type && <Text style={styles.tableErrorText}>{editErrors.type}</Text>}
                </View>
              ) : (
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.label}>Activity Type</Text>
                  <TouchableOpacity style={styles.mobileSelect} onPress={() => setEditPickerOpen(true)} activeOpacity={0.8}>
                    <Text style={editForm.activity_type_id ? styles.mobileSelectText : styles.mobileSelectPlaceholder}>
                      {editForm.activity_type_id ? getTypeName(editForm.activity_type_id) : 'Select activity type'}
                    </Text>
                  </TouchableOpacity>
                  {editErrors.type && <Text style={styles.tableErrorText}>{editErrors.type}</Text>}
                  <Modal visible={editPickerOpen} transparent animationType="fade" onRequestClose={() => setEditPickerOpen(false)}>
                    <View style={styles.modalOverlay}>
                      <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Activity Type</Text>
                        <FlatList
                          data={activityTypes}
                          keyExtractor={(item) => item.id.toString()}
                          renderItem={({ item }) => (
                            <TouchableOpacity style={styles.modalItem} onPress={() => { setEditForm((f) => ({ ...f, activity_type_id: item.id.toString() })); setEditPickerOpen(false); }}>
                              <Text style={styles.modalItemText}>{item.name}</Text>
                            </TouchableOpacity>
                          )}
                          ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                        />
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setEditPickerOpen(false)}>
                          <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </Modal>
                </View>
              )
            ) : (
              <Input
                label="Activity Type ID"
                value={editForm.activity_type_id}
                onChangeText={(v) => setEditForm((f) => ({ ...f, activity_type_id: v }))}
                keyboardType="numeric"
                error={editErrors.type}
              />
            )}

            {/* Hours */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Hours</Text>
              {Platform.OS === 'web' ? (
                <select value={editForm.hours} onChange={(e) => setEditForm((f) => ({ ...f, hours: e.target.value }))} style={styles.select}>
                  {[...Array(13)].map((_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
              ) : (
                <>
                  <TouchableOpacity style={styles.mobileSelect} onPress={() => setEditHoursPickerOpen(true)} activeOpacity={0.8}>
                    <Text style={styles.mobileSelectText}>{editForm.hours || '0'} hr</Text>
                  </TouchableOpacity>
                  <Modal visible={editHoursPickerOpen} transparent animationType="fade" onRequestClose={() => setEditHoursPickerOpen(false)}>
                    <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Select Hours</Text>
                      <FlatList data={[...Array(13)].map((_, i) => i)} keyExtractor={(i) => i.toString()} renderItem={({ item: h }) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setEditForm((f) => ({ ...f, hours: h.toString() })); setEditHoursPickerOpen(false); }}>
                          <Text style={styles.modalItemText}>{h} hour{h !== 1 ? 's' : ''}</Text>
                        </TouchableOpacity>
                      )} ItemSeparatorComponent={() => <View style={styles.modalSeparator} />} />
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setEditHoursPickerOpen(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                    </View></View>
                  </Modal>
                </>
              )}
            </View>

            {/* Minutes */}
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.label}>Minutes</Text>
              {Platform.OS === 'web' ? (
                <select value={editForm.minutes} onChange={(e) => setEditForm((f) => ({ ...f, minutes: e.target.value }))} style={styles.select}>
                  <option value="0">0</option><option value="15">15</option><option value="30">30</option><option value="45">45</option>
                </select>
              ) : (
                <>
                  <TouchableOpacity style={styles.mobileSelect} onPress={() => setEditMinutesPickerOpen(true)} activeOpacity={0.8}>
                    <Text style={styles.mobileSelectText}>{editForm.minutes || '0'} min</Text>
                  </TouchableOpacity>
                  <Modal visible={editMinutesPickerOpen} transparent animationType="fade" onRequestClose={() => setEditMinutesPickerOpen(false)}>
                    <View style={styles.modalOverlay}><View style={styles.modalContent}><Text style={styles.modalTitle}>Select Minutes</Text>
                      <FlatList data={['0','15','30','45']} keyExtractor={(i) => i} renderItem={({ item: m }) => (
                        <TouchableOpacity style={styles.modalItem} onPress={() => { setEditForm((f) => ({ ...f, minutes: m })); setEditMinutesPickerOpen(false); }}>
                          <Text style={styles.modalItemText}>{m} minutes</Text>
                        </TouchableOpacity>
                      )} ItemSeparatorComponent={() => <View style={styles.modalSeparator} />} />
                      <TouchableOpacity style={styles.modalCancel} onPress={() => setEditMinutesPickerOpen(false)}><Text style={styles.modalCancelText}>Cancel</Text></TouchableOpacity>
                    </View></View>
                  </Modal>
                </>
              )}
              {editErrors.minutes && <Text style={styles.tableErrorText}>{editErrors.minutes}</Text>}
            </View>

            <Input label="Message (Optional)" value={editForm.message} onChangeText={(v) => setEditForm((f) => ({ ...f, message: v }))} placeholder="What did you work on?" />
            <Input label="Remarks (Optional)" value={editForm.remarks} onChangeText={(v) => setEditForm((f) => ({ ...f, remarks: v }))} placeholder="Any additional notes" />
          </Card>

          <View style={[styles.formActions, isDesktop && styles.formActionsDesktop]}>
            <Button title="Save Changes" onPress={handleEditSubmit} loading={submitting} compact={isDesktop} style={isDesktop ? styles.submitBtnDesktop : undefined} />
            <Button title="Cancel" variant="outline" onPress={() => setView('detail')} compact={isDesktop} style={isDesktop ? styles.cancelBtnDesktop : { marginTop: 12 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — DAR DETAIL (view activities for a date)
  // ══════════════════════════════════════════════════════════════════════
  if (view === 'detail' && selectedDar) {
    const editable = isDateAllowed(toDateString(new Date(selectedDar.date)));

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.listHeader}>
          <TouchableOpacity onPress={() => { setSelectedDar(null); setView('list'); }}>
            <Text style={styles.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{formatDate(selectedDar.date)}</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.detailMeta}>
          <View style={styles.minutesBadge}>
            <Text style={styles.minutesText}>{selectedDar.total_minutes} min total</Text>
          </View>
          {editable && (
            <Button title="+ Add Activity" onPress={() => openAddToExisting(selectedDar)} style={styles.addBtn} />
          )}
        </View>

        <FlatList
          data={selectedDar.activities || []}
          keyExtractor={(item, idx) => (item.id || idx).toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refreshSelectedDar(); setRefreshing(false); }} colors={[Colors.primary]} tintColor={Colors.primary} />}
          renderItem={({ item }) => (
            <Card>
              <View style={styles.activityRow}>
                <View style={styles.activityDot} />
                <View style={styles.activityInfo}>
                  <Text style={styles.activityName}>{item.activity_type_name || getTypeName(item.activity_type_id)}</Text>
                  <Text style={styles.activityMeta}>{item.minutes} min{item.message ? ` — ${item.message}` : ''}</Text>
                  {item.remarks ? <Text style={styles.remarksText}>Remarks: {item.remarks}</Text> : null}
                </View>
                {editable && (
                  <View style={styles.activityActions}>
                    <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(item)}>
                      <Text style={styles.editBtnText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No activities recorded</Text>
              {editable && <Text style={styles.emptyHint}>Tap "+ Add Activity" to add one</Text>}
            </View>
          }
        />
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — ADD ACTIVITIES FORM
  // ══════════════════════════════════════════════════════════════════════
  if (view === 'form') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.screenTitle}>{selectedDar ? 'Add Activities' : 'Create DAR'}</Text>

          <Card>
          {/* ── Date Picker ── */}
          <View style={styles.datePickerContainer}>
            <Text style={styles.dpLabel}>Date</Text>

            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={date}
                min={getYesterdayDate()}
                max={getTodayDate()}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  border: `1px solid ${errors.date ? Colors.error : Colors.border}`,
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 16,
                  color: Colors.black,
                  backgroundColor: Colors.white,
                  outline: 'none',
                  width: isDesktop ? 240 : '100%',
                  height: 44,
                  cursor: 'pointer',
                }}
              />
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.dpButton, errors.date && styles.dpButtonError]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dpButtonText}>
                    {date === getTodayDate()
                      ? `Today  (${date})`
                      : `Yesterday  (${date})`}
                  </Text>
                  <Text style={styles.dpChevron}>▼</Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={new Date(date + 'T00:00:00')}
                    mode="date"
                    display="default"
                    minimumDate={new Date(getYesterdayDate() + 'T00:00:00')}
                    maximumDate={new Date(getTodayDate()    + 'T00:00:00')}
                    onChange={(event, selected) => {
                      setShowDatePicker(false);
                      if (selected && event.type !== 'dismissed') setDate(toDateString(selected));
                    }}
                  />
                )}
              </>
            )}

            {errors.date ? (
              <Text style={styles.dpErrorText}>{errors.date}</Text>
            ) : null}
          </View>

          {/* Desktop Table Layout */}
          {isDesktop ? (
            <View style={styles.tableContainer}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.activityNumCol]}>#</Text>
                <Text style={[styles.tableHeaderCell, styles.activityTypeCol]}>Activity Type</Text>
                <Text style={[styles.tableHeaderCell, styles.hoursCol]}>Hours</Text>
                <Text style={[styles.tableHeaderCell, styles.minutesCol]}>Minutes</Text>
                <Text style={[styles.tableHeaderCell, styles.messageCol]}>Message (Optional)</Text>
                <Text style={[styles.tableHeaderCell, styles.remarksCol]}>Remarks (Optional)</Text>
                <Text style={[styles.tableHeaderCell, styles.actionsCol]}>Actions</Text>
              </View>

              {activities.map((activity, index) => (
                <View key={index} style={styles.tableRow}>
                  <View style={[styles.tableCell, styles.activityNumCol]}>
                    <Text style={styles.activityNumber}>{index + 1}</Text>
                  </View>
                  
                  <View style={[styles.tableCell, styles.activityTypeCol]}>
                    {activityTypes && activityTypes.length > 0 ? (
                      <select
                        value={activity.activity_type_id || ''}
                        onChange={(e) => updateActivity(index, 'activity_type_id', e.target.value)}
                        style={styles.select}
                      >
                        <option value="">Select</option>
                        {activityTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    ) : (
                      <TextInput
                        style={[
                          styles.tableInput,
                          errors[`activity_${index}_type`] && styles.tableInputError,
                        ]}
                        value={activity.activity_type_id}
                        onChangeText={(val) => updateActivity(index, 'activity_type_id', val)}
                        placeholder="e.g. 1"
                        keyboardType="numeric"
                      />
                    )}
                    {errors[`activity_${index}_type`] && (
                      <Text style={styles.tableErrorText}>{errors[`activity_${index}_type`]}</Text>
                    )}
                  </View>
                  
                  <View style={[styles.tableCell, styles.hoursCol]}>
                    <select
                      value={activity.hours || '0'}
                      onChange={(e) => updateActivity(index, 'hours', e.target.value)}
                      style={styles.select}
                    >
                      {[...Array(13)].map((_, i) => (
                        <option key={i} value={i}>{i}</option>
                      ))}
                    </select>
                  </View>
                  
                  <View style={[styles.tableCell, styles.minutesCol]}>
                    <select
                      value={activity.minutes || '0'}
                      onChange={(e) => updateActivity(index, 'minutes', e.target.value)}
                      style={styles.select}
                    >
                      <option value="0">0</option>
                      <option value="15">15</option>
                      <option value="30">30</option>
                      <option value="45">45</option>
                    </select>
                    {errors[`activity_${index}_minutes`] && (
                      <Text style={styles.tableErrorText}>{errors[`activity_${index}_minutes`]}</Text>
                    )}
                  </View>
                  
                  <View style={[styles.tableCell, styles.messageCol]}>
                    <TextInput
                      style={styles.tableInput}
                      value={activity.message}
                      onChangeText={(val) => updateActivity(index, 'message', val)}
                      placeholder="What did you work on?"
                      multiline
                    />
                  </View>
                  
                  <View style={[styles.tableCell, styles.remarksCol]}>
                    <TextInput
                      style={styles.tableInput}
                      value={activity.remarks}
                      onChangeText={(val) => updateActivity(index, 'remarks', val)}
                      placeholder="Any additional notes"
                      multiline
                    />
                  </View>
                  
                  <View style={[styles.tableCell, styles.actionsCol]}>
                    <View style={styles.actionButtonsRow}>
                      {activities.length > 1 && (
                        <Button
                          title="✖"
                          variant="outline"
                          onPress={() => removeActivity(index)}
                          style={[styles.iconBtn, styles.iconBtnDelete]}
                          textStyle={styles.tableRemoveBtnText}
                          compact={true}
                        />
                      )}

                      {index === activities.length - 1 && (
                        <Button
                          title="＋"
                          variant="outline"
                          onPress={addActivity}
                          style={[styles.iconBtn, styles.iconBtnAdd]}
                          textStyle={styles.tableAddBtnText}
                          compact={true}
                        />
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            /* Mobile Stacked Layout */
            <>
              {activities.map((activity, index) => (
                <View key={index} style={styles.activityForm}>
                  <View style={styles.activityFormHeader}>
                    <Text style={styles.activityFormTitle}>Activity {index + 1}</Text>
                    {activities.length > 1 && (
                      <Button
                        title="Remove"
                        variant="outline"
                        onPress={() => removeActivity(index)}
                        style={styles.removeBtn}
                        textStyle={styles.removeBtnText}
                      />
                    )}
                  </View>

                  {activityTypes && activityTypes.length > 0 ? (
                    <>
                      <TouchableOpacity
                        style={styles.mobileSelect}
                        onPress={() => setPickerOpenIndex(index)}
                        activeOpacity={0.8}
                      >
                        <Text style={activity.activity_type_id ? styles.mobileSelectText : styles.mobileSelectPlaceholder}>
                          {activity.activity_type_id
                            ? (activityTypes.find((t) => t.id.toString() === activity.activity_type_id)?.name || activity.activity_type_id)
                            : 'Select activity type'}
                        </Text>
                      </TouchableOpacity>
                      {errors[`activity_${index}_type`] && (
                        <Text style={styles.tableErrorText}>{errors[`activity_${index}_type`]}</Text>
                      )}

                      <Modal
                        visible={pickerOpenIndex === index}
                        transparent
                        animationType="fade"
                        onRequestClose={() => setPickerOpenIndex(null)}
                      >
                        <View style={styles.modalOverlay}>
                          <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Select Activity Type</Text>
                            <FlatList
                              data={activityTypes}
                              keyExtractor={(item) => item.id.toString()}
                              renderItem={({ item }) => (
                                <TouchableOpacity
                                  style={styles.modalItem}
                                  onPress={() => {
                                    updateActivity(index, 'activity_type_id', item.id.toString());
                                    setPickerOpenIndex(null);
                                  }}
                                >
                                  <Text style={styles.modalItemText}>{item.name}</Text>
                                </TouchableOpacity>
                              )}
                              ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                            />
                            <TouchableOpacity style={styles.modalCancel} onPress={() => setPickerOpenIndex(null)}>
                              <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </Modal>
                    </>
                  ) : (
                    <Input
                      label="Activity Type"
                      value={activity.activity_type_id}
                      onChangeText={(val) => updateActivity(index, 'activity_type_id', val)}
                      placeholder="e.g. 1"
                      keyboardType="numeric"
                      error={errors[`activity_${index}_type`]}
                    />
                  )}

                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Hours</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.mobileSelect}>
                        <select
                          value={activity.hours || '0'}
                          onChange={(e) => updateActivity(index, 'hours', e.target.value)}
                          style={styles.mobileSelectInput}
                        >
                          {[...Array(13)].map((_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.mobileSelect}
                          onPress={() => setHoursPickerIndex(index)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.mobileSelectText}>{activity.hours || '0'} hr</Text>
                        </TouchableOpacity>
                        <Modal
                          visible={hoursPickerIndex === index}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setHoursPickerIndex(null)}
                        >
                          <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                              <Text style={styles.modalTitle}>Select Hours</Text>
                              <FlatList
                                data={[...Array(13)].map((_, i) => i)}
                                keyExtractor={(item) => item.toString()}
                                renderItem={({ item: h }) => (
                                  <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                      updateActivity(index, 'hours', h.toString());
                                      setHoursPickerIndex(null);
                                    }}
                                  >
                                    <Text style={styles.modalItemText}>{h} hour{h !== 1 ? 's' : ''}</Text>
                                  </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                              />
                              <TouchableOpacity style={styles.modalCancel} onPress={() => setHoursPickerIndex(null)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Modal>
                      </>
                    )}
                  </View>

                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.label}>Minutes</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.mobileSelect}>
                        <select
                          value={activity.minutes || '0'}
                          onChange={(e) => updateActivity(index, 'minutes', e.target.value)}
                          style={styles.mobileSelectInput}
                        >
                          <option value="0">0</option>
                          <option value="15">15</option>
                          <option value="30">30</option>
                          <option value="45">45</option>
                        </select>
                      </View>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={styles.mobileSelect}
                          onPress={() => setMinutesPickerIndex(index)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.mobileSelectText}>{activity.minutes || '0'} min</Text>
                        </TouchableOpacity>
                        <Modal
                          visible={minutesPickerIndex === index}
                          transparent
                          animationType="fade"
                          onRequestClose={() => setMinutesPickerIndex(null)}
                        >
                          <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                              <Text style={styles.modalTitle}>Select Minutes</Text>
                              <FlatList
                                data={['0', '15', '30', '45']}
                                keyExtractor={(item) => item}
                                renderItem={({ item: m }) => (
                                  <TouchableOpacity
                                    style={styles.modalItem}
                                    onPress={() => {
                                      updateActivity(index, 'minutes', m);
                                      setMinutesPickerIndex(null);
                                    }}
                                  >
                                    <Text style={styles.modalItemText}>{m} minutes</Text>
                                  </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.modalSeparator} />}
                              />
                              <TouchableOpacity style={styles.modalCancel} onPress={() => setMinutesPickerIndex(null)}>
                                <Text style={styles.modalCancelText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </Modal>
                      </>
                    )}
                    {errors[`activity_${index}_minutes`] && (
                      <Text style={styles.tableErrorText}>{errors[`activity_${index}_minutes`]}</Text>
                    )}
                  </View>

                  <Input
                    label="Message (Optional)"
                    value={activity.message}
                    onChangeText={(val) => updateActivity(index, 'message', val)}
                    placeholder="What did you work on?"
                  />

                  <Input
                    label="Remarks (Optional)"
                    value={activity.remarks}
                    onChangeText={(val) => updateActivity(index, 'remarks', val)}
                    placeholder="Any additional notes"
                  />
                </View>
              ))}

              <Button
                title="+ Add Activity"
                variant="outline"
                onPress={addActivity}
                style={styles.addActivityBtn}
              />
            </>
          )}
        </Card>

        <View style={[styles.formActions, isDesktop && styles.formActionsDesktop]}>
          <Button
            title="Submit DAR"
            onPress={handleSubmit}
            loading={submitting}
            compact={isDesktop}
            style={isDesktop ? styles.submitBtnDesktop : undefined}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => { selectedDar ? setView('detail') : setView('list'); }}
            compact={isDesktop}
            style={isDesktop ? styles.cancelBtnDesktop : { marginTop: 12 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  }

  // ══════════════════════════════════════════════════════════════════════
  // RENDER — DAR LIST (default employee view)
  // ══════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Daily Activity Reports</Text>
        <Button
          title="+ New DAR"
          onPress={openNewForm}
          style={styles.newBtn}
        />
      </View>

      <FlatList
        data={dars}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.8} onPress={() => { setSelectedDar(item); setView('detail'); }}>
            <Card>
              <View style={styles.darHeader}>
                <Text style={styles.darDate}>{formatDate(item.date)}</Text>
                <View style={styles.minutesBadge}>
                  <Text style={styles.minutesText}>{item.total_minutes} min</Text>
                </View>
              </View>
              <Text style={styles.activityCountText}>
                {item.activities?.length || 0} activit{(item.activities?.length || 0) === 1 ? 'y' : 'ies'} — tap to view
              </Text>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No DAR entries yet</Text>
            <Text style={styles.emptyHint}>Tap "+ New DAR" to create one</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ROOT — role switch
// ═══════════════════════════════════════════════════════════════════════════
const DARScreen = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return isAdmin ? <AdminDARView /> : <EmployeeDARView />;
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: Colors.lightGray,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.black,
  },
  backBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  newBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  addBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    minHeight: 36,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  // ── DAR card ──
  darHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  darDate: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
  },
  darEmployee: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  activityCountText: {
    fontSize: 13,
    color: Colors.darkGray,
    marginTop: 4,
  },
  minutesBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  minutesText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  // ── Detail meta ──
  detailMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 4,
  },
  detailMetaText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
  },
  // ── Activity row ──
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  activityInfo: {
    flex: 1,
  },
  activityName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
  },
  activityMeta: {
    fontSize: 13,
    color: Colors.darkGray,
    marginTop: 2,
  },
  remarksText: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
    fontStyle: 'italic',
  },
  activityActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
    paddingTop: 2,
  },
  editBtn: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1565C0',
  },
  deleteBtn: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.error,
  },
  // ── Admin dropdown ──
  dropdownSection: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  dropdownLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 4,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
    marginHorizontal: 20,
    marginBottom: 4,
    marginTop: 4,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderRadius: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dateHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
  },
  employeeGroup: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: Colors.white,
    borderRadius: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  customPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    minHeight: 48,
  },
  customPickerText: {
    fontSize: 16,
    color: Colors.black,
  },
  customPickerChevron: {
    fontSize: 12,
    color: Colors.primary,
  },
  // ── Form ──
  formContent: {
    padding: 20,
    paddingBottom: 100,
  },
  activityForm: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 16,
    marginTop: 12,
  },
  activityFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  activityFormTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.black,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    borderColor: Colors.error,
  },
  removeBtnText: {
    fontSize: 13,
    color: Colors.error,
  },
  addActivityBtn: {
    marginTop: 12,
  },
  formActions: {
    marginTop: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.black,
  },
  headerSpacer: {
    height: 64,
  },
  emptyHint: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 4,
  },
  // Table Layout Styles
  tableContainer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.black,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'flex-start',
  },
  tableCell: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activityNumCol: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTypeCol: {
    width: 220,
  },
  hoursCol: {
    width: 110,
  },
  minutesCol: {
    width: 110,
  },
  messageCol: {
    flex: 1,
    minWidth: 140,
  },
  remarksCol: {
    flex: 1,
    minWidth: 140,
  },
  actionsCol: {
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
  },
  tableInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.black,
    backgroundColor: Colors.white,
    minHeight: 38,
  },
  select: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: Colors.black,
    backgroundColor: Colors.white,
    minHeight: 38,
    width: '100%',
  },
  mobileSelect: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    minHeight: 44,
    justifyContent: 'center',
  },
  mobileSelectInput: {
    width: '100%',
    border: 'none',
    outline: 'none',
    fontSize: 16,
    backgroundColor: 'transparent',
    color: Colors.black,
  },
  mobileSelectText: {
    fontSize: 16,
    color: Colors.black,
  },
  mobileSelectPlaceholder: {
    fontSize: 16,
    color: Colors.gray,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    overflow: 'hidden',
    paddingBottom: 24,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalItem: {
    padding: 12,
  },
  modalItemText: {
    fontSize: 15,
  },
  modalSeparator: {
    height: 1,
    backgroundColor: Colors.border,
  },
  modalCancel: {
    padding: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 6,
  },
  tableInputError: {
    borderColor: Colors.error,
  },
  tableErrorText: {
    fontSize: 11,
    color: Colors.error,
    marginTop: 4,
  },
  tableRemoveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 32,
    borderColor: Colors.error,
    width: 40,
  },
  tableRemoveBtnText: {
    fontSize: 16,
    color: Colors.error,
  },
  addActivityBtnTable: {
    margin: 12,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDelete: {
    borderColor: Colors.error,
  },
  iconBtnAdd: {
    borderColor: Colors.primary,
  },
  tableAddBtnText: {
    fontSize: 16,
    color: Colors.primary,
  },
  formActionsDesktop: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 18,
  },
  submitBtnDesktop: {
    minWidth: 120,
  },
  cancelBtnDesktop: {
    minWidth: 120,
  },
  // ── Date Picker ────────────────────────────────────────────────────
  datePickerContainer: {
    marginBottom: 16,
  },
  dpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
    marginBottom: 6,
  },
  dpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.white,
    minHeight: 44,
  },
  dpButtonError: {
    borderColor: Colors.error,
  },
  dpButtonText: {
    fontSize: 16,
    color: Colors.black,
  },
  dpChevron: {
    fontSize: 12,
    color: Colors.gray,
  },
  dpErrorText: {
    fontSize: 12,
    color: Colors.error,
    marginTop: 4,
  },
});

export default DARScreen;
