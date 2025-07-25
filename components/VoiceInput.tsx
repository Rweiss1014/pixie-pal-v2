import React, { useState, useRef } from 'react';
import { 
  TouchableOpacity, 
  Text, 
  View, 
  StyleSheet, 
  Animated 
} from 'react-native';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceInputProps {
  onVoiceResult: (audioUri: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function VoiceInput({ onVoiceResult, isLoading, disabled }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Request audio permissions
  const requestPermissions = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Failed to request audio permissions:', error);
      return false;
    }
  };

  // Start recording animation
  const startRecordingAnimation = () => {
    // Scale down button
    Animated.spring(scaleAnim, {
      toValue: 0.9,
      useNativeDriver: true,
    }).start();

    // Pulse animation for recording
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  // Stop recording animation
  const stopRecordingAnimation = () => {
    // Reset scale
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();

    // Stop pulse
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  };

  // Start recording
  const startRecording = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        console.error('Audio permission not granted');
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Create recording
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      startRecordingAnimation();
      
      console.log('🎤 Recording started...');
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  // Stop recording
  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      stopRecordingAnimation();
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (uri) {
        console.log('🎤 Recording finished:', uri);
        onVoiceResult(uri);
      }
      
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Handle press in (start recording)
  const handlePressIn = () => {
    if (disabled || isLoading) return;
    startRecording();
  };

  // Handle press out (stop recording)
  const handlePressOut = () => {
    if (!isRecording) return;
    stopRecording();
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.buttonContainer,
          {
            transform: [
              { scale: scaleAnim },
              { scale: isRecording ? pulseAnim : 1 }
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.voiceButton}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled || isLoading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              isRecording 
                ? ['#ff4444', '#ff0080'] // Red gradient when recording
                : disabled || isLoading
                ? ['#ccc', '#ccc'] // Gray when disabled
                : ['#4facfe', '#ff0080'] // Blue-pink gradient normally
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buttonIcon}>
              {isLoading ? '✨' : isRecording ? '🎤' : '🎤'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
      
      {/* Recording indicator */}
      {isRecording && (
        <View style={styles.recordingIndicator}>
          <View style={styles.recordingDot} />
          <Text style={styles.recordingText}>Hold to ask Pixie Pal...</Text>
        </View>
      )}
      
      {/* Instructions */}
      {!isRecording && !isLoading && (
        <Text style={styles.instructionText}>
          Hold to ask Pixie Pal
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonContainer: {
    marginBottom: 8,
  },
  voiceButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  gradientButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonIcon: {
    fontSize: 24,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '600',
  },
  instructionText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
});