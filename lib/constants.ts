import { Player, CourseData, MatchupDefinition } from './types';

export const TEAMS = {
  BROWN: 'Team Brown',
  RUSTY: 'Team Rusty',
} as const;

export const PLAYERS: Player[] = [
  // Team Brown
  { id: 'steve',  name: 'Steve Brown', handicap: 9.7,  team: 'BROWN' },
  { id: 'bon',    name: 'Bon',         handicap: 7.7,  team: 'BROWN' },
  { id: 'jimmy',  name: 'Jimmy',       handicap: 12.7, team: 'BROWN' },
  { id: 'ben',    name: 'Ben',         handicap: 12.0, team: 'BROWN' },
  { id: 'dobs',   name: 'Dobs',        handicap: 19.3, team: 'BROWN' },
  { id: 'chet',   name: 'Chet',        handicap: 20.6, team: 'BROWN' },
  // Team Rusty
  { id: 'rusty',  name: 'Rusty',       handicap: 6.3,  team: 'RUSTY' },
  { id: 'ron',    name: 'Ron',         handicap: 13.8, team: 'RUSTY' },
  { id: 'drew',   name: 'Drew',        handicap: 13.1, team: 'RUSTY' },
  { id: 'brycen', name: 'Brycen',      handicap: 18.7, team: 'RUSTY' },
  { id: 'scott',  name: 'Scott',       handicap: 19.8, team: 'RUSTY' },
  { id: 'bryce',  name: 'Bryce',       handicap: 28.5, team: 'RUSTY' },
];

// Helper to get player by ID
export const getPlayer = (id: string): Player | undefined =>
  PLAYERS.find(p => p.id === id);

// Get all players for a team
export const getTeamPlayers = (team: 'BROWN' | 'RUSTY'): Player[] =>
  PLAYERS.filter(p => p.team === team);

// Course data with handicap index, par, and yardages
export const COURSES: Record<string, CourseData> = {
  MID_PINES: {
    id: 'MID_PINES',
    name: 'Mid Pines',
    tees: 'White',
    slope: 136,
    rating: 70.4,
    handicapIndex: [5, 15, 7, 13, 9, 1, 3, 17, 11, 2, 18, 8, 10, 16, 12, 6, 14, 4],
    par:           [4,  3, 4,  4, 5, 5, 4,  3,  4, 5,  3, 4,  3,  4,  5, 4,  4, 4],
    yardages:      [365, 165, 385, 285, 445, 465, 365, 155, 315, 485, 145, 365, 195, 345, 485, 385, 365, 385],
    logo: '/courses/Mid_Pines_Logo.png',
    photo: '/courses/MidPines-Photo.webp',
    designer: 'Donald Ross',
  },
  PINE_NEEDLES: {
    id: 'PINE_NEEDLES',
    name: 'Pine Needles',
    tees: 'Regular',
    slope: 133,
    rating: 70.0,
    handicapIndex: [11, 5, 17, 9, 7, 1, 3, 15, 13, 4, 12, 14, 16, 2, 6, 18, 8, 10],
    par:           [5, 4, 3, 4, 3, 4, 4,  4,  4, 5,  4,  4,  3, 4, 5,  3, 4, 4],
    yardages:      [468, 435, 121, 330, 167, 373, 351, 319, 350, 459, 346, 326, 158, 392, 467, 163, 430, 378],
    logo: '/courses/Pine_needles.png',
    photo: '/courses/Pine_Needles.webp',
    designer: 'Donald Ross',
  },
  TOBACCO_ROAD: {
    id: 'TOBACCO_ROAD',
    name: 'Tobacco Road',
    tees: 'Disc',
    slope: 143,
    rating: 71.3,
    handicapIndex: [3, 11, 17, 9, 15, 13, 7, 5, 1, 6, 10, 14, 2, 8, 12, 16, 18, 4],
    par:           [5,  4,  3, 5,  4,  3, 4, 3, 4, 4,  5,  4, 5, 3,  4,  4,  3, 4],
    yardages:      [547, 377, 147, 507, 322, 143, 401, 173, 415, 421, 511, 412, 536, 178, 358, 321, 134, 414],
    logo: '/courses/Tobacco_Road_Logo.png',
    photo: '/courses/4.26.2021 - Tobacco Road-2.jpg',
    designer: 'Mike Strantz',
  },
};

// Helper to get total par for a course
export const getCoursePar = (courseId: string): number => {
  const course = COURSES[courseId];
  return course ? course.par.reduce((sum, p) => sum + p, 0) : 72;
};

// Day 1 & 2 preset matchups (Round 3 singles set up in-app)
export const PRESET_MATCHUPS: MatchupDefinition[] = [
  // Round 1 — Mid Pines
  {
    id: 'r1m1',
    round: 1,
    course: 'MID_PINES',
    team1: ['steve', 'dobs'],
    team2: ['drew', 'brycen'],
    label: 'Brown/Dobs vs Drew/Brycen',
  },
  {
    id: 'r1m2',
    round: 1,
    course: 'MID_PINES',
    team1: ['ben', 'jimmy'],
    team2: ['ron', 'bryce'],
    label: 'Ben/Jimmy vs Ron/Bryce',
  },
  {
    id: 'r1m3',
    round: 1,
    course: 'MID_PINES',
    team1: ['bon', 'chet'],
    team2: ['rusty', 'scott'],
    label: 'Bon/Chet vs Rusty/Scott',
  },
  // Round 2 — Pine Needles
  {
    id: 'r2m1',
    round: 2,
    course: 'PINE_NEEDLES',
    team1: ['steve', 'jimmy'],
    team2: ['rusty', 'ron'],
    label: 'Brown/Jimmy vs Rusty/Ron',
  },
  {
    id: 'r2m2',
    round: 2,
    course: 'PINE_NEEDLES',
    team1: ['bon', 'dobs'],
    team2: ['brycen', 'scott'],
    label: 'Bon/Dobs vs Brycen/Scott',
  },
  {
    id: 'r2m3',
    round: 2,
    course: 'PINE_NEEDLES',
    team1: ['ben', 'chet'],
    team2: ['drew', 'bryce'],
    label: 'Ben/Chet vs Drew/Bryce',
  },
  // Round 3 — Tobacco Road (singles — set up in-app via admin page)
];

// Points configuration
export const POINTS = {
  fourballWin: 1,
  fourballTie: 0.5,
  singlesWin: 1,
  singlesTie: 0.5,
};
