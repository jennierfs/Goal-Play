export interface PlayerData {
  name: string;
  position: string;
  rarity: string;
  division: string;
  divisions?: string[];
  baseStats: {
    speed: number;
    shooting: number;
    passing: number;
    defending: number;
    goalkeeping: number;
    overall: number;
  };
  statsByDivision?: Record<string, any>;
  imageUrl?: string;
}

export const REAL_PLAYERS_DATA: PlayerData[] = [
  {
    name: 'Lionel Messi',
    position: 'forward',
    rarity: 'legendary',
    division: 'primera',
    baseStats: {
      speed: 95,
      shooting: 96,
      passing: 91,
      defending: 34,
      goalkeeping: 28,
      overall: 93
    },
    imageUrl: 'https://images.pexels.com/photos/1618200/pexels-photo-1618200.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Cristiano Ronaldo',
    position: 'forward',
    rarity: 'legendary',
    division: 'primera',
    baseStats: {
      speed: 89,
      shooting: 93,
      passing: 82,
      defending: 35,
      goalkeeping: 28,
      overall: 91
    },
    imageUrl: 'https://images.pexels.com/photos/1618200/pexels-photo-1618200.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Neymar Jr',
    position: 'forward',
    rarity: 'epic',
    division: 'primera',
    baseStats: {
      speed: 91,
      shooting: 85,
      passing: 86,
      defending: 37,
      goalkeeping: 27,
      overall: 89
    },
    imageUrl: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Kevin De Bruyne',
    position: 'midfielder',
    rarity: 'epic',
    division: 'primera',
    baseStats: {
      speed: 76,
      shooting: 86,
      passing: 93,
      defending: 64,
      goalkeeping: 15,
      overall: 91
    },
    imageUrl: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Virgil van Dijk',
    position: 'defender',
    rarity: 'epic',
    division: 'primera',
    baseStats: {
      speed: 75,
      shooting: 60,
      passing: 71,
      defending: 92,
      goalkeeping: 11,
      overall: 90
    },
    imageUrl: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Generic Player 1',
    position: 'midfielder',
    rarity: 'common',
    division: 'tercera',
    baseStats: {
      speed: 65,
      shooting: 60,
      passing: 70,
      defending: 55,
      goalkeeping: 30,
      overall: 60
    },
    imageUrl: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    name: 'Generic Player 2',
    position: 'defender',
    rarity: 'common',
    division: 'segunda',
    baseStats: {
      speed: 70,
      shooting: 55,
      passing: 65,
      defending: 75,
      goalkeeping: 25,
      overall: 65
    },
    imageUrl: 'https://images.pexels.com/photos/274506/pexels-photo-274506.jpeg?auto=compress&cs=tinysrgb&w=300'
  }
];

export class RealPlayersService {
  static getPlayersByDivision(division: string): PlayerData[] {
    return REAL_PLAYERS_DATA.filter(p => p.division === division);
  }

  static getPlayerByName(name: string): PlayerData | undefined {
    return REAL_PLAYERS_DATA.find(p => p.name === name);
  }

  static getAllPlayers(): PlayerData[] {
    return REAL_PLAYERS_DATA;
  }
}
