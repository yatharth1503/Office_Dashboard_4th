import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme';
import { Button, Input, Card } from '../components';
import { leaveService } from '../services';
import DateTimePicker from '@react-native-community/datetimepicker';

// ── Date Helpers ─────────────────────────────────────────────────────────
const toDateString = (d) => d.toISOString().split('T')[0];

const getTodayDate = () => toDateString(new Date());

const isFutureOrToday = (dateStr) => dateStr >= getTodayDate();

const dateToObj = (dateStr) => new Date(dateStr + 'T00:00:00');

const LeavesScreen = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fromDate, setFromDate] = useState(getTodayDate());
  const [toDate, setToDate] = useState(getTodayDate());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoading(true);
      const data = await leaveService.getMyLeaves();
      if (data.success) {
        setLeaves(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves();
  };

  const validate = () => {
    const newErrors = {};
    const today = getTodayDate();

    if (!fromDate) {
      newErrors.fromDate = 'From date is required';
    } else if (!isFutureOrToday(fromDate)) {
      newErrors.fromDate = 'From date must be today or a future date';
    }

    if (!toDate) {
      newErrors.toDate = 'To date is required';
    } else if (!isFutureOrToday(toDate)) {
      newErrors.toDate = 'To date must be today or a future date';
    }

    if (fromDate && toDate && fromDate > toDate) {
      newErrors.toDate = 'To date must be on or after the from date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const data = await leaveService.apply(fromDate, toDate, reason || null);

      if (data.success) {
        const alertMsg = 'Leave application submitted!';
        if (Platform.OS === 'web') {
          window.alert(alertMsg);
        } else {
          Alert.alert('Success', alertMsg);
        }
        setShowForm(false);
        setFromDate(getTodayDate());
        setToDate(getTodayDate());
        setReason('');
        fetchLeaves();
      }
    } catch (error) {
      const message =
        error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.error ||
        'Failed to submit leave application';
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'rejected':
        return { bg: '#FFEBEE', text: '#C62828' };
      case 'pending':
      default:
        return { bg: '#FFF3E0', text: '#E65100' };
    }
  };

  const renderLeaveItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);

    return (
      <Card>
        <View style={styles.leaveHeader}>
          <View>
            <Text style={styles.leaveDate}>
              {formatDate(item.from_date)} — {formatDate(item.to_date)}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>
        {item.reason ? (
          <Text style={styles.reason}>{item.reason}</Text>
        ) : null}
      </Card>
    );
  };

  if (showForm) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.formContent}>
          <Text style={styles.screenTitle}>Apply for Leave</Text>

          <Card>
            {/* ── From Date ── */}
            <View style={styles.dpContainer}>
              <Text style={styles.dpLabel}>From Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={fromDate}
                  min={getTodayDate()}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFromDate(val);
                    // auto-bump toDate if it's before the new fromDate
                    if (toDate < val) setToDate(val);
                  }}
                  style={{
                    border: `1px solid ${errors.fromDate ? Colors.error : Colors.border}`,
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
                    style={[styles.dpButton, errors.fromDate && styles.dpButtonError]}
                    onPress={() => setShowFromPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dpButtonText}>{fromDate}</Text>
                    <Text style={styles.dpChevron}>▼</Text>
                  </TouchableOpacity>
                  {showFromPicker && (
                    <DateTimePicker
                      value={dateToObj(fromDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={dateToObj(getTodayDate())}
                      onChange={(event, selected) => {
                        setShowFromPicker(Platform.OS === 'ios');
                        if (selected) {
                          const s = toDateString(selected);
                          setFromDate(s);
                          if (toDate < s) setToDate(s);
                        }
                        if (Platform.OS !== 'ios') setShowFromPicker(false);
                      }}
                    />
                  )}
                </>
              )}
              {errors.fromDate ? <Text style={styles.dpErrorText}>{errors.fromDate}</Text> : null}
            </View>

            {/* ── To Date ── */}
            <View style={styles.dpContainer}>
              <Text style={styles.dpLabel}>To Date</Text>
              {Platform.OS === 'web' ? (
                <input
                  type="date"
                  value={toDate}
                  min={fromDate || getTodayDate()}
                  onChange={(e) => setToDate(e.target.value)}
                  style={{
                    border: `1px solid ${errors.toDate ? Colors.error : Colors.border}`,
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
                    style={[styles.dpButton, errors.toDate && styles.dpButtonError]}
                    onPress={() => setShowToPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.dpButtonText}>{toDate}</Text>
                    <Text style={styles.dpChevron}>▼</Text>
                  </TouchableOpacity>
                  {showToPicker && (
                    <DateTimePicker
                      value={dateToObj(toDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      minimumDate={dateToObj(fromDate || getTodayDate())}
                      onChange={(event, selected) => {
                        setShowToPicker(Platform.OS === 'ios');
                        if (selected) setToDate(toDateString(selected));
                        if (Platform.OS !== 'ios') setShowToPicker(false);
                      }}
                    />
                  )}
                </>
              )}
              {errors.toDate ? <Text style={styles.dpErrorText}>{errors.toDate}</Text> : null}
            </View>

            <Input
              label="Reason (Optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for leave"
              multiline
              numberOfLines={3}
            />
          </Card>

          <Button
            title="Submit Leave"
            onPress={handleSubmit}
            loading={submitting}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setShowForm(false)}
            style={{ marginTop: 12 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Leave Applications</Text>
        <Button
          title="+ Apply"
          onPress={() => setShowForm(true)}
          style={styles.newBtn}
        />
      </View>

      <FlatList
        data={leaves}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderLeaveItem}
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
            <Text style={styles.emptyIcon}>🗓️</Text>
            <Text style={styles.emptyText}>No leave applications</Text>
            <Text style={styles.emptyHint}>Tap "+ Apply" to submit a leave</Text>
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
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveDate: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reason: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 10,
    lineHeight: 20,
  },
  formContent: {
    padding: 20,
    paddingBottom: 100,
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
  // ── Date Picker ────────────────────────────────────────────────────
  dpContainer: {
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

export default LeavesScreen;
