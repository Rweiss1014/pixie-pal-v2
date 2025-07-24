import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pixiePalData } from '../services/PixiePalDataService';
import { LinearGradient } from 'expo-linear-gradient';

// Types
interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  showFeedback?: boolean;
  feedback?: {
    type: 'positive' | 'negative';
    comment?: string;
    timestamp: Date;
  };
}

interface Attraction {
  id: string;
  name: string;
  waitTime: number;
  isOpen: boolean;
  hasLightningLane?: boolean;
  park: string;
  land?: string;
}

interface Entertainment {
  id: string;
  name: string;
  type: string;
  times: string[];
  location: string;
  duration?: number;
}

interface CharacterMeet {
  characters?: string[];
  character?: string;
  location: string;
  times?: string[];
  time?: string;
  type: 'character-meet';
  lastUpdated: string;
  park?: string;
}

type ParkId = 'magicKingdom' | 'epcot' | 'hollywoodStudios' | 'animalKingdom';
type ExtendedParkId = ParkId | 'disneySprings' | 'resorts';

const PARK_NAMES: Record<ExtendedParkId, string> = {
  magicKingdom: 'Magic Kingdom',
  epcot: 'EPCOT', 
  hollywoodStudios: "Disney's Hollywood Studios",
  animalKingdom: "Disney's Animal Kingdom",
  disneySprings: 'Disney Springs',
  resorts: 'Resorts'
};

// PARK ABBREVIATION FUNCTION
const getParkAbbreviation = (park: ExtendedParkId): string => {
  const abbreviations: Record<ExtendedParkId, string> = {
    magicKingdom: 'MK',
    epcot: 'EP',
    hollywoodStudios: 'HS',
    animalKingdom: 'AK',
    disneySprings: 'DS',
    resorts: 'RS'
  };
  return abbreviations[park];
};

const PARKS: Array<{id: ExtendedParkId; name: string; icon: string; color: string}> = [
  { id: 'magicKingdom', name: 'Magic Kingdom', icon: '🏰', color: '#4facfe' },
  { id: 'epcot', name: 'EPCOT', icon: '🌐', color: '#4F9ECD' },
  { id: 'hollywoodStudios', name: 'Hollywood Studios', icon: '🎬', color: '#E74C3C' },
  { id: 'animalKingdom', name: 'Animal Kingdom', icon: '🌳', color: '#27AE60' },
  { id: 'disneySprings', name: 'Disney Springs', icon: '🛍️', color: '#F39C12' },
  { id: 'resorts', name: 'Resorts', icon: '🏨', color: '#9B59B6' },
];

const ATTRACTION_TO_PARK: Record<string, ParkId> = {
  'space mountain': 'magicKingdom',
  'pirates of the caribbean': 'magicKingdom',
  'haunted mansion': 'magicKingdom',
  'big thunder mountain': 'magicKingdom',
  'seven dwarfs mine train': 'magicKingdom',
  'tiana\'s bayou adventure': 'magicKingdom',
  'jungle cruise': 'magicKingdom',
  'splash mountain': 'magicKingdom',
  'tron lightcycle run': 'magicKingdom',
  'guardians of the galaxy': 'epcot',
  'test track': 'epcot',
  'spaceship earth': 'epcot',
  'frozen ever after': 'epcot',
  'soarin': 'epcot',
  'mission space': 'epcot',
  'rise of the resistance': 'hollywoodStudios',
  'millennium falcon': 'hollywoodStudios',
  'tower of terror': 'hollywoodStudios',
  'rock n roller coaster': 'hollywoodStudios',
  'slinky dog dash': 'hollywoodStudios',
  'mickey and minnie\'s runaway railway': 'hollywoodStudios',
  'avatar flight of passage': 'animalKingdom',
  'expedition everest': 'animalKingdom',
  'kilimanjaro safaris': 'animalKingdom',
  'dinosaur': 'animalKingdom',
  'navi river journey': 'animalKingdom'
};

const { width: screenWidth } = Dimensions.get('window');

const formatTime = (militaryTime: string): string => {
  if (!militaryTime || !militaryTime.includes(':')) return militaryTime;
  
  const [hours, minutes] = militaryTime.split(':');
  const hour24 = parseInt(hours);
  
  if (hour24 === 0) return `12:${minutes} AM`;
  if (hour24 < 12) return `${hour24}:${minutes} AM`;
  if (hour24 === 12) return `12:${minutes} PM`;
  return `${hour24 - 12}:${minutes} PM`;
};

const formatDate = (dateString: string): string => {
  if (!dateString || !dateString.includes('-')) return dateString;
  
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${month}-${day}-${year}`;
  }
  return dateString;
};

const analyzeQuery = (input: string) => {
  const lower = input.toLowerCase();
  
  return {
    isTimeQuery: lower.includes('time') || lower.includes('hours') || lower.includes('open') || lower.includes('close'),
    isSpecificLocationTime: lower.includes('fairytale hall') || lower.includes('princess fairytale hall') || lower.includes('fairy hall') || lower.includes('theater') || lower.includes('sideshow'),
    isCharacterQuery: (lower.includes('character') || lower.includes('meet') || lower.includes('mickey') || 
                      (lower.includes('princess') && !lower.includes('fairytale') && !lower.includes('fairy hall') && !lower.includes('princess fairytale hall'))),
    isSpecificCharacterLocation: lower.includes('fairytale hall') || lower.includes('princess fairytale hall') || lower.includes('fairy hall') || lower.includes('town square theater') || lower.includes('pete\'s silly sideshow'),
    isEntertainmentQuery: lower.includes('show') || lower.includes('parade') || lower.includes('firework') || lower.includes('entertainment'),
    isFireworksQuery: lower.includes('firework'),
    isShowQuery: (lower.includes('show') && !lower.includes('firework') && !lower.includes('parade')),
    isParadeQuery: lower.includes('parade'),
    isAttractionQuery: lower.includes('ride') || lower.includes('attraction') || lower.includes('wait'),
    isCrossParks: lower.includes('flight of passage') || lower.includes('rise of the resistance') || lower.includes('frozen ever after'),
    targetPark: (lower.includes('mk') || lower.includes('magic kingdom')) ? ('magicKingdom' as ExtendedParkId) :
                (lower.includes('epcot') || lower.includes('ep')) ? ('epcot' as ExtendedParkId) :
                (lower.includes('hollywood') || lower.includes('hs')) ? ('hollywoodStudios' as ExtendedParkId) :
                (lower.includes('animal') || lower.includes('ak')) ? ('animalKingdom' as ExtendedParkId) : null
  };
};

export default function PixiePalChat() {
  const [currentPark, setCurrentPark] = useState<ExtendedParkId>('magicKingdom');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [allAttractions, setAllAttractions] = useState<Attraction[]>([]);
  const [allEntertainment, setAllEntertainment] = useState<any[]>([]);
  const [allParkHours, setAllParkHours] = useState<any[]>([]);
  const [allCharacterMeets, setAllCharacterMeets] = useState<CharacterMeet[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [conversationContext, setConversationContext] = useState<string[]>([]);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [parkSelectorVisible, setParkSelectorVisible] = useState(true);

  // Keyboard visibility detection
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      setParkSelectorVisible(false);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      setParkSelectorVisible(true);
    });

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  const toggleParkSelector = () => {
    setParkSelectorVisible(!parkSelectorVisible);
  };

  useEffect(() => {
    loadAttractions();
    addWelcomeMessage();
  }, []);

  const addWelcomeMessage = () => {
    const welcomeMessage: Message = {
      id: `welcome_${Date.now()}`,
      text: "🏰 Welcome to the magic! I'm Pixie Pal!\n\n✨ I know EVERYTHING about Disney World:\n🎢 Live wait times\n🎭 Show schedules  \n🍽️ Dining reservations\n⚡ Lightning Lane tips\n\nReady to make some Disney magic? What's your first question! 🌟",
      isUser: false,
      timestamp: new Date(),
      showFeedback: true
    };
    setMessages([welcomeMessage]);
  };

  const handleFeedback = async (messageId: string, feedbackType: 'positive' | 'negative', comment?: string) => {
    setMessages(prev => prev.map(msg => 
      msg.id === messageId 
        ? { ...msg, feedback: { type: feedbackType, comment, timestamp: new Date() } }
        : msg
    ));
    
    const feedbackData = {
      messageId,
      feedbackType,
      comment,
      timestamp: new Date().toISOString(),
      park: currentPark,
      messageText: messages.find(m => m.id === messageId)?.text?.substring(0, 100)
    };
    
    console.log('📊 Feedback received:', feedbackData);
    
    try {
      const existingFeedback = await AsyncStorage.getItem('pixie_pal_feedback');
      const feedbackArray = existingFeedback ? JSON.parse(existingFeedback) : [];
      feedbackArray.push(feedbackData);
      await AsyncStorage.setItem('pixie_pal_feedback', JSON.stringify(feedbackArray));
      console.log('✅ Feedback saved locally');
    } catch (error) {
      console.log('❌ Error saving feedback:', error);
    }
  };

  const FeedbackComponent = ({ message }: { message: Message }) => {
    if (message.feedback) {
      return (
        <View style={styles.feedbackCompleted}>
          <Text style={styles.feedbackCompletedText}>Thanks! 💫</Text>
        </View>
      );
    }

    return (
      <View style={styles.feedbackContainer}>
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => handleFeedback(message.id, 'positive')}
        >
          <Text style={styles.feedbackButtonText}>👍</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.feedbackButton}
          onPress={() => handleFeedback(message.id, 'negative')}
        >
          <Text style={styles.feedbackButtonText}>👎</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const loadAttractions = async () => {
    try {
      setIsLoading(true);
      
      const parks = [
        { id: 'magicKingdom' as ParkId, name: 'magic-kingdom' },
        { id: 'epcot' as ParkId, name: 'epcot' },
        { id: 'hollywoodStudios' as ParkId, name: 'hollywood-studios' },
        { id: 'animalKingdom' as ParkId, name: 'animal-kingdom' }
      ];

      const allData: Attraction[] = [];
      const allEntertainment: any[] = [];
      const allParkHours: any[] = [];
      const allCharacterMeets: CharacterMeet[] = [];

      for (const park of parks) {
        try {
          console.log(`🔍 Fetching real data for ${park.name}...`);
          
          const data = await pixiePalData.getWaitTimes(park.id);
          
          let entertainmentData = null;
          try {
            console.log(`🎭 Fetching ENHANCED entertainment for ${park.name} directly from proxy...`);
            const response = await fetch(`https://disney-data-proxy.onrender.com/api/disney/entertainment/${park.name}`);
            if (response.ok) {
              entertainmentData = await response.json();
              console.log(`🎭 Enhanced entertainment data received for ${park.name}:`, entertainmentData?.entertainment?.length || 0, 'items');
            }
          } catch (entertainmentError) {
            console.log(`⚠️ Entertainment data not available for ${park.name}:`, entertainmentError);
          }
          
          let characterMeetData = null;
          try {
            console.log(`🧚‍♀️ Fetching character meets for ${park.name} directly from proxy...`);
            const characterResponse = await fetch(`https://disney-data-proxy.onrender.com/api/disney/character-meets/${park.name}`);
            if (characterResponse.ok) {
              characterMeetData = await characterResponse.json();
            }
          } catch (characterError) {
            console.log(`⚠️ Character meet data not available for ${park.name}:`, characterError);
          }
          
          let parkHoursData = null;
          try {
            console.log(`🕐 Fetching park hours for ${park.name} directly from proxy...`);
            const hoursResponse = await fetch(`https://disney-data-proxy.onrender.com/api/disney/park-hours/${park.name}`);
            if (hoursResponse.ok) {
              parkHoursData = await hoursResponse.json();
            }
          } catch (hoursError) {
            console.log(`⚠️ Park hours not available for ${park.name}:`, hoursError);
          }
          
          if (data && data.attractions && data.attractions.length > 0) {
            console.log(`✅ Got ${data.attractions.length} attractions from ${park.name}`);
            const parkAttractions = data.attractions.map((attraction: any) => ({
              id: `${park.name}-${attraction.id}`,
              name: attraction.name,
              waitTime: attraction.waitTime || 0,
              isOpen: attraction.isOpen || true,
              hasLightningLane: attraction.fastPassAvailable || attraction.hasLightningLane || false,
              park: park.id,
              land: attraction.land
            }));
            allData.push(...parkAttractions);
          }

          if (entertainmentData && entertainmentData.entertainment) {
            console.log(`🎭 Processing ${entertainmentData.entertainment.length} entertainment items from ${park.name}`);
            
            const showTypes = entertainmentData.entertainment.map((show: any) => show.type).filter(Boolean);
            const uniqueTypes = [...new Set(showTypes)];
            console.log(`🎭 Entertainment types for ${park.name}:`, uniqueTypes);
            
            allEntertainment.push({
              park: park.id,
              entertainment: entertainmentData.entertainment
            });
          }

          if (characterMeetData && characterMeetData.characterMeets) {
            console.log(`🧚‍♀️ Got ${characterMeetData.characterMeets.length} character meets from ${park.name}`);
            const parkCharacterMeets = characterMeetData.characterMeets.map((meet: any) => ({
              ...meet,
              park: park.id
            }));
            allCharacterMeets.push(...parkCharacterMeets);
          }

          if (parkHoursData) {
            console.log(`🕐 Got park hours for ${park.name}`);
            allParkHours.push({
              park: park.id,
              hours: parkHoursData
            });
          }
          
        } catch (error) {
          console.log(`❌ Failed to get ${park.name} data:`, error);
        }
      }

      if (allData.length > 0) {
        setAllAttractions(allData);
        setAllEntertainment(allEntertainment);
        setAllParkHours(allParkHours);
        setAllCharacterMeets(allCharacterMeets);
        
        console.log(`✅ LOADED ENHANCED DISNEY DATA:`);
        console.log(`📊 TOTAL: ${allData.length} attractions`);
        console.log(`🏰 Magic Kingdom: ${allData.filter(a => a.park === 'magicKingdom').length} attractions`);
        console.log(`🌐 EPCOT: ${allData.filter(a => a.park === 'epcot').length} attractions`);
        console.log(`🎬 Hollywood Studios: ${allData.filter(a => a.park === 'hollywoodStudios').length} attractions`);
        console.log(`🌳 Animal Kingdom: ${allData.filter(a => a.park === 'animalKingdom').length} attractions`);
        console.log(`🎭 ENHANCED Entertainment: ${allEntertainment.length} parks with shows`);
        allEntertainment.forEach(park => {
          console.log(`  - ${park.park}: ${park.entertainment.length} entertainment items`);
        });
        console.log(`🧚‍♀️ Character Meets: ${allCharacterMeets.length} total character meets`);
        console.log(`🕐 Park Hours: ${allParkHours.length} parks with hours`);
      }
    } catch (error) {
      console.log('❌ Error loading attractions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tryPatternMatch = (input: string, contextPark?: ExtendedParkId): string | null => {
    const lowerInput = input.toLowerCase();
    const effectivePark = contextPark || currentPark;
    const analysis = analyzeQuery(input);

    for (const [rideName, parkId] of Object.entries(ATTRACTION_TO_PARK)) {
      if (lowerInput.includes(rideName)) {
        const attraction = allAttractions.find(a => 
          a.park === parkId && 
          a.name.toLowerCase().includes(rideName)
        );
        
        if (attraction) {
          if (parkId !== currentPark) {
            setCurrentPark(parkId);
            console.log(`🔄 Auto-switched to ${PARK_NAMES[parkId]} for ${rideName}`);
          }
          
          if (lowerInput.includes('wait') || lowerInput.includes('how long') || lowerInput.includes('open') || !lowerInput.includes('where')) {
            const lightningLane = attraction.hasLightningLane ? ' ⚡ Lightning Lane available!' : '';
            return `🎢 **${attraction.name}** currently has a **${attraction.waitTime} minute wait**!${lightningLane}\n\n🏰 Located at ${PARK_NAMES[parkId]} in ${attraction.land || 'the park'}! ${parkId !== effectivePark ? '(Switched parks for you!) ' : ''}✨`;
          } else {
            return `🎢 **${attraction.name}** is located at ${PARK_NAMES[parkId]} in ${attraction.land || 'the park'}! ${parkId !== effectivePark ? '(Switched parks for you!) ' : ''}✨`;
          }
        } else {
          if (parkId !== effectivePark) {
            setCurrentPark(parkId);
            console.log(`🔄 Auto-switched to ${PARK_NAMES[parkId]} for ${rideName}`);
            return `🎢 ${rideName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} is located at ${PARK_NAMES[parkId]}! I've switched you to the correct park. ✨\n\nTry asking about it again for current wait times!`;
          }
        }
      }
    }

    if (effectivePark === 'disneySprings') {
      if (analysis.isTimeQuery) {
        return `🕐 **Disney Springs Hours:**\n\n⏰ **Typical:** 10:00 AM - 11:00 PM\n📱 **Status:** Open daily\n\n✨ Individual shop and restaurant hours may vary. Check the Disney World app for specific store hours!`;
      }
      return `🛍️ **Disney Springs** is Disney's shopping and dining district! I don't have live data for Springs yet, but it's open daily from 10 AM to 11 PM. Check the Disney World app for specific store and restaurant information! ✨`;
    }

    if (effectivePark === 'resorts') {
      return `🏨 **Disney Resort Hotels** are available 24/7 for guests! I don't have specific resort data yet, but you can check the Disney World app or call your resort directly for amenities, dining reservations, and transportation schedules! ✨`;
    }

    if (analysis.isTimeQuery && !analysis.isSpecificLocationTime) {
      const parkName = PARK_NAMES[effectivePark];
      const parkHoursData = allParkHours.find(p => p.park === effectivePark);
      
      if (parkHoursData && parkHoursData.hours && parkHoursData.hours.hours && parkHoursData.hours.hours.length > 0) {
        const todayHours = parkHoursData.hours.hours[0];
        let response = `🕐 **${parkName} Hours:**\n\n`;
        
        if (todayHours.openingTime && todayHours.closingTime) {
          const openTime = formatTime(todayHours.openingTime);
          const closeTime = formatTime(todayHours.closingTime);
          response += `📅 **Today:** ${openTime} - ${closeTime}\n`;
        }
        
        if (todayHours.date) {
          response += `📆 **Date:** ${formatDate(todayHours.date)}\n`;
        }
        
        if (parkHoursData.hours.hours.length > 1) {
          const tomorrowHours = parkHoursData.hours.hours[1];
          const tomorrowOpen = formatTime(tomorrowHours.openingTime);
          const tomorrowClose = formatTime(tomorrowHours.closingTime);
          response += `📅 **Tomorrow:** ${tomorrowOpen} - ${tomorrowClose}\n`;
        }
        
        response += `\n✨ These are today's official operating hours! Have a magical day! 🏰`;
        return response;
      } else {
        const generalHours: Record<ExtendedParkId, string> = {
          magicKingdom: "9:00 AM - 10:00 PM",
          epcot: "9:00 AM - 9:00 PM", 
          hollywoodStudios: "9:00 AM - 9:00 PM",
          animalKingdom: "8:00 AM - 8:00 PM",
          disneySprings: "10:00 AM - 11:00 PM",
          resorts: "24/7 for guests"
        };

        const hours = generalHours[effectivePark];
        return `🕐 **${parkName} Hours:**\n\n⏰ **Typical:** ${hours}\n\n✨ Check the Disney World app for today's exact hours!`;
      }
    }

    return null;
  };

  const processUserInput = async (input: string): Promise<string> => {
    setConversationContext(prev => [...prev.slice(-4), input]);
    
    const analysis = analyzeQuery(input);
    
    let targetPark: ExtendedParkId = analysis.targetPark || currentPark;
    
    if (targetPark !== currentPark) {
      setCurrentPark(targetPark);
      console.log(`🔄 Switched to ${PARK_NAMES[targetPark]}`);
    }

    const patternResult = tryPatternMatch(input, targetPark);
    if (patternResult) {
      console.log('🟢 Using pattern matching (free)');
      return patternResult;
    }

    if (targetPark === 'disneySprings' || targetPark === 'resorts') {
      if (targetPark === 'disneySprings') {
        return `🛍️ **Disney Springs** is Disney's shopping and dining district!\n\n📍 **What's there:** World-class shopping, amazing restaurants, live entertainment\n🕐 **Hours:** 10:00 AM - 11:00 PM daily\n🚗 **Parking:** Free parking available\n\n✨ Check the Disney World app for specific store and restaurant hours!`;
      } else {
        return `🏨 **Disney Resort Hotels** offer magical accommodations!\n\n🏰 **Deluxe Resorts:** Grand Floridian, Polynesian, Contemporary\n🌟 **Moderate Resorts:** Port Orleans, Caribbean Beach, Coronado Springs\n💰 **Value Resorts:** All-Star Movies/Music/Sports, Pop Century, Art of Animation\n\n✨ Each resort has unique theming, dining, and transportation to the parks!`;
      }
    }

    try {
      console.log('🤖 Using TRUE AI with OpenAI and enhanced real data context');
      
      const currentParkAttractions = allAttractions.filter(a => a.park === targetPark);
      const currentParkEntertainment = allEntertainment.find(e => e.park === targetPark)?.entertainment || [];
      const currentParkCharacters = allCharacterMeets.filter(meet => meet.park === targetPark);
      
      const attractionsContext = currentParkAttractions.map(a => 
        `${a.name} (${a.land || 'park'}) - ${a.waitTime} min wait${a.hasLightningLane ? ' (Lightning Lane available)' : ''}${!a.isOpen ? ' (CLOSED)' : ''}`
      ).join('\n');
      
      const entertainmentContext = currentParkEntertainment.length > 0
        ? currentParkEntertainment.map((e: any) => {
            const times = e.times?.join(', ') || 'Times vary';
            const location = e.location || e.land || 'Multiple locations';
            const type = e.type ? `[${e.type}]` : '';
            return `${e.name} ${type} - ${times} (${location})`;
          }).join('\n')  
        : 'No scheduled entertainment found';

      const characterContext = currentParkCharacters.length > 0
        ? currentParkCharacters.map(meet => {
            const characters = meet.characters?.join(', ') || meet.character || 'Character';
            const times = meet.times?.join(', ') || meet.time || 'Check times';
            return `${characters} - ${meet.location} (${times})`;
          }).join('\n')
        : 'No character meet data available';

      const aiPrompt = `You are Pixie Pal, a Disney assistant! 🏰

CONTEXT:
- Current Park: ${PARK_NAMES[targetPark]}
- User Question: "${input}"

LIVE ${PARK_NAMES[targetPark]} DATA:

ATTRACTIONS & WAIT TIMES:
${attractionsContext}

ENHANCED ENTERTAINMENT & SHOWS:
${entertainmentContext}

CHARACTER MEETS:
${characterContext}

RESPONSE RULES:
1. Be specific and direct - don't ask for clarification
2. Use exact location names from the data
3. Include times when available
4. Don't greet (we're already talking)
5. Focus on exactly what they asked for

Answer the user's question using this enhanced Disney data!`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY || ''}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: aiPrompt
            }
          ],
          max_tokens: 800,
          temperature: 0.1
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API failed: ${response.status}`);
      }

      const aiData = await response.json();
      const aiResponse = aiData.choices[0]?.message?.content || 'I had a magical moment processing that! ✨';

      console.log('✅ Enhanced OpenAI response received');
      return aiResponse;
      
    } catch (error) {
      console.log('❌ OpenAI error, falling back to enhanced smart responses:', error);
      
      const currentParkAttractions = allAttractions.filter(a => a.park === targetPark);
      const currentParkCharacters = allCharacterMeets.filter(meet => meet.park === targetPark);
      const currentParkEntertainment = allEntertainment.find(e => e.park === targetPark)?.entertainment || [];
      
      if (analysis.isEntertainmentQuery && currentParkEntertainment.length > 0) {
        let response = `🎭 **Entertainment at ${PARK_NAMES[targetPark]}:**\n\n`;
        const entertainmentShows = currentParkEntertainment.filter((show: any) => 
          !show.type?.includes('character-meet')
        ).slice(0, 5);
        
        entertainmentShows.forEach((show: any) => {
          const times = show.times?.join(', ') || 'Check times';
          response += `🎪 **${show.name}** - ${times}\n`;
        });
        return response + `\n✨ Enhanced entertainment data! Check Disney app for updates! 🎭`;
      }
      
      if (analysis.isCharacterQuery && currentParkCharacters.length > 0) {
        let response = `🧚‍♀️ **Character Meets at ${PARK_NAMES[targetPark]}:**\n\n`;
        currentParkCharacters.slice(0, 3).forEach(meet => {
          const characters = meet.characters?.join(', ') || meet.character || 'Character';
          const times = meet.times?.join(', ') || meet.time || 'Check times';
          response += `✨ **${characters}** at ${meet.location} (${times})\n`;
        });
        return response + `\n💫 Character times can change - arrive early! ✨`;
      }
      
      if (analysis.isAttractionQuery && currentParkAttractions.length > 0) {
        const list = currentParkAttractions.slice(0, 5).map(a => 
          `🎢 ${a.name} - ${a.waitTime} min${a.hasLightningLane ? ' ⚡' : ''}`
        ).join('\n');
        return `🏰 **${PARK_NAMES[targetPark]} Top Attractions:**\n\n${list}\n\n✨ Live wait times updated regularly!`;
      }
      
      return `✨ I'm having a magical moment with the AI! But I have enhanced data including ${currentParkAttractions.length} attractions, ${currentParkEntertainment.length} entertainment shows, and ${currentParkCharacters.length} character meets at ${PARK_NAMES[targetPark]}. Try asking "show me all rides", "what shows are happening", or "character meets"! 🏰`;
    }
  };

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    
    if (!textToSend) {
      console.log('❌ No text to send');
      return;
    }

    if (isLoading) {
      console.log('⏳ Already processing, please wait...');
      return;
    }

    console.log('✅ Proceeding with send:', textToSend);

    const userMessage: Message = {
      id: `user_${Date.now()}_${Math.random()}`,
      text: textToSend,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await processUserInput(userMessage.text);
      
      const aiMessage: Message = {
        id: `ai_${Date.now()}_${Math.random()}`,
        text: response,
        isUser: false,
        timestamp: new Date(),
        showFeedback: true
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.log('❌ Error processing message:', error);
      
      const errorMessage: Message = {
        id: `error_${Date.now()}_${Math.random()}`,
        text: "Something magical went wrong! ✨ Try asking me about wait times or park hours!",
        isUser: false,
        timestamp: new Date(),
        showFeedback: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Bold text formatter for React Native
  const formatBoldText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2);
        return (
          <Text key={index} style={{ fontWeight: 'bold' }}>
            {boldText}
          </Text>
        );
      }
      return part;
    });
  };

  const formatTimeDisplay = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeContainer}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* SMART COLLAPSIBLE HEADER WITH GRADIENT */}
        <TouchableOpacity style={styles.magicalHeaderContainer} onPress={toggleParkSelector} activeOpacity={0.8}>
          <LinearGradient
            colors={['#4facfe', '#ff0080']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.magicalHeader}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <View style={styles.pixieIcon}>
                  <Text style={styles.pixieIconText}>🧚‍♀️</Text>
                </View>
                <View>
                  <Text style={styles.headerTitle}>Pixie Pal</Text>
                  <Text style={styles.headerSubtitle}>
                    {parkSelectorVisible ? PARK_NAMES[currentPark] : getParkAbbreviation(currentPark)} {parkSelectorVisible ? '⌄' : '⌃'}
                  </Text>
                </View>
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.magicStar}>⭐</Text>
                <Text style={styles.liveText}>Live Magic</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* COLLAPSIBLE PARK SELECTOR */}
        {parkSelectorVisible && (
          <View style={styles.parkSelectorContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.parkScrollContainer}
            >
              {PARKS.map((park) => (
                <TouchableOpacity
                  key={park.id}
                  style={styles.parkButton}
                  onPress={() => {
                    setCurrentPark(park.id);
                    console.log(`🏰 Switched to ${park.name}`);
                    if (keyboardVisible) {
                      setParkSelectorVisible(false);
                    }
                  }}
                >
                  {currentPark === park.id ? (
                    <LinearGradient
                      colors={['#4facfe', '#ff0080']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activeParkGradient}
                    >
                      <Text style={styles.parkEmoji}>{park.icon}</Text>
                      <Text style={styles.activeParkName}>
                        {park.name}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.inactiveParkButton}>
                      <Text style={styles.parkEmoji}>{park.icon}</Text>
                      <Text style={styles.parkName}>
                        {park.name}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* MAGICAL CHAT MESSAGES */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
        >
          {messages.map((message) => (
            <View key={message.id} style={styles.messageWrapper}>
              <View
                style={[
                  styles.messageContainer,
                  message.isUser ? styles.userMessage : styles.aiMessage
                ]}
              >
                {!message.isUser && (
                  <View style={styles.aiMessageHeader}>
                    <View style={styles.aiAvatar}>
                      <Text style={styles.aiAvatarText}>🧚‍♀️</Text>
                    </View>
                    <Text style={styles.aiName}>Pixie Pal</Text>
                  </View>
                )}
                
                <View style={[
                  styles.messageBubble,
                  message.isUser ? styles.userBubble : styles.aiBubble
                ]}>
                  {!message.isUser && (
                    <View style={styles.magicCorner}>
                      <Text style={styles.magicCornerText}>✨</Text>
                    </View>
                  )}
                  
                  {message.isUser ? (
                    <LinearGradient
                      colors={['#4facfe', '#ff0080']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.userMessageGradient}
                    >
                      <Text style={styles.userMessageText}>
                        {message.text}
                      </Text>
                      <Text style={styles.messageTime}>
                        {formatTimeDisplay(message.timestamp)} 🕐
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View>
                      <Text style={styles.aiMessageText}>
                        {formatBoldText(message.text)}
                      </Text>
                      <Text style={styles.messageTime}>
                        {formatTimeDisplay(message.timestamp)} 🕐
                      </Text>
                    </View>
                  )}
                </View>

                {!message.isUser && message.showFeedback && (
                  <FeedbackComponent message={message} />
                )}
              </View>
            </View>
          ))}
          
          {isLoading && (
            <View style={[styles.messageContainer, styles.aiMessage]}>
              <View style={styles.loadingContainer}>
                <View style={styles.loadingDots}>
                  <View style={[styles.loadingDot, styles.loadingDot1]} />
                  <View style={[styles.loadingDot, styles.loadingDot2]} />
                  <View style={[styles.loadingDot, styles.loadingDot3]} />
                </View>
                <Text style={styles.loadingText}>Sprinkling pixie dust...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* MAGICAL INPUT AREA */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask me anything magical! ✨"
              placeholderTextColor="#B19CD9"
              multiline
              onSubmitEditing={() => sendMessage()}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <LinearGradient
                colors={!inputText.trim() || isLoading ? ['#ccc', '#ccc'] : ['#4facfe', '#ff0080']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButtonGradient}
              >
                <Text style={styles.sendButtonText}>✨</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  
  // FIXED HEADER STYLES
  magicalHeaderContainer: {
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  magicalHeader: {
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pixieIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#fff',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    transform: [{ rotate: '12deg' }],
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  pixieIconText: {
    fontSize: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#E1C4F7',
    fontSize: 11,
    fontWeight: '600',
  },
  headerRight: {
    alignItems: 'center',
  },
  magicStar: {
    fontSize: 24,
    color: '#FFD700',
  },
  liveText: {
    color: '#E1C4F7',
    fontSize: 10,
    fontWeight: '600',
  },

  // PARK SELECTOR STYLES
  parkSelectorContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(79, 172, 254, 0.2)',
  },
  parkScrollContainer: {
    paddingHorizontal: 16,
  },
  parkButton: {
    marginRight: 12,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    minWidth: 80,
    overflow: 'hidden',
  },
  activeParkGradient: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
  },
  inactiveParkButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  parkEmoji: {
    fontSize: 16,
    marginBottom: 2,
  },
  parkName: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#333',
    lineHeight: 12,
  },
  activeParkName: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#fff',
    lineHeight: 12,
  },

  // MESSAGE STYLES
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F8F5FF',
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 20,
  },
  messageWrapper: {
    marginVertical: 8,
  },
  messageContainer: {
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  aiMessageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiAvatar: {
    width: 28,
    height: 28,
    backgroundColor: '#4facfe',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  aiAvatarText: {
    fontSize: 12,
  },
  aiName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4facfe',
  },
  messageBubble: {
    borderRadius: 20,
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    overflow: 'hidden',
  },
  userBubble: {
    // Gradient applied via component
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#A7EFFF',
    padding: 12,
  },
  userMessageGradient: {
    padding: 12,
  },
  magicCorner: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 1,
  },
  magicCornerText: {
    fontSize: 10,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  userMessageText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  aiMessageText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 10,
    marginTop: 8,
    opacity: 0.7,
    fontWeight: '500',
  },

  // FEEDBACK STYLES
  feedbackContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    paddingLeft: 6,
  },
  feedbackButton: {
    marginHorizontal: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
  },
  feedbackButtonText: {
    fontSize: 14,
  },
  feedbackCompleted: {
    marginTop: 6,
    paddingLeft: 6,
  },
  feedbackCompletedText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4facfe',
  },

  // LOADING STYLES
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#A7EFFF',
  },
  loadingDots: {
    flexDirection: 'row',
    marginRight: 12,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4facfe',
    marginHorizontal: 2,
  },
  loadingDot1: {
    opacity: 1,
  },
  loadingDot2: {
    opacity: 0.7,
  },
  loadingDot3: {
    opacity: 0.4,
  },
  loadingText: {
    color: '#4facfe',
    fontStyle: 'italic',
    fontWeight: '600',
  },

  // INPUT STYLES
  inputContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 3,
    borderTopColor: '#4facfe',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#A7EFFF',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    fontWeight: '600',
    color: '#333',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  sendButtonText: {
    fontSize: 18,
  },
});