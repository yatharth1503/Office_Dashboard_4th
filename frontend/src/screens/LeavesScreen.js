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
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { Colors } from '../theme';
import { Button, Input, Card } from '../components';
import { leaveService } from '../services';
import { useAuth } from '../context';
import DateTimePicker from '@react-native-community/datetimepicker';

// ── Date Helpers ─────────────────────────────────────────────────────────
const toDateString = (d) => d.toISOString().split('T')[0];

const getTodayDate = () => toDateString(new Date());

const isFutureOrToday = (dateStr) => dateStr >= getTodayDate();

const dateToObj = (dateStr) => new Date(dateStr + 'T00:00:00');

// ── Status helpers ────────────────────────────────────────────────────────
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

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

// Status options for modal
const statusOptions = [
  { label: 'Pending', value: 'pending', color: Colors.darkGray },
  { label: 'Approved', value: 'approved', color: Colors.success },
  { label: 'Rejected', value: 'rejected', color: Colors.error },
];

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ═══════════════════════════════════════════════════════════════════════════
const AdminLeavesView = () => {
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalItem, setStatusModalItem] = useState(null);

  const fetchLeaves = useCallback(async (empId) => {
    try {
      setLoading(true);
      const data = await leaveService.getAllLeaves(empId || undefined);
      if (data.success) setLeaves(data.data);
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const data = await leaveService.getEmployees();
      if (data.success) setEmployees(data.data);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
    fetchLeaves('');
  }, [fetchEmployees, fetchLeaves]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaves(selectedEmployeeId);
  };

  const handleEmployeeChange = (empId) => {
    setSelectedEmployeeId(empId);
    fetchLeaves(empId);
  };

  const handleStatusChange = async (leaveId, newStatus) => {
    setUpdatingId(leaveId);
    try {
      const data = await leaveService.updateStatus(leaveId, newStatus);
      if (data.success) {
        setLeaves((prev) =>
          prev.map((l) => (l.id === leaveId ? { ...l, status: newStatus } : l))
        );
      }
    } catch (error) {
      const msg =
        error.response?.data?.error || 'Failed to update leave status';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const renderLeaveItem = ({ item }) => {
    const statusColor = getStatusColor(item.status);
    const isUpdating = updatingId === item.id;

    return (
      <Card>
        <Text style={styles.employeeName}>{item.user_name}</Text>

        <View style={styles.leaveHeader}>
          <Text style={styles.leaveDate}>
            {formatDate(item.from_date)} — {formatDate(item.to_date)}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        {item.reason ? (
          <Text style={styles.reason}>{item.reason}</Text>
        ) : null}

        <View style={styles.pickerWrapper}>
          <Text style={styles.pickerLabel}>Update Status:</Text>
          {Platform.OS === 'web' ? (
            <select
              value={item.status || 'pending'}
              disabled={isUpdating}
              onChange={(e) => handleStatusChange(item.id, e.target.value)}
              style={{
                border: `1px solid ${Colors.border}`,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 14,
                color: Colors.black,
                backgroundColor: Colors.white,
                cursor: isUpdating ? 'not-allowed' : 'pointer',
                opacity: isUpdating ? 0.5 : 1,
                marginTop: 4,
              }}
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          ) : (
            <TouchableOpacity
              style={[
                styles.customPickerButton,
                isUpdating && styles.customPickerButtonDisabled,
              ]}
              onPress={() => !isUpdating && setStatusModalItem(item)}
              disabled={isUpdating}
              activeOpacity={0.8}
            >
              <Text style={[styles.customPickerText, isUpdating && styles.customPickerTextDisabled]}>
                {item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'Pending'}
              </Text>
              <Text style={styles.customPickerChevron}>▼</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    );
  };

  const sectionTitle = selectedEmployeeId
    ? `${employees.find((e) => e.id.toString() === selectedEmployeeId.toString())?.name || 'Employee'}'s Leaves`
    : 'Latest 10 Leave Requests';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.screenTitle}>Leave Management</Text>
      </View>

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
            <option value="">All Employees </option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
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
                : 'All Employees '}
            </Text>
            <Text style={styles.customPickerChevron}>▼</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.sectionLabel}>{sectionTitle}</Text>

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
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🗓️</Text>
              <Text style={styles.emptyText}>No leave requests found</Text>
            </View>
          ) : null
        }
      />
      <EmployeeModal
        visible={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        employees={employees}
        onSelect={handleEmployeeChange}
      />
      <StatusModal
        visible={!!statusModalItem}
        onClose={() => setStatusModalItem(null)}
        onSelect={(value) => {
          if (statusModalItem) {
            handleStatusChange(statusModalItem.id, value);
            setStatusModalItem(null);
          }
        }}
      />
    </SafeAreaView>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// MODALS FOR CUSTOM DROPDOWNS
// ═══════════════════════════════════════════════════════════════════════════
const EmployeeModal = ({ visible, onClose, employees, onSelect }) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Select Employee</Text>
        <FlatList
          data={[{ id: '', name: 'All Employees' }, ...employees]}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                onSelect(item.id);
                onClose();
              }}
            >
              <Text style={styles.modalItemText}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Text style={styles.modalCloseText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const StatusModal = ({ visible, onClose, onSelect }) => (
  <Modal visible={visible} animationType="slide" transparent={true}>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>Update Status</Text>
        <FlatList
          data={statusOptions}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.modalItem}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
            >
              <Text style={[styles.modalItemText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.modalClose} onPress={onClose}>
          <Text style={styles.modalCloseText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

// ═══════════════════════════════════════════════════════════════════════════
// EMPLOYEE VIEW  (unchanged behaviour)
// ═══════════════════════════════════════════════════════════════════════════
const EmployeeLeavesView = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

// ═══════════════════════════════════════════════════════════════════════════
// ROOT COMPONENT — picks the right view based on role
// ═══════════════════════════════════════════════════════════════════════════
const LeavesScreen = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return isAdmin ? <AdminLeavesView /> : <EmployeeLeavesView />;
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
  // ── Admin dropdown ──────────────────────────────────────────────────────
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
  nativePickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    marginTop: 4,
  },
  nativePicker: {
    height: 48,
    color: Colors.black,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.darkGray,
    marginHorizontal: 20,
    marginBottom: 4,
    marginTop: 4,
  },
  // ── Leave card ──────────────────────────────────────────────────────────
  employeeName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
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
  // ── Status picker (inside card) ─────────────────────────────────────────
  pickerWrapper: {
    marginTop: 12,
  },
  pickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.darkGray,
    marginBottom: 2,
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
  customPickerButtonDisabled: {
    opacity: 0.5,
  },
  customPickerText: {
    fontSize: 16,
    color: Colors.black,
  },
  customPickerTextDisabled: {
    color: Colors.gray,
  },
  customPickerChevron: {
    fontSize: 12,
    color: Colors.primary,
  },
  // ── Modal styles ───────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  modalItemText: {
    fontSize: 16,
    color: Colors.black,
  },
  modalClose: {
    marginTop: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  // ── Form ────────────────────────────────────────────────────────────────
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
  // ── Date Picker ─────────────────────────────────────────────────────────
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

