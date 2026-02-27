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
} from 'react-native';
import { Colors } from '../theme';
import { Button, Input, Card } from '../components';
import { darService } from '../services';

const DARScreen = () => {
  const [dars, setDars] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [activities, setActivities] = useState([
    { activity_type_id: '', minutes: '', message: '', remarks: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

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

  const onRefresh = () => {
    setRefreshing(true);
    fetchDars();
  };

  const addActivity = () => {
    setActivities((prev) => [
      ...prev,
      { activity_type_id: '', minutes: '', message: '', remarks: '' },
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
    }

    activities.forEach((activity, index) => {
      if (!activity.activity_type_id) {
        newErrors[`activity_${index}_type`] = 'Activity type ID required';
      }
      if (!activity.minutes || parseInt(activity.minutes) <= 0) {
        newErrors[`activity_${index}_minutes`] = 'Valid minutes required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    try {
      const formattedActivities = activities.map((a) => ({
        activity_type_id: parseInt(a.activity_type_id),
        minutes: parseInt(a.minutes),
        message: a.message || null,
        remarks: a.remarks || null,
      }));

      const data = await darService.create(date, formattedActivities);

      if (data.success) {
        const alertMsg = 'DAR submitted successfully!';
        if (Platform.OS === 'web') {
          window.alert(alertMsg);
        } else {
          Alert.alert('Success', alertMsg);
        }
        setShowForm(false);
        setActivities([{ activity_type_id: '', minutes: '', message: '', remarks: '' }]);
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
          <Input
            label="Date (YYYY-MM-DD)"
            value={date}
            onChangeText={setDate}
            placeholder="2026-02-27"
            error={errors.date}
          />

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

              <Input
                label="Activity Type ID"
                value={activity.activity_type_id}
                onChangeText={(val) => updateActivity(index, 'activity_type_id', val)}
                placeholder="e.g. 1"
                keyboardType="numeric"
                error={errors[`activity_${index}_type`]}
              />

              <Input
                label="Minutes"
                value={activity.minutes}
                onChangeText={(val) => updateActivity(index, 'minutes', val)}
                placeholder="e.g. 120"
                keyboardType="numeric"
                error={errors[`activity_${index}_minutes`]}
              />

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
        </Card>

        <View style={styles.formActions}>
          <Button
            title="Submit DAR"
            onPress={handleSubmit}
            loading={submitting}
          />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setShowForm(false)}
            style={{ marginTop: 12 }}
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
});

export default DARScreen;
