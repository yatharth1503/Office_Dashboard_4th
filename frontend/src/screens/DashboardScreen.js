import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Colors } from '../theme';
import { Button, Card } from '../components';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context';

const DashboardScreen = () => {
  const { user, logout } = useAuth();
  const navigation = useNavigation();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Info Card */}
        <Card>
          <Text style={styles.cardTitle}>Profile Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={styles.infoValue}>{user?.name}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Role</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>
                {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
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

        {/* Logout Button */}
        <Button
          title="Logout"
          onPress={logout}
          variant="outline"
          style={styles.logoutButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.lightGray,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.darkRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.black,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  roleBadge: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 12,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 32,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
    marginTop: 4,
  },
  statHint: {
    fontSize: 12,
    color: Colors.gray,
    marginTop: 2,
  },
  logoutButton: {
    marginTop: 8,
  },
});

export default DashboardScreen;
