import * as Speech from 'expo-speech';

export class VoiceService {
  private static instance: VoiceService;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  }

  public static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  // Convert audio to text using OpenAI Whisper
  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      console.log('🎤 Transcribing audio with Whisper...');

      // Create FormData for audio upload
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'audio.m4a',
      } as any);
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API failed: ${response.status}`);
      }

      const result = await response.json();
      const transcription = result.text.trim();
      
      console.log('✅ Transcription result:', transcription);
      return transcription;
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  // Convert text to speech and play it - ADVANCED VOICE QUALITY
  async speakText(text: string): Promise<void> {
    try {
      console.log('🔊 Speaking text:', text.substring(0, 50) + '...');

      // Stop any current speech
      const isCurrentlySpeaking = await Speech.isSpeakingAsync();
      if (isCurrentlySpeaking) {
        await Speech.stop();
      }

      // Clean text for speech (remove emojis and markdown)
      const cleanText = this.cleanTextForSpeech(text);
      console.log('🔊 Clean text for speech:', cleanText);

      // Try different iOS voices for better quality
      const voiceOptions = [
        // High-quality iOS voices
        'com.apple.voice.compact.en-US.Samantha',
        'com.apple.voice.compact.en-US.Alex',
        'com.apple.ttsbundle.Samantha-compact',
        'com.apple.ttsbundle.siri_female_en-US_compact',
        'en-US-language',
      ];

      let speechWorked = false;

      // Try each voice until one works well
      for (const voice of voiceOptions) {
        try {
          console.log(`🔊 Trying voice: ${voice}`);
          
          await Speech.speak(cleanText, {
            language: 'en-US',
            pitch: 1.0,
            rate: 0.6,  // Even slower for naturalness
            volume: 1.0,
            voice: voice,
          });
          
          console.log(`✅ Success with voice: ${voice}`);
          speechWorked = true;
          break;
        } catch (voiceError) {
          console.log(`❌ Voice ${voice} failed:`, voiceError);
          continue;
        }
      }

      if (!speechWorked) {
        throw new Error('All voice options failed');
      }

    } catch (error) {
      console.error('❌ All speech attempts failed:', error);
      
      // Final fallback - most basic possible
      try {
        console.log('🔄 Final basic fallback...');
        const fallbackText = this.cleanTextForSpeech(text);
        await Speech.speak(fallbackText);
      } catch (fallbackError) {
        console.error('❌ Even basic speech failed:', fallbackError);
      }
    }
  }

  // Clean text for better speech synthesis
  private cleanTextForSpeech(text: string): string {
    return text
      // Remove emojis
      .replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
      // Remove markdown bold
      .replace(/\*\*(.*?)\*\*/g, '$1')
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Stop current speech
  async stopSpeech(): Promise<void> {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
  }

  // Check if currently speaking
  async isSpeaking(): Promise<boolean> {
    try {
      return await Speech.isSpeakingAsync();
    } catch (error) {
      console.error('Error checking speech status:', error);
      return false;
    }
  }

  // Determine if response should be spoken or just shown as text
  shouldSpeakResponse(text: string): { shouldSpeak: boolean; spokenText: string } {
    const wordCount = text.split(' ').length;
    const hasListFormat = text.includes('\n🎢') || text.includes('\n🎭') || text.includes('\n✨');

    // Long responses or lists should have a summary spoken
    if (wordCount > 50 || hasListFormat) {
      let spokenText = '';
      
      if (text.includes('Character Meets')) {
        spokenText = 'I found character meet times! Check your screen for locations and times.';
      } else if (text.includes('Entertainment') || text.includes('Shows')) {
        spokenText = 'I found show schedules! Check your screen for times and locations.';
      } else if (text.includes('Top Attractions') || text.includes('wait times')) {
        spokenText = 'I made you a list of attractions with current wait times!';
      } else if (text.includes('Hours')) {
        spokenText = text.split('\n')[0]; // Just speak the header
      } else {
        // Generic long response
        spokenText = 'I found detailed information! Check your screen for all the details.';
      }
      
      return { shouldSpeak: true, spokenText };
    }

    // Short responses should be spoken in full
    return { shouldSpeak: true, spokenText: text };
  }

  // Main voice processing function
  async processVoiceInput(audioUri: string, onTranscription: (text: string) => void): Promise<string> {
    try {
      // Step 1: Transcribe audio to text
      const transcription = await this.transcribeAudio(audioUri);
      
      // Step 2: Call the transcription callback (this will trigger your existing chat logic)
      onTranscription(transcription);
      
      return transcription;
    } catch (error) {
      console.error('❌ Voice processing error:', error);
      throw error;
    }
  }
}