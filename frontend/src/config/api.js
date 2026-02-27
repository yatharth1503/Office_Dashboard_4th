import { Platform } from 'react-native';

// Replace with your computer's local IP address
const LOCAL_IP = '192.168.29.97';

const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    // For Android emulator, use 10.0.2.2
    // For physical device, use your computer's local IP
    return `http://${LOCAL_IP}:5000`;
  }
  if (Platform.OS === 'ios') {
    // For physical iOS device, use your computer's local IP
    return `http://${LOCAL_IP}:5000`;
  }
  // For web/browser
  return 'http://localhost:5000';
};

export const API_BASE_URL = getBaseUrl();
