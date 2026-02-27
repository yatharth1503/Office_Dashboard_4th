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
} from 'react-native';
import { Colors } from '../theme';
import { Button, Input, Card } from '../components';
import { leaveService } from '../services';

const LeavesScreen = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
      newErrors.fromDate = 'Use YYYY-MM-DD format';
    }

    if (!toDate) {
      newErrors.toDate = 'To date is required';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      newErrors.toDate = 'Use YYYY-MM-DD format';
    }

    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      newErrors.toDate = 'To date must be after from date';
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
        setFromDate('');
        setToDate('');
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
            <Input
              label="From Date (YYYY-MM-DD)"
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="2026-03-01"
              error={errors.fromDate}
            />

            <Input
              label="To Date (YYYY-MM-DD)"
              value={toDate}
              onChangeText={setToDate}
              placeholder="2026-03-05"
              error={errors.toDate}
            />

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
});

export default LeavesScreen;
