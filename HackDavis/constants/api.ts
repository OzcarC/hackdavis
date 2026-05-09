import { Platform } from 'react-native';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Platform.select({
    web: 'http://localhost:3000',
    default: 'http://localhost:3000',
  });
