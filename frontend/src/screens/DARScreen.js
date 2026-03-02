import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
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

const DARScreen = () => {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768; // Desktop breakpoint
  
  const [dars, setDars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [date, setDate] = useState(getTodayDate());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activities, setActivities] = useState([
    { activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [activityTypes, setActivityTypes] = useState([]);
  const [pickerOpenIndex, setPickerOpenIndex] = useState(null);
  const [hoursPickerIndex, setHoursPickerIndex] = useState(null);
  const [minutesPickerIndex, setMinutesPickerIndex] = useState(null);

  const fetchDars = useCallback(async () => {
    try {
      setLoading(true);
      const data = await darService.getMyDars();
      if (data.success) {
        setDars(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch DARs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDars();
  }, [fetchDars]);

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchDars();
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

    if (!date) {
      newErrors.date = 'Date is required';
    } else if (!isDateAllowed(date)) {
      newErrors.date = 'Only today or yesterday is allowed';
    }

    activities.forEach((activity, index) => {
      if (!activity.activity_type_id) {
        newErrors[`activity_${index}_type`] = 'Activity type ID required';
      }
      const totalMinutes = (parseInt(activity.hours) || 0) * 60 + (parseInt(activity.minutes) || 0);
      if (totalMinutes <= 0) {
        newErrors[`activity_${index}_minutes`] = 'Time must be greater than 0';
      }
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
        const alertMsg = 'DAR submitted successfully!';
        if (Platform.OS === 'web') {
          window.alert(alertMsg);
        } else {
          Alert.alert('Success', alertMsg);
        }
        setShowForm(false);
        setDate(getTodayDate());
        setActivities([{ activity_type_id: '', hours: '0', minutes: '0', message: '', remarks: '' }]);
        fetchDars();
      }
    } catch (error) {
      const message =
        error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.error ||
        'Failed to submit DAR';
      if (Platform.OS === 'web') {
        window.alert(message);
      } else {
        Alert.alert('Error', message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderDarItem = ({ item }) => (
    <Card>
      <View style={styles.darHeader}>
        <Text style={styles.darDate}>{formatDate(item.date)}</Text>
        <View style={styles.minutesBadge}>
          <Text style={styles.minutesText}>{item.total_minutes} min</Text>
        </View>
      </View>
      {item.activities?.map((activity, index) => (
        <View key={activity.id || index} style={styles.activityRow}>
          <View style={styles.activityDot} />
          <View style={styles.activityInfo}>
            <Text style={styles.activityName}>
              {activity.activity_type_name || `Activity #${activity.activity_type_id}`}
            </Text>
            <Text style={styles.activityMeta}>
              {activity.minutes} min
              {activity.message ? ` — ${activity.message}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.screenTitle}>Create DAR</Text>

          <Card>
          {/* ── Date Picker ── */}
          <View style={styles.datePickerContainer}>
            <Text style={styles.dpLabel}>Date</Text>

            {Platform.OS === 'web' ? (
              /* Web: native HTML date input with min/max restricted to yesterday–today */
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
              /* iOS / Android: button → native DateTimePicker modal */
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
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date(getYesterdayDate() + 'T00:00:00')}
                    maximumDate={new Date(getTodayDate()    + 'T00:00:00')}
                    onChange={(event, selected) => {
                      setShowDatePicker(Platform.OS === 'ios'); // keep open on iOS
                      if (selected) setDate(toDateString(selected));
                      if (Platform.OS !== 'ios') setShowDatePicker(false);
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

              {/* Add button moved to actions column on the last row */}
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
            onPress={() => setShowForm(false)}
            compact={isDesktop}
            style={isDesktop ? styles.cancelBtnDesktop : { marginTop: 12 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Daily Activity Reports</Text>
        <Button
          title="+ New DAR"
          onPress={() => setShowForm(true)}
          style={styles.newBtn}
        />
      </View>

      <FlatList
        data={dars}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderDarItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
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
  newBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  listContent: {
    padding: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },
  darHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  darDate: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
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
  activityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
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
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    maxHeight: '70%',
    overflow: 'hidden',
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
  picker: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 6,
    color: Colors.black,
    marginTop: 6,
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
