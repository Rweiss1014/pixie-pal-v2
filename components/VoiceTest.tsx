import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import VoiceInput from './VoiceInput';
import { VoiceService } from '../services/VoiceService';

export default function VoiceTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [lastTranscription, setLastTranscription] = useState('');
  const voiceService = VoiceService.getInstance();

  const handleVoiceResult = async (audioUri: string) => {
    try {
      setIsLoading(true);
      console.log('🎤 Processing voice input...');

      // Test transcription
      const transcription = await voiceService.transcribeAudio(audioUri);
      setLastTranscription(transcription);
      
      // Test text-to-speech
      const testResponse = `You said: ${transcription}`;
      await voiceService.speakText(testResponse);
      
      Alert.alert('Voice Test Success!', `Transcription: "${transcription}"`);
    } catch (error) {
      console.error('Voice test error:', error);
      Alert.alert('Voice Test Failed', (error as Error).message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎤 Voice Feature Test</Text>
      
      <VoiceInput 
        onVoiceResult={handleVoiceResult}
        isLoading={isLoading}
      />
      
      {lastTranscription ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Last Transcription:</Text>
          <Text style={styles.resultText}>"{lastTranscription}"</Text>
        </View>
      ) : (
        <Text style={styles.instructionText}>
          Hold the button and say something to test!
        </Text>
      )}
      
      {isLoading && (
        <Text style={styles.loadingText}>
          ✨ Processing your voice...
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F5FF',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 40,
    color: '#4facfe',
  },
  resultContainer: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#4facfe',
    maxWidth: '100%',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4facfe',
    marginBottom: 10,
  },
  resultText: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#4facfe',
    fontWeight: '600',
    marginTop: 20,
  },
});