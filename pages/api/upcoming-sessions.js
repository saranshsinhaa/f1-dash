export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).send();

    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().split('T')[0];
    
    console.log(`[API] Fetching F1 races for year: ${currentYear}, current date: ${currentDate}`);

    const racesResponse = await fetch(`https://api.jolpi.ca/ergast/f1/current.json`);

    if (racesResponse.status !== 200) {
      console.error(`[API] Failed to fetch races: ${racesResponse.status}`);
      return res.status(racesResponse.status).send("Failed to fetch races");
    }

    const racesData = await racesResponse.json();
    const races = racesData.MRData.RaceTable.Races;
    
    console.log(`[API] Fetched ${races.length} races from Ergast API`);

    const upcomingRaces = races.filter(race => race.date > currentDate);
    
    console.log(`[API] Found ${upcomingRaces.length} upcoming races`);

    if (upcomingRaces.length === 0) {
      console.log('[API] No upcoming races found, getting recent races as fallback');
      const recentRaces = races
        .filter(race => race.date <= currentDate)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      
      const recentSessions = generateSessionsFromRaces(recentRaces, false);
      
      return res.status(200).json({
        upcoming: false,
        sessions: recentSessions,
        message: `No upcoming races found. Showing recent sessions from ${recentRaces.length} races.`
      });
    }

    const nextRaces = upcomingRaces.slice(0, 5);
    const upcomingSessions = generateSessionsFromRaces(nextRaces, true);

    console.log(`[API] Generated ${upcomingSessions.length} sessions from ${nextRaces.length} races`);

    return res.status(200).json({
      upcoming: true,
      sessions: upcomingSessions,
      message: `Found ${upcomingSessions.length} upcoming sessions from ${nextRaces.length} race weekends`
    });
  } catch (e) {
    console.error("Error fetching upcoming sessions:", e);
    return res.status(500).send(e.message);
  }
}

function generateSessionsFromRaces(races, isUpcoming) {
  const sessions = [];
  const currentTime = new Date();
  
  const sessionTypes = [
    { key: 'FirstPractice', type: 'Practice', name: 'Practice 1', duration: 90 },
    { key: 'SecondPractice', type: 'Practice', name: 'Practice 2', duration: 90 },
    { key: 'ThirdPractice', type: 'Practice', name: 'Practice 3', duration: 60 },
    { key: 'SprintQualifying', type: 'Qualifying', name: 'Sprint Qualifying', duration: 60 },
    { key: 'Sprint', type: 'Sprint', name: 'Sprint', duration: 60 },
    { key: 'Qualifying', type: 'Qualifying', name: 'Qualifying', duration: 60 },
    { key: 'Race', type: 'Race', name: 'Race', duration: 120, isMainEvent: true }
  ];
  
  races.forEach((race, raceIndex) => {
    const sessionBase = {
      meeting_key: raceIndex + 1000,
      circuit_key: race.Circuit.circuitId,
      location: race.Circuit.Location.locality,
      country_name: race.Circuit.Location.country,
      meeting_name: race.raceName,
      meeting_official_name: race.raceName,
      circuit_short_name: race.Circuit.circuitName,
      year: new Date(race.date).getFullYear()
    };

    sessionTypes.forEach(sessionType => {
      let sessionData;
      
      if (sessionType.isMainEvent) {
        sessionData = { date: race.date, time: race.time };
      } else {
        sessionData = race[sessionType.key];
      }
      
      if (sessionData) {
        const sessionDate = new Date(`${sessionData.date}T${sessionData.time}`);
        
        if (!isUpcoming || sessionDate > currentTime) {
          sessions.push({
            ...sessionBase,
            session_key: `${sessionBase.meeting_key}_${sessionType.key.toLowerCase()}`,
            session_type: sessionType.type,
            session_name: sessionType.name,
            date_start: sessionDate.toISOString(),
            date_end: new Date(sessionDate.getTime() + sessionType.duration * 60 * 1000).toISOString()
          });
        }
      }
    });
  });

  return sessions
    .sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
    .slice(0, 6);
}
