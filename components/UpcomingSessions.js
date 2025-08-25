import { useState, useEffect } from "react";
import moment from "moment";
import styled from "styled-components";

const Container = styled.div`
  width: 100%;
  max-width: 1200px;
  padding: var(--space-4);
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: var(--space-6);
`;

const Title = styled.h1`
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: var(--space-2);
  color: var(--colour-fg);
`;

const Subtitle = styled.h2`
  font-size: 1.5rem;
  color: var(--colour-fg-subtle);
  margin-bottom: var(--space-4);
`;

const SessionsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--space-4);
  margin-top: var(--space-4);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const SessionCard = styled.div`
  background: var(--colour-bg-subtle);
  border: 1px solid var(--colour-border);
  border-radius: var(--radius-2);
  padding: var(--space-4);
  transition: transform 0.2s ease, box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const SessionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
`;

const SessionType = styled.span`
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-1);
  font-size: 0.875rem;
  font-weight: bold;
  color: white;
  background: ${props => {
    switch (props.type?.toLowerCase()) {
      case 'race': return '#e74c3c';
      case 'qualifying': return '#f39c12';
      case 'sprint': return '#9b59b6';
      case 'practice': return '#3498db';
      default: return '#95a5a6';
    }
  }};
`;

const SessionName = styled.h3`
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--colour-fg);
  margin: 0;
`;

const MeetingName = styled.p`
  font-size: 0.875rem;
  color: var(--colour-fg-subtle);
  margin: var(--space-2) 0;
  font-weight: 500;
`;

const CircuitName = styled.p`
  font-size: 0.8rem;
  color: var(--colour-fg-subtle);
  margin: var(--space-1) 0 var(--space-2) 0;
  font-style: italic;
  opacity: 0.8;
`;

const LocationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: var(--space-1);
  margin-bottom: var(--space-3);
  font-size: 0.875rem;
  color: var(--colour-fg-subtle);
`;

const TimeInfo = styled.div`
  margin-bottom: var(--space-3);
`;

const DateTime = styled.p`
  font-size: 1rem;
  font-weight: 600;
  color: var(--colour-fg);
  margin: 0 0 var(--space-1) 0;
`;

const Countdown = styled.p`
  font-size: 1.125rem;
  font-weight: bold;
  color: var(--colour-accent);
  margin: 0;
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--space-6);
`;

const ErrorContainer = styled.div`
  text-align: center;
  padding: var(--space-6);
  color: var(--colour-fg-subtle);
`;

const getSessionTypeDisplay = (sessionType, sessionName) => {
  if (sessionType === 'Practice') {
    if (sessionName.includes('1')) return 'FP1';
    if (sessionName.includes('2')) return 'FP2';
    if (sessionName.includes('3')) return 'FP3';
    return 'FP';
  }
  if (sessionType === 'Qualifying') return 'Q';
  if (sessionType === 'Race') return 'R';
  if (sessionType === 'Sprint') return 'S';
  return sessionType.charAt(0);
};

const formatCountdown = (targetDate) => {
  const now = moment();
  const target = moment(targetDate);
  const duration = moment.duration(target.diff(now));

  if (duration.asMilliseconds() <= 0) {
    return "Session started";
  }

  const days = Math.floor(duration.asDays());
  const hours = duration.hours();
  const minutes = duration.minutes();

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const NotificationButton = styled.button`
  background: var(--colour-bg);
  border: 1px solid var(--colour-border);
  border-radius: var(--space-1);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  color: var(--colour-fg);
  margin-top: var(--space-3);
  font-size: 0.875rem;
  
  &:hover {
    background: var(--colour-offset);
  }
`;

const UpcomingSessions = () => {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpcoming, setIsUpcoming] = useState(true);
  const [apiMessage, setApiMessage] = useState('');
  const [currentTime, setCurrentTime] = useState(moment());
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const storedEnabled = localStorage.getItem('f1-notifications-enabled') === 'true';
      setNotificationsEnabled(storedEnabled);
    }
  }, []);

  const openNotificationModal = () => {
    setShowNotificationModal(true);
  };

  const closeNotificationModal = () => {
    setShowNotificationModal(false);
  };

  const testNotification = () => {
    if ('serviceWorker' in navigator && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then((registration) => {
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'TEST_NOTIFICATION'
            });
          } else {
            new Notification('🏁 Test Notification', {
              body: 'This is a test notification for your F1-Dash app!',
              icon: '/icon.png'
            });
          }
        });
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
            localStorage.setItem('f1-notifications-enabled', 'true');
            new Notification('🏁 Test Notification', {
              body: 'This is a test notification for your F1-Dash app!',
              icon: '/icon.png'
            });
          }
        });
      } else {
        alert('Notifications are blocked. Please enable them in your browser settings.');
      }
    }
  };

  const toggleNotifications = () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
      localStorage.setItem('f1-notifications-enabled', 'false');
    } else {
      if (Notification.permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('f1-notifications-enabled', 'true');
      } else if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            setNotificationsEnabled(true);
            localStorage.setItem('f1-notifications-enabled', 'true');
          }
        });
      } else {
        alert('Notifications are blocked. Please enable them in your browser settings.');
      }
    }
  };

  const scheduleSessionNotifications = (sessions) => {
    const notificationsEnabled = localStorage.getItem('f1-notifications-enabled') === 'true';
    
    if ('serviceWorker' in navigator && Notification.permission === 'granted' && notificationsEnabled) {
      navigator.serviceWorker.ready.then((registration) => {
        navigator.serviceWorker.controller?.postMessage({
          type: 'CLEAR_NOTIFICATIONS'
        });
        
        sessions.forEach((session) => {
          const sessionTime = new Date(session.date_start);
          const now = new Date();
          const notificationTime = new Date(sessionTime.getTime() - 30 * 60 * 1000);
          
          if (notificationTime > now) {
            navigator.serviceWorker.controller?.postMessage({
              type: 'SCHEDULE_NOTIFICATION',
              sessionName: session.session_name,
              sessionTime: session.date_start,
              sessionLocation: `${session.location}, ${session.country_name}`
            });
          }
        });
      });
    }
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/upcoming-sessions');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.sessions) {
          setSessions(data.sessions);
          setIsUpcoming(data.upcoming);
          setApiMessage(data.message || '');
          
          if (data.upcoming) {
            scheduleSessionNotifications(data.sessions);
          }
        } else {
          setSessions(data);
          setIsUpcoming(true);
          setApiMessage('');
          scheduleSessionNotifications(data);
        }
        setError(null);
      } catch (err) {
        console.error('Error fetching upcoming sessions:', err);
        setError('Failed to load session data');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Update countdown timers every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const NotificationModal = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}>
        <div style={{
          backgroundColor: 'var(--colour-bg)',
          border: '1px solid var(--colour-border)',
          borderRadius: 'var(--space-2)',
          padding: 'var(--space-4)',
          maxWidth: '500px',
          width: '90%',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ margin: 0 }}>🔔 Notification Settings</h2>
            <button onClick={closeNotificationModal} style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--colour-fg)',
            }}>×</button>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <p style={{ marginBottom: 'var(--space-3)', color: 'var(--colour-fg)' }}>
              Get notified 30 minutes before each F1 session starts.
            </p>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-3)',
              backgroundColor: 'var(--colour-offset)',
              borderRadius: 'var(--space-1)',
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                cursor: 'pointer',
                color: 'var(--colour-fg)',
              }}>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={toggleNotifications}
                  style={{
                    marginRight: 'var(--space-2)',
                    transform: 'scale(1.2)',
                  }}
                />
                Enable F1 Session Notifications
              </label>
            </div>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <p style={{ 
                fontSize: '0.9rem', 
                color: '#999', 
                marginBottom: 'var(--space-2)' 
              }}>
                Permission status: <strong style={{ color: notificationsEnabled ? '#4caf50' : '#f44336' }}>
                  {Notification.permission === 'granted' ? 'Granted' : 
                   Notification.permission === 'denied' ? 'Denied' : 'Not requested'}
                </strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button 
              onClick={testNotification}
              disabled={!notificationsEnabled}
              style={{
                backgroundColor: notificationsEnabled ? '#4caf50' : 'var(--colour-offset)',
                border: '1px solid var(--colour-border)',
                borderRadius: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                cursor: notificationsEnabled ? 'pointer' : 'not-allowed',
                color: notificationsEnabled ? 'white' : '#999',
                opacity: notificationsEnabled ? 1 : 0.6,
              }}
            >
              🧪 Test Notification
            </button>
            <button 
              onClick={closeNotificationModal}
              style={{
                backgroundColor: 'var(--colour-bg)',
                border: '1px solid var(--colour-border)',
                borderRadius: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
                color: 'var(--colour-fg)',
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <Title>🏁 NO LIVE SESSION ACTIVE 🏁</Title>
          <Subtitle>📅 LOADING F1 SESSIONS</Subtitle>
          <NotificationButton onClick={openNotificationModal}>
            🔔 Notifications
          </NotificationButton>
        </Header>
        <LoadingContainer>
          <p>Loading session data...</p>
        </LoadingContainer>
        {showNotificationModal && <NotificationModal />}
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Header>
          <Title>🏁 NO LIVE SESSION ACTIVE 🏁</Title>
          <Subtitle>📅 F1 SESSIONS</Subtitle>
          <NotificationButton onClick={openNotificationModal}>
            🔔 Notifications
          </NotificationButton>
        </Header>
        <ErrorContainer>
          <p>{error}</p>
          <p>Please check back later for session information.</p>
        </ErrorContainer>
        {showNotificationModal && <NotificationModal />}
      </Container>
    );
  }

  if (sessions.length === 0) {
    return (
      <Container>
        <Header>
          <Title>🏁 NO LIVE SESSION ACTIVE 🏁</Title>
          <Subtitle>📅 F1 SESSIONS</Subtitle>
          <NotificationButton onClick={openNotificationModal}>
            🔔 Notifications
          </NotificationButton>
        </Header>
        <ErrorContainer>
          <p>No session data available.</p>
          <p>The F1 API might be experiencing issues or there may be no data for this period.</p>
          {apiMessage && <p><em>{apiMessage}</em></p>}
        </ErrorContainer>
        {showNotificationModal && <NotificationModal />}
      </Container>
    );
  }

  const headerTitle = isUpcoming ? "📅 UPCOMING F1 SESSIONS" : "📅 RECENT F1 SESSIONS";
  const headerSubtext = isUpcoming ? 
    "Next sessions in the F1 calendar" : 
    "No upcoming sessions found - showing recent sessions";

  return (
    <Container>
      <Header>
        <Title>🏁 NO LIVE SESSION ACTIVE 🏁</Title>
        <Subtitle>{headerTitle}</Subtitle>
        {!isUpcoming && (
          <p style={{ fontSize: '0.9rem', color: 'var(--colour-fg-subtle)', fontStyle: 'italic' }}>
            {headerSubtext}
          </p>
        )}
        <NotificationButton onClick={openNotificationModal}>
          🔔 Notifications
        </NotificationButton>
        {/* {apiMessage && (
          <p style={{ fontSize: '0.85rem', color: 'var(--colour-fg-subtle)', marginTop: 'var(--space-2)' }}>
            {apiMessage}
          </p>
        )} */}
      </Header>

      <SessionsGrid>
        {sessions.map((session) => (
          <SessionCard key={session.session_key}>
            <SessionHeader>
              <SessionType type={session.session_type}>
                {getSessionTypeDisplay(session.session_type, session.session_name)}
              </SessionType>
              <SessionName>{session.session_name}</SessionName>
            </SessionHeader>

            <MeetingName>{session.meeting_name}</MeetingName>
            
            <CircuitName>{session.circuit_short_name}</CircuitName>

            <LocationInfo>
              <span>🏁</span>
              <span>{session.location}, {session.country_name}</span>
            </LocationInfo>

            <TimeInfo>
              <DateTime>
                {moment(session.date_start).format('dddd, MMMM Do YYYY')}
              </DateTime>
              <DateTime>
                {moment(session.date_start).format('h:mm A')} (Your local time)
              </DateTime>
              <Countdown>
                {isUpcoming ? formatCountdown(session.date_start) : 
                 moment(session.date_start).fromNow()}
              </Countdown>
            </TimeInfo>
          </SessionCard>
        ))}
      </SessionsGrid>
      {showNotificationModal && <NotificationModal />}
    </Container>
  );
};

export default UpcomingSessions;
