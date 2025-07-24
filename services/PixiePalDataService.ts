// Unified PixiePal Data Service - Disney Proxy Only (Recommended)
// Simplifies your architecture by using ONLY your Disney proxy for everything
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Attraction {
  id: string;
  name: string;
  land?: string;
  waitTime: number;
  isOpen: boolean;
  hasLightningLane?: boolean;
  lastUpdated?: string;
  park: string;
}

interface ParkData {
  parkName: string;
  parkId: string;
  attractions: Attraction[];
  lastUpdated: string;
  source: string;
}

interface ParkHours {
  date: string;
  openingTime: string | null;
  closingTime: string | null;
  type: 'Operating' | 'Closed';
}

interface EntertainmentEvent {
  name: string;
  time?: string;
  times?: string[];  // ADD this line
  location: string;
  duration?: string | number;  // UPDATE this line
  type?: 'parade' | 'fireworks' | 'show' | 'character-meet';
}

type ParkId = 'magicKingdom' | 'epcot' | 'hollywoodStudios' | 'animalKingdom';

export class UnifiedPixiePalService {
  private disneyProxyBaseUrl: string;
  private cacheTimeout: number;

  constructor() {
    console.log('🏰 Unified Pixie Pal Service - Disney Proxy Only');
    this.disneyProxyBaseUrl = 'https://disney-data-proxy.onrender.com';
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  // SIMPLIFIED: Get wait times from your Disney proxy
  async getWaitTimes(parkId: ParkId): Promise<ParkData> {
    try {
      console.log(`🎢 Getting wait times for ${parkId} from Disney proxy...`);
      
      const parkMap = {
        magicKingdom: 'magic-kingdom',
        epcot: 'epcot',
        hollywoodStudios: 'hollywood-studios',
        animalKingdom: 'animal-kingdom'
      };
      
      const proxyParkId = parkMap[parkId];
      
      // Try your proxy's wait times endpoint first
      const waitTimesUrl = `${this.disneyProxyBaseUrl}/api/disney/wait-times/${proxyParkId}`;
      
      const response = await fetch(waitTimesUrl, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Got ${data.attractions?.length || 0} attractions from Disney proxy`);
        
        return {
          parkName: this.getParkName(parkId),
          parkId,
          attractions: this.normalizeAttractions(data.attractions || [], parkId),
          lastUpdated: new Date().toISOString(),
          source: 'disney_proxy'
        };
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.log(`❌ Disney proxy failed for ${parkId}, using fallback:`, error);
      return this.getFallbackWaitTimes(parkId);
    }
  }

  // Get park hours from your Disney proxy
  async getParkHours(parkId: ParkId): Promise<ParkHours[]> {
    try {
      console.log(`🕐 Getting park hours for ${parkId} from Disney proxy...`);
      
      const parkMap = {
        magicKingdom: 'magic-kingdom',
        epcot: 'epcot',
        hollywoodStudios: 'hollywood-studios',
        animalKingdom: 'animal-kingdom'
      };
      
      const proxyParkId = parkMap[parkId];
      const url = `${this.disneyProxyBaseUrl}/api/disney/park-hours/${proxyParkId}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Got park hours for ${parkId}`);
        return data.schedule || [];
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.log(`❌ Failed to get park hours for ${parkId}:`, error);
      return this.getFallbackParkHours(parkId);
    }
  }

  // Get entertainment from your Disney proxy
  async getEntertainment(parkId: ParkId): Promise<EntertainmentEvent[]> {
    try {
      console.log(`🎭 Getting entertainment for ${parkId} from Disney proxy...`);
      
      const parkMap = {
        magicKingdom: 'magic-kingdom',
        epcot: 'epcot',
        hollywoodStudios: 'hollywood-studios',
        animalKingdom: 'animal-kingdom'
      };
      
      const proxyParkId = parkMap[parkId];
      const url = `${this.disneyProxyBaseUrl}/api/disney/entertainment/${proxyParkId}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Got entertainment for ${parkId}`);
        return data.entertainment || [];
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.log(`❌ Failed to get entertainment for ${parkId}:`, error);
      return this.getFallbackEntertainment(parkId);
    }
  }

  // Get parade times specifically
  async getParadeTimes(parkId: ParkId): Promise<EntertainmentEvent[]> {
    try {
      console.log(`🎪 Getting parade times for ${parkId} from Disney proxy...`);
      
      const parkMap = {
        magicKingdom: 'magic-kingdom',
        epcot: 'epcot',
        hollywoodStudios: 'hollywood-studios',
        animalKingdom: 'animal-kingdom'
      };
      
      const proxyParkId = parkMap[parkId];
      const url = `${this.disneyProxyBaseUrl}/api/disney/parade-times/${proxyParkId}`;
      
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Got parade times for ${parkId}`);
        return data.parades || [];
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      console.log(`❌ Failed to get parade times for ${parkId}:`, error);
      return this.getFallbackParadeTimes(parkId);
    }
  }

  // COMPLETE: Get all park data in one call
  async getCompleteParkData(parkId: ParkId): Promise<{
    waitTimes: ParkData;
    parkHours: ParkHours[];
    entertainment: EntertainmentEvent[];
    parades: EntertainmentEvent[];
  }> {
    try {
      console.log(`🏰 Getting complete park data for ${parkId}...`);
      
      // Get all data in parallel for speed
      const [waitTimes, parkHours, entertainment, parades] = await Promise.all([
        this.getWaitTimes(parkId),
        this.getParkHours(parkId),
        this.getEntertainment(parkId),
        this.getParadeTimes(parkId)
      ]);

      console.log(`✅ Complete park data loaded for ${parkId}`);
      
      return {
        waitTimes,
        parkHours,
        entertainment,
        parades
      };
    } catch (error) {
      console.log(`❌ Error getting complete park data:`, error);
      
      // Return fallback data for everything
      return {
        waitTimes: this.getFallbackWaitTimes(parkId),
        parkHours: this.getFallbackParkHours(parkId),
        entertainment: this.getFallbackEntertainment(parkId),
        parades: this.getFallbackParadeTimes(parkId)
      };
    }
  }

  // Normalize attraction data from your proxy
  private normalizeAttractions(attractions: any[], parkId: ParkId): Attraction[] {
    return attractions.map((attraction, index) => ({
      id: `${parkId}-${attraction.id || index}`,
      name: attraction.name || 'Unknown Attraction',
      land: attraction.land || attraction.area || 'Unknown Area',
      waitTime: typeof attraction.waitTime === 'number' ? attraction.waitTime : 0,
      isOpen: attraction.isOpen !== false,
      hasLightningLane: attraction.hasLightningLane || attraction.fastPassAvailable || false,
      lastUpdated: attraction.lastUpdated || new Date().toISOString(),
      park: parkId
    }));
  }

  // Utility functions
  private getParkName(parkId: ParkId): string {
    const names = {
      magicKingdom: 'Magic Kingdom',
      epcot: 'EPCOT',
      hollywoodStudios: "Disney's Hollywood Studios",
      animalKingdom: "Disney's Animal Kingdom"
    };
    return names[parkId];
  }

  // Formatting functions for chat responses
  formatParkHours(schedule: ParkHours[]): string {
    if (!schedule || schedule.length === 0) {
      return "🕐 Park hours not available right now. Check the Disney World app for current hours! ✨";
    }

    const today = schedule[0];
    if (today.type === 'Closed') {
      return `🚫 The park is closed today. Check back tomorrow! ✨`;
    }

    const lines = [`🕐 **Park Hours Today:**`];
    
    if (today.openingTime && today.closingTime) {
      lines.push(`📅 ${today.openingTime} - ${today.closingTime}`);
    }

    if (schedule.length > 1) {
      lines.push('', '📅 **Upcoming Days:**');
      for (let i = 1; i < Math.min(4, schedule.length); i++) {
        const day = schedule[i];
        if (day.openingTime && day.closingTime) {
          lines.push(`• ${day.date}: ${day.openingTime} - ${day.closingTime}`);
        }
      }
    }

    lines.push('', '✨ Have a magical day!');
    return lines.join('\n');
  }

  formatEntertainment(events: EntertainmentEvent[]): string {
    if (!events || events.length === 0) {
      return "🎭 No entertainment schedule available right now. Check the Disney World app for showtimes! ✨";
    }

    const lines = ['🎭 **Entertainment Today:**', ''];
    
    const parades = events.filter(e => e.type === 'parade');
    const fireworks = events.filter(e => e.type === 'fireworks');
    const shows = events.filter(e => e.type === 'show');

    if (parades.length > 0) {
      lines.push('🎪 **Parades:**');
      parades.forEach(event => {
        lines.push(`• ${event.name} - ${event.time} at ${event.location}`);
      });
      lines.push('');
    }

    if (fireworks.length > 0) {
      lines.push('🎆 **Fireworks:**');
      fireworks.forEach(event => {
        lines.push(`• ${event.name} - ${event.time} at ${event.location}`);
      });
      lines.push('');
    }

    if (shows.length > 0) {
      lines.push('🎬 **Shows:**');
      shows.forEach(event => {
        lines.push(`• ${event.name} - ${event.time} at ${event.location}`);
      });
    }

    lines.push('', '✨ Check times throughout the day - schedules may change!');
    return lines.join('\n');
  }

  formatParadeTimes(parades: EntertainmentEvent[]): string {
  if (!parades || parades.length === 0) {
    return "🎪 No parades scheduled today. Check the Disney World app for updates! ✨";
  }

  const lines = ['🎪 **Parade Times Today:**', ''];
  
  parades.forEach(parade => {
    lines.push(`🎭 **${parade.name}**`);
    
    // FIX: Handle the times array from your proxy
    const timeValue = parade.times ? parade.times[0] : (parade.time || 'Check Disney app');
    lines.push(`⏰ Time: ${timeValue}`);
    
    lines.push(`📍 Location: ${parade.location}`);
    if (parade.duration) {
      const durationText = typeof parade.duration === 'number' ? `${parade.duration} minutes` : parade.duration;
      lines.push(`⏱️ Duration: ${durationText}`);
    }
    lines.push('');
  });

  lines.push('✨ Arrive early for the best viewing spots!');
  return lines.join('\n');
}

  // Fallback data (simplified - your proxy handles most cases)
  private getFallbackWaitTimes(parkId: ParkId): ParkData {
    // Simplified fallback since your proxy is reliable
    const attractions: Attraction[] = [
      {
        id: `${parkId}-fallback-1`,
        name: 'Check Disney World App',
        waitTime: 0,
        isOpen: true,
        hasLightningLane: false,
        park: parkId
      }
    ];

    return {
      parkName: this.getParkName(parkId),
      parkId,
      attractions,
      lastUpdated: new Date().toISOString(),
      source: 'fallback'
    };
  }

  private getFallbackParkHours(parkId: ParkId): ParkHours[] {
    return [
      {
        date: 'Today',
        openingTime: '9:00 AM',
        closingTime: '10:00 PM',
        type: 'Operating'
      }
    ];
  }

  private getFallbackEntertainment(parkId: ParkId): EntertainmentEvent[] {
    const fallbacks = {
      magicKingdom: [
        {
          name: 'Festival of Fantasy Parade',
          time: '3:00 PM',
          location: 'Frontierland → Main Street USA',
          duration: '20 minutes',
          type: 'parade' as const
        },
        {
          name: 'Happily Ever After',
          time: '9:00 PM',
          location: 'Cinderella Castle',
          type: 'fireworks' as const
        }
      ],
      epcot: [
        {
          name: 'EPCOT Forever',
          time: '9:00 PM',
          location: 'World Showcase Lagoon',
          type: 'fireworks' as const
        }
      ],
      hollywoodStudios: [
        {
          name: 'Fantasmic!',
          time: '8:30 PM',
          location: 'Hollywood Hills Amphitheater',
          type: 'show' as const
        }
      ],
      animalKingdom: []
    };

    return fallbacks[parkId] || [];
  }

  private getFallbackParadeTimes(parkId: ParkId): EntertainmentEvent[] {
    if (parkId === 'magicKingdom') {
      return [
        {
          name: 'Festival of Fantasy Parade',
          time: '3:00 PM',
          location: 'Frontierland → Main Street USA',
          duration: '20 minutes',
          type: 'parade'
        }
      ];
    }
    return [];
  }
}

export const pixiePalData = new UnifiedPixiePalService();