// PixiePalNotificationService.js - Reservation Alert System
// Day 6 implementation for push notifications and reservation monitoring

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { pixiePalData } from './services/PixiePalDataService';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export class PixiePalNotificationService {
  constructor() {
    this.storageKeys = {
      userPreferences: 'pixie_pal_notification_preferences',
      activeAlerts: 'pixie_pal_active_alerts',
      notificationHistory: 'pixie_pal_notification_history',
      pushToken: 'pixie_pal_push_token'
    };
    
    this.alertTypes = {
      LOW_WAIT_TIME: 'low_wait_time',
      RIDE_REOPENED: 'ride_reopened',
      PARK_HOURS_EXTENDED: 'park_hours_extended',
      RESERVATION_AVAILABLE: 'reservation_available'
    };
    
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  // ===========================================
  // INITIALIZATION & PERMISSIONS
  // ===========================================

  async initialize() {
    console.log('🧚‍♀️ Initializing Pixie Pal Notifications...');
    
    try {
      // Request permissions
      const { status } = await Notifications.requestPermissionsAsync();
      
      if (status !== 'granted') {
        throw new Error('Notification permissions not granted');
      }

      // Get push token for remote notifications
      const token = await Notifications.getExpoPushTokenAsync();
      await AsyncStorage.setItem(this.storageKeys.pushToken, token.data);
      
      console.log('✅ Notifications initialized successfully');
      return { success: true, token: token.data };
      
    } catch (error) {
      console.error('❌ Failed to initialize notifications:', error);
      return { success: false, error: error.message };
    }
  }

  // ===========================================
  // USER PREFERENCES MANAGEMENT
  // ===========================================

  async saveUserPreferences(preferences) {
    const defaultPreferences = {
      enableAlerts: true,
      maxWaitTime: 30,
      favoriteRides: [],
      preferredParks: ['magicKingdom'],
      alertTypes: [
        this.alertTypes.LOW_WAIT_TIME,
        this.alertTypes.RIDE_REOPENED
      ],
      quietHours: {
        enabled: true,
        startTime: '22:00',
        endTime: '08:00'
      },
      alertFrequency: 'moderate',
      soundEnabled: true,
      vibrationEnabled: true
    };

    const userPrefs = { ...defaultPreferences, ...preferences };
    
    await AsyncStorage.setItem(
      this.storageKeys.userPreferences,
      JSON.stringify(userPrefs)
    );
    
    console.log('✅ User preferences saved');
    return userPrefs;
  }

  async getUserPreferences() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKeys.userPreferences);
      
      if (stored) {
        return JSON.parse(stored);
      }
      
      return await this.saveUserPreferences({});
      
    } catch (error) {
      console.error('Error loading user preferences:', error);
      return await this.saveUserPreferences({});
    }
  }

  // ===========================================
  // ALERT MONITORING SYSTEM
  // ===========================================

  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already active');
      return;
    }

    console.log('🚀 Starting reservation alert monitoring...');
    
    const preferences = await this.getUserPreferences();
    
    if (!preferences.enableAlerts) {
      console.log('📴 Alerts disabled in preferences');
      return;
    }

    this.isMonitoring = true;
    await this.checkForAlerts();
    
    const intervals = {
      low: 15 * 60 * 1000,
      moderate: 10 * 60 * 1000,
      high: 5 * 60 * 1000
    };
    
    const interval = intervals[preferences.alertFrequency] || intervals.moderate;
    
    this.monitoringInterval = setInterval(async () => {
      if (this.isMonitoring) {
        await this.checkForAlerts();
      }
    }, interval);
    
    console.log(`✅ Monitoring started (checking every ${interval / 60000} minutes)`);
  }

  async stopMonitoring() {
    console.log('⏹️ Stopping alert monitoring...');
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('✅ Monitoring stopped');
  }

  async checkForAlerts() {
    try {
      const preferences = await this.getUserPreferences();
      
      if (!preferences.enableAlerts || this.isQuietHours(preferences)) {
        return;
      }

      console.log('🔍 Checking for alert opportunities...');
      
      const opportunities = await pixiePalData.checkForReservationOpportunities(preferences);
      
      if (opportunities.length > 0) {
        for (const opportunity of opportunities) {
          await this.processAlertOpportunity(opportunity, preferences);
        }
      }
      
    } catch (error) {
      console.error('Error checking for alerts:', error);
    }
  }

  async processAlertOpportunity(opportunity, preferences) {
    const recentAlerts = await this.getRecentAlerts(60);
    
    const isDuplicate = recentAlerts.some(alert => 
      alert.parkId === opportunity.parkId &&
      alert.alertType === opportunity.alertType &&
      opportunity.rides.some(ride => alert.rideNames.includes(ride.name))
    );
    
    if (isDuplicate) {
      console.log('⏭️ Skipping duplicate alert');
      return;
    }

    await this.sendAlert(opportunity, preferences);
  }

  // ===========================================
  // ALERT SENDING & MANAGEMENT
  // ===========================================

  async sendAlert(opportunity, preferences) {
    try {
      const { title, body, data } = this.formatAlertMessage(opportunity);
      
      console.log(`🔔 Sending alert: ${title}`);
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: preferences.soundEnabled ? 'default' : false,
          vibrate: preferences.vibrationEnabled ? [0, 250, 250, 250] : false,
        },
        trigger: null,
      });

      await this.saveAlertToHistory({
        id: notificationId,
        title,
        body,
        data,
        parkId: opportunity.parkId,
        alertType: opportunity.alertType,
        rideNames: opportunity.rides.map(r => r.name),
        timestamp: new Date().toISOString()
      });

      console.log('✅ Alert sent successfully');
      
    } catch (error) {
      console.error('❌ Failed to send alert:', error);
    }
  }

  formatAlertMessage(opportunity) {
    const { parkName, rides, alertType } = opportunity;
    
    switch (alertType) {
      case this.alertTypes.LOW_WAIT_TIME:
        const rideNames = rides.map(r => r.name).join(', ');
        
        return {
          title: `🎢 Short Wait Alert!`,
          body: `${rideNames} ${rides.length > 1 ? 'have' : 'has'} short wait times at ${parkName}!`,
          data: {
            type: alertType,
            parkId: opportunity.parkId,
            parkName,
            rides: rides.map(r => `${r.name} (${r.waitTime}m)`),
            action: 'view_wait_times'
          }
        };
        
      default:
        return {
          title: `🧚‍♀️ Pixie Pal Alert`,
          body: `Something magical is happening at ${parkName}!`,
          data: {
            type: alertType,
            parkId: opportunity.parkId,
            parkName,
            action: 'open_app'
          }
        };
    }
  }

  // ===========================================
  // ALERT HISTORY & ANALYTICS
  // ===========================================

  async saveAlertToHistory(alert) {
    try {
      const history = await this.getAlertHistory();
      history.unshift(alert);
      
      const trimmedHistory = history.slice(0, 100);
      
      await AsyncStorage.setItem(
        this.storageKeys.notificationHistory,
        JSON.stringify(trimmedHistory)
      );
      
    } catch (error) {
      console.error('Error saving alert to history:', error);
    }
  }

  async getAlertHistory() {
    try {
      const stored = await AsyncStorage.getItem(this.storageKeys.notificationHistory);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading alert history:', error);
      return [];
    }
  }

  async getRecentAlerts(minutesBack = 60) {
    try {
      const history = await this.getAlertHistory();
      const cutoffTime = Date.now() - (minutesBack * 60 * 1000);
      
      return history.filter(alert => {
        const alertTime = new Date(alert.timestamp).getTime();
        return alertTime > cutoffTime;
      });
    } catch (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }
  }

  // ===========================================
  // UTILITY METHODS
  // ===========================================

  isQuietHours(preferences) {
    if (!preferences.quietHours?.enabled) {
      return false;
    }
    
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes();
    
    const startTime = this.parseTimeString(preferences.quietHours.startTime);
    const endTime = this.parseTimeString(preferences.quietHours.endTime);
    
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime < endTime;
    }
    
    return currentTime >= startTime && currentTime < endTime;
  }

  parseTimeString(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 100 + minutes;
  }

  async getServiceStatus() {
    try {
      const preferences = await this.getUserPreferences();
      const pushToken = await AsyncStorage.getItem(this.storageKeys.pushToken);
      
      return {
        isInitialized: !!pushToken,
        isMonitoring: this.isMonitoring,
        alertsEnabled: preferences.enableAlerts,
        isQuietHours: this.isQuietHours(preferences),
        alertFrequency: preferences.alertFrequency,
        pushToken: pushToken ? pushToken.substring(0, 20) + '...' : null,
        lastCheck: new Date().toISOString(),
        preferences: preferences
      };
    } catch (error) {
      console.error('Error getting service status:', error);
      return {
        isInitialized: false,
        isMonitoring: false,
        alertsEnabled: false,
        error: error.message
      };
    }
  }

  async testNotification() {
    console.log('🧪 Sending test notification...');
    
    const testAlert = {
      parkName: 'Magic Kingdom',
      parkId: 'magicKingdom',
      alertType: this.alertTypes.LOW_WAIT_TIME,
      rides: [
        { name: 'Space Mountain', waitTime: 15 },
        { name: 'Pirates of the Caribbean', waitTime: 10 }
      ]
    };
    
    const preferences = await this.getUserPreferences();
    await this.sendAlert(testAlert, preferences);
    
    return 'Test notification sent!';
  }
}

// Export singleton instance
export const pixiePalNotifications = new PixiePalNotificationService();

// Development helper
if (__DEV__) {
  global.pixiePalNotifications = pixiePalNotifications;
  console.log('🧪 [DEV] pixiePalNotifications available globally for debugging');
}

