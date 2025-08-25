import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import moment from "moment";
import ResponsiveTable from "@monaco/components/ResponsiveTable";
import Driver, { TableHeader } from "@monaco/components/Driver";
import Radio from "@monaco/components/Radio";
import Map from "@monaco/components/Map";
import Input from "@monaco/components/Input";
import SpeedTrap, { speedTrapColumns } from "@monaco/components/SpeedTrap";
import UpcomingSessions from "@monaco/components/UpcomingSessions";

const f1Url = "https://livetiming.formula1.com";

const sortPosition = (a, b) => {
  const [, aLine] = a;
  const [, bLine] = b;
  const aPos = Number(aLine.Position);
  const bPos = Number(bLine.Position);
  return aPos - bPos;
};

const sortUtc = (a, b) => {
  const aDate = moment.utc(a.Utc);
  const bDate = moment.utc(b.Utc);
  return bDate.diff(aDate);
};

const getFlagColour = (flag) => {
  switch (flag?.toLowerCase()) {
    case "green":
      return { bg: "green" };
    case "yellow":
    case "double yellow":
      return { bg: "yellow", fg: "var(--colour-bg)" };
    case "red":
      return { bg: "red" };
    case "blue":
      return { bg: "blue" };
    default:
      return { bg: "transparent" };
  }
};

const getWeatherUnit = (key) => {
  switch (key) {
    case "AirTemp":
    case "TrackTemp":
      return "°C";
    case "Humidity":
      return "%";
    case "Pressure":
      return " mbar";
    case "WindDirection":
      return "°";
    case "WindSpeed":
      return " km/h";
    default:
      return null;
  }
};

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [liveState, setLiveState] = useState({});
  const [updated, setUpdated] = useState(new Date());
  const [delayMs, setDelayMs] = useState(0);
  const [delayTarget, setDelayTarget] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [triggerConnection, setTriggerConnection] = useState(0);
  const [triggerTick, setTriggerTick] = useState(0);
  
  const [showLayoutModal, setShowLayoutModal] = useState(false);
  const [tempLayout, setTempLayout] = useState([]);
  const [layout, setLayout] = useState([
    ['timing-data-1', 'track-map'],
    ['timing-data-2', 'race-control-messages'],
    ['team-radio', 'speed-trap']
  ]);
  
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  
  const availableComponents = [
    { id: 'timing-data-1', name: 'Live Timing (1-10)' },
    { id: 'timing-data-2', name: 'Live Timing (11-20)' },
    { id: 'track-map', name: 'Track Map' },
    { id: 'race-control-messages', name: 'Race Control' },
    { id: 'team-radio', name: 'Team Radio' },
    { id: 'speed-trap', name: 'Speed Trap' },
  ];
  
  const [componentOrder, setComponentOrder] = useState([
    'timing-data-1',
    'timing-data-2', 
    'track-map',
    'race-control-messages',
    'team-radio',
    'speed-trap',
    'empty-placeholder'
  ]);

  const socket = useRef();
  const retry = useRef();

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const storedEnabled = localStorage.getItem('f1-notifications-enabled') === 'true';
      setNotificationsEnabled(storedEnabled);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallButton(true);
    };

    const handleAppInstalled = () => {
      setShowInstallButton(false);
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallButton(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const openLayoutModal = () => {
    setTempLayout(layout.map(row => [...row]));
    setShowLayoutModal(true);
  };

  const closeLayoutModal = () => {
    setShowLayoutModal(false);
    setTempLayout([]);
  };

  const saveLayout = (newLayout) => {
    setLayout(newLayout);
    setShowLayoutModal(false);
    setTempLayout([]);
  };

  const openNotificationModal = () => {
    setShowNotificationModal(true);
  };

  const closeNotificationModal = () => {
    setShowNotificationModal(false);
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    installPrompt.prompt();
    
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    setInstallPrompt(null);
    setShowInstallButton(false);
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
              body: 'This is a test notification for your F1 app!',
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

  const getComponentWidth = (componentsInRow) => {
    switch (componentsInRow) {
      case 1: return '100%';
      case 2: return '50%';
      case 3: return '33.333%';
      default: return '33.333%';
    }
  };

  const initWebsocket = useCallback((handleMessage) => {
    if (retry.current) {
      clearTimeout(retry.current);
      retry.current = undefined;
    }

    const wsUrl =
      `${window.location.protocol.replace("http", "ws")}//` +
      window.location.hostname +
      (window.location.port ? `:${window.location.port}` : "") +
      "/ws";

    const ws = new WebSocket(wsUrl);

    ws.addEventListener("open", () => {
      setConnected(true);
    });

    ws.addEventListener("close", () => {
      setConnected(false);
      setBlocking((isBlocking) => {
        if (!retry.current && !isBlocking)
          retry.current = window.setTimeout(() => {
            initWebsocket(handleMessage);
          }, 1000);
      });
    });

    ws.addEventListener("error", () => {
      ws.close();
    });

    ws.addEventListener("message", ({ data }) => {
      setTimeout(() => {
        handleMessage(data);
      }, delayMs);
    });

    socket.current = ws;
  }, [delayMs]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/worker.js");
    }
  }, []);

  useEffect(() => {
    setLiveState({});
    setBlocking(false);
    initWebsocket((data) => {
      try {
        const d = JSON.parse(data);
        setLiveState(d);
        setUpdated(new Date());
      } catch (e) {
        console.error(`could not process message: ${e}`);
      }
    });
  }, [triggerConnection, initWebsocket]);

  useEffect(() => {
    if (blocking) {
      socket.current?.close();
      setTimeout(() => {
        setTriggerConnection((n) => n + 1);
      }, 100);
    }
  }, [blocking]);

  useEffect(() => {
    let interval;
    if (Date.now() < delayTarget) {
      interval = setInterval(() => {
        setTriggerTick((n) => n + 1);
        if (Date.now() >= delayTarget) clearInterval(interval);
      }, 250);
    }
  }, [delayTarget]);

  const messageCount =
    Object.values(liveState?.RaceControlMessages?.Messages ?? []).length +
    Object.values(liveState?.TeamRadio?.Captures ?? []).length;
  useEffect(() => {
    if (messageCount > 0) {
      try {
        new Audio("/notif.mp3").play();
      } catch (e) {}
    }
  }, [messageCount]);

  if (!connected)
    return (
      <>
        <Head>
          <title>No connection</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ marginBottom: "var(--space-4)" }}>
              <strong>NO CONNECTION</strong>
            </p>
            <button onClick={() => window.location.reload()}>RELOAD</button>
          </div>
        </main>
      </>
    );

  if (Date.now() < delayTarget)
    return (
      <>
        <Head>
          <title>Syncing</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              height: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p style={{ marginBottom: "var(--space-4)" }}>
              <strong>SYNCING...</strong>
            </p>
            <p>{(delayTarget - Date.now()) / 1000} sec</p>
          </div>
        </main>
      </>
    );

  const {
    Heartbeat,
    SessionInfo,
    SessionStatus,
    TrackStatus,
    LapCount,
    ExtrapolatedClock,
    WeatherData,
    DriverList,
    SessionData,
    RaceControlMessages,
    TimingData,
    TimingAppData,
    TimingStats,
    CarData,
    Position,
    TeamRadio,
    ChampionshipPrediction,
  } = liveState;

  const sessionStatusActive = SessionStatus?.Status === 'Started' || SessionStatus?.Status === 'Live' || SessionStatus?.Status === 'Active';
  
  const hasActiveTimingData = TimingData && Object.keys(TimingData).length > 0;
  
  const hasLiveSession = Heartbeat && (SessionInfo || SessionData) && (sessionStatusActive || hasActiveTimingData || CarData || Position);
  
  if (!hasLiveSession)
    return (
      <>
        <Head>
          <title>No session</title>
        </Head>
        <main>
          <div
            style={{
              width: "100vw",
              minHeight: "100vh",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--space-4)",
            }}
          >
            <UpcomingSessions />
          </div>
        </main>
      </>
    );

  const extrapolatedTimeRemaining =
    ExtrapolatedClock.Utc && ExtrapolatedClock.Remaining
      ? ExtrapolatedClock.Extrapolating
        ? moment
            .utc(
              Math.max(
                moment
                  .duration(ExtrapolatedClock.Remaining)
                  .subtract(
                    moment.utc().diff(moment.utc(ExtrapolatedClock.Utc))
                  )
                  .asMilliseconds() + delayMs,
                0
              )
            )
            .format("HH:mm:ss")
        : ExtrapolatedClock.Remaining
      : undefined;

  const renderTimingData1 = () => {
    if (!TimingData || !CarData || !CarData.Entries || CarData.Entries.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
          <p>NO DATA YET</p>
        </div>
      );
    }

    const lines = Object.entries(TimingData.Lines).sort(sortPosition);
    return (
      <>
        <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
          <p><strong>LIVE TIMING DATA (1-10)</strong></p>
        </div>
        <div style={{ overflowX: "auto", flexGrow: 1 }}>
          <TableHeader />
          {lines.slice(0, 10).map(([racingNumber, line]) => (
            <Driver
              key={`timing-data-1-${racingNumber}`}
              racingNumber={racingNumber}
              line={line}
              DriverList={DriverList}
              CarData={CarData}
              TimingAppData={TimingAppData}
              TimingStats={TimingStats}
              ChampionshipPrediction={ChampionshipPrediction}
            />
          ))}
        </div>
      </>
    );
  };

  const renderTimingData2 = () => {
    if (!TimingData || !CarData || !CarData.Entries || CarData.Entries.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "300px" }}>
          <p>NO DATA YET</p>
        </div>
      );
    }

    const lines = Object.entries(TimingData.Lines).sort(sortPosition);
    return (
      <>
        <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
          <p><strong>LIVE TIMING DATA (11-20)</strong></p>
        </div>
        <div style={{ overflowX: "auto", flexGrow: 1 }}>
          <TableHeader />
          {lines.slice(10, 20).map(([racingNumber, line]) => (
            <Driver
              key={`timing-data-2-${racingNumber}`}
              racingNumber={racingNumber}
              line={line}
              DriverList={DriverList}
              CarData={CarData}
              TimingAppData={TimingAppData}
              TimingStats={TimingStats}
              ChampionshipPrediction={ChampionshipPrediction}
            />
          ))}
        </div>
      </>
    );
  };

  const renderTrackMap = () => (
    <>
      <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
        <p><strong>TRACK</strong></p>
      </div>
      {!!Position ? (
        <Map
          circuit={SessionInfo.Meeting.Circuit.Key}
          Position={Position.Position[Position.Position.length - 1]}
          DriverList={DriverList}
          TimingData={TimingData}
          TrackStatus={TrackStatus}
          WindDirection={WeatherData.WindDirection}
        />
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "400px" }}>
          <p>NO DATA YET</p>
        </div>
      )}
    </>
  );

  const renderRaceControlMessages = () => (
    <>
      <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
        <p><strong>RACE CONTROL MESSAGES</strong></p>
      </div>
      {!!RaceControlMessages ? (
        <ul style={{ listStyle: "none", height: "200px", overflow: "auto", flexGrow: 1 }}>
          {[
            ...Object.values(RaceControlMessages.Messages || {}),
            ...Object.values(SessionData?.StatusSeries || {}),
          ]
            .sort(sortUtc)
            .map((event, i) => (
              <li key={`race-control-${event.Utc}-${i}`} style={{ padding: "var(--space-3)", display: "flex" }}>
                <span style={{ color: "grey", whiteSpace: "nowrap", marginRight: "var(--space-4)" }}>
                  {moment.utc(event.Utc).local().format("HH:mm:ss")}
                  {event.Lap && ` / Lap ${event.Lap}`}
                </span>
                {event.Category === "Flag" && (
                  <span style={{
                    backgroundColor: getFlagColour(event.Flag).bg,
                    color: getFlagColour(event.Flag).fg ?? "var(--colour-fg)",
                    border: "1px solid var(--colour-border)",
                    borderRadius: "var(--space-1)",
                    padding: "0 var(--space-2)",
                    marginRight: "var(--space-3)",
                  }}>
                    FLAG
                  </span>
                )}
                {event.Message && <span>{event.Message.trim()}</span>}
                {event.TrackStatus && <span>TrackStatus: {event.TrackStatus}</span>}
                {event.SessionStatus && <span>SessionStatus: {event.SessionStatus}</span>}
              </li>
            ))}
        </ul>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <p>NO DATA YET</p>
        </div>
      )}
    </>
  );

  const renderTeamRadio = () => (
    <>
      <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
        <p><strong>TEAM RADIO</strong></p>
      </div>
      {!!TeamRadio ? (
        <ul style={{ listStyle: "none", height: "200px", overflow: "auto", flexGrow: 1 }}>
          {[...Object.values(TeamRadio.Captures).sort(sortUtc)].map((radio, i) => {
            const driver = DriverList[radio.RacingNumber];
            return (
              <Radio
                key={`team-radio-${radio.Utc}-${i}`}
                radio={radio}
                path={`${f1Url}/static/${SessionInfo.Path}${radio.Path}`}
                driver={driver}
              />
            );
          })}
        </ul>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
          <p>NO DATA YET</p>
        </div>
      )}
    </>
  );

  const renderSpeedTrap = () => (
    <>
      <div style={{ padding: "var(--space-2) var(--space-3)", backgroundColor: "var(--colour-offset)", borderBottom: "1px solid var(--colour-border)" }}>
        <p><strong>SPEED TRAP DATA</strong></p>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: speedTrapColumns,
        padding: "var(--space-2) 24px var(--space-2) var(--space-3)",
        backgroundColor: "var(--colour-offset)",
      }}>
        <p>DRIVER</p>
        <p>SECTOR 1</p>
        <p>SECTOR 2</p>
        <p>FINISH LINE</p>
        <p>SPEED TRAP</p>
      </div>
      {!!TimingData && !!DriverList && (
        <ul style={{ listStyle: "none", height: "200px", overflow: "auto", flexGrow: 1 }}>
          {Object.entries(TimingData.Lines)
            .sort(sortPosition)
            .map(([racingNumber, line]) => (
              <SpeedTrap
                key={`speed-trap-${racingNumber}`}
                racingNumber={racingNumber}
                driver={DriverList[racingNumber]}
                line={line}
                statsLine={TimingStats.Lines[racingNumber]}
              />
            ))}
        </ul>
      )}
    </>
  );

  const renderEmptyPlaceholder = () => (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      height: "100px",
      border: "2px dashed var(--colour-border)",
      borderRadius: "var(--space-1)",
      color: "var(--colour-border)",
      fontSize: "14px"
    }}>
      Drop components here
    </div>
  );

  const LayoutModal = () => {
    const addComponentToRow = (rowIndex, componentId) => {
      if (tempLayout[rowIndex].length >= 3) return;
      
      const newLayout = tempLayout.map(row => row.filter(id => id !== componentId));
      newLayout[rowIndex] = [...newLayout[rowIndex], componentId];
      setTempLayout(newLayout);
    };

    const removeComponentFromRow = (rowIndex, componentId) => {
      const newLayout = [...tempLayout];
      newLayout[rowIndex] = newLayout[rowIndex].filter(id => id !== componentId);
      setTempLayout(newLayout);
    };

    const getUsedComponents = () => {
      return tempLayout.flat();
    };

    const getAvailableComponents = () => {
      const used = getUsedComponents();
      return availableComponents.filter(comp => !used.includes(comp.id));
    };

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
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <h2 style={{ margin: 0 }}>Configure Layout</h2>
            <button onClick={closeLayoutModal} style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--colour-fg)',
            }}>×</button>
          </div>

          <div style={{ marginBottom: 'var(--space-4)' }}>
            <h3>Available Components:</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {getAvailableComponents().map(comp => (
                <div key={comp.id} style={{
                  backgroundColor: 'var(--colour-offset)',
                  border: '1px solid var(--colour-border)',
                  borderRadius: 'var(--space-1)',
                  padding: 'var(--space-2)',
                  fontSize: '14px',
                }}>
                  {comp.name}
                </div>
              ))}
            </div>
          </div>

          {tempLayout.map((row, rowIndex) => (
            <div key={rowIndex} style={{ marginBottom: 'var(--space-3)' }}>
              <h4>Row {rowIndex + 1} ({row.length}/3 components):</h4>
              <div style={{
                border: '2px dashed var(--colour-border)',
                borderRadius: 'var(--space-1)',
                padding: 'var(--space-3)',
                minHeight: '60px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--space-2)',
                alignItems: 'center',
              }}>
                {row.length === 0 ? (
                  <span style={{ color: 'var(--colour-border)', fontStyle: 'italic' }}>
                    Empty row (minimum 1 component required)
                  </span>
                ) : (
                  row.map(componentId => {
                    const comp = availableComponents.find(c => c.id === componentId);
                    return (
                      <div key={componentId} style={{
                        backgroundColor: 'var(--colour-bg)',
                        border: '1px solid var(--colour-border)',
                        borderRadius: 'var(--space-1)',
                        padding: 'var(--space-2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                      }}>
                        <span>{comp?.name}</span>
                        <button
                          onClick={() => removeComponentFromRow(rowIndex, componentId)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'red',
                            cursor: 'pointer',
                            fontSize: '16px',
                          }}
                        >×</button>
                      </div>
                    );
                  })
                )}
              </div>
              
              <div style={{ marginTop: 'var(--space-2)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                {getAvailableComponents().map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => addComponentToRow(rowIndex, comp.id)}
                    disabled={row.length >= 3}
                    style={{
                      backgroundColor: row.length >= 3 ? 'var(--colour-offset)' : 'var(--colour-bg)',
                      border: '1px solid var(--colour-border)',
                      borderRadius: 'var(--space-1)',
                      padding: 'var(--space-1) var(--space-2)',
                      cursor: row.length >= 3 ? 'not-allowed' : 'pointer',
                      opacity: row.length >= 3 ? 0.5 : 1,
                      fontSize: '12px',
                    }}
                  >
                    + {comp.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button onClick={closeLayoutModal} style={{
              backgroundColor: 'var(--colour-offset)',
              border: '1px solid var(--colour-border)',
              borderRadius: 'var(--space-1)',
              padding: 'var(--space-2) var(--space-3)',
              cursor: 'pointer',
            }}>
              Cancel
            </button>
            <button 
              onClick={() => {
                const isValid = tempLayout.every(row => row.length >= 1);
                if (isValid) {
                  saveLayout(tempLayout);
                } else {
                  alert('Each row must have at least 1 component');
                }
              }}
              style={{
                backgroundColor: 'var(--colour-bg)',
                border: '1px solid var(--colour-border)',
                borderRadius: 'var(--space-1)',
                padding: 'var(--space-2) var(--space-3)',
                cursor: 'pointer',
                color: 'var(--colour-fg)',
              }}
            >
              Save Layout
            </button>
          </div>
        </div>
      </div>
    );
  };

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

  const renderComponent = (componentId) => {
    switch (componentId) {
      case 'timing-data-1':
        return renderTimingData1();
      case 'timing-data-2':
        return renderTimingData2();
      case 'track-map':
        return renderTrackMap();
      case 'race-control-messages':
        return renderRaceControlMessages();
      case 'team-radio':
        return renderTeamRadio();
      case 'speed-trap':
        return renderSpeedTrap();
      case 'empty-placeholder':
        return renderEmptyPlaceholder();
      default:
        return null;
    }
  };

  return (
    <>
      <Head>
        <title>
          {SessionInfo.Meeting.Circuit.ShortName}: {SessionInfo.Name}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main>
        <>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "var(--space-3)",
              borderBottom: "1px solid var(--colour-border)",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              {!!SessionInfo && (
                <>
                  <p style={{ marginRight: "var(--space-4)" }}>
                    <strong>{SessionInfo.Meeting.OfficialName}</strong>,{" "}
                    {SessionInfo.Meeting.Circuit.ShortName},{" "}
                    {SessionInfo.Meeting.Country.Name}
                  </p>
                  <p style={{ marginRight: "var(--space-4)" }}>
                    Session: {SessionInfo.Name}
                  </p>
                </>
              )}
              {!!TrackStatus && (
                <p style={{ marginRight: "var(--space-4)" }}>
                  Status: {TrackStatus.Message}
                </p>
              )}
              {!!LapCount && (
                <p style={{ marginRight: "var(--space-4)" }}>
                  Lap: {LapCount.CurrentLap}/{LapCount.TotalLaps}
                </p>
              )}
              {!!extrapolatedTimeRemaining && (
                <p style={{ marginRight: "var(--space-4)" }}>
                  Remaining: {extrapolatedTimeRemaining}
                </p>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
              }}
            >
              <button
                onClick={openLayoutModal}
                style={{
                  backgroundColor: "var(--colour-bg)",
                  border: "1px solid var(--colour-border)",
                  borderRadius: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)",
                  cursor: "pointer",
                  color: "var(--colour-fg)",
                  marginRight: "var(--space-4)",
                }}
              >
                Layout
              </button>
              <button
                onClick={openNotificationModal}
                style={{
                  backgroundColor: "var(--colour-bg)",
                  border: "1px solid var(--colour-border)",
                  borderRadius: "var(--space-1)",
                  padding: "var(--space-2) var(--space-3)",
                  cursor: "pointer",
                  color: "var(--colour-fg)",
                  marginRight: "var(--space-4)",
                }}
              >
                🔔 Notifications
              </button>
              {showInstallButton && (
                <button
                  onClick={handleInstallClick}
                  style={{
                    backgroundColor: "var(--colour-bg)",
                    border: "1px solid var(--colour-border)",
                    borderRadius: "var(--space-1)",
                    padding: "var(--space-2) var(--space-3)",
                    cursor: "pointer",
                    color: "var(--colour-fg)",
                    marginRight: "var(--space-4)",
                  }}
                >
                  📱 Install
                </button>
              )}
              <p style={{ marginRight: "var(--space-4)" }}>
                Data updated: {moment.utc(updated).local().format("HH:mm:ss.SSS")}
              </p>
              <p style={{ color: "limegreen", marginRight: "var(--space-4)" }}>
                CONNECTED
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.target);
                  const delayMsValue = Number(form.get("delayMs"));
                  setBlocking(true);
                  setDelayMs(delayMsValue);
                  setDelayTarget(Date.now() + delayMsValue);
                }}
                style={{ display: "flex", alignItems: "center" }}
              >
                <p style={{ marginRight: "var(--space-2)" }}>Delay</p>
                <Input
                  type="number"
                  name="delayMs"
                  defaultValue={delayMs}
                  style={{ width: "75px", marginRight: "var(--space-2)" }}
                />
                <p style={{ marginRight: "var(--space-4)" }}>ms</p>
              </form>
            </div>
          </div>

          {!!WeatherData && (
            <div
              style={{
                display: "flex",
                padding: "var(--space-3)",
                borderBottom: "1px solid var(--colour-border)",
                overflowX: "auto",
              }}
            >
              <p style={{ marginRight: "var(--space-4)" }}>
                <strong>WEATHER</strong>
              </p>
              {Object.entries(WeatherData).map(([k, v]) =>
                k !== "_kf" ? (
                  <p
                    key={`weather-${k}`}
                    style={{ marginRight: "var(--space-4)" }}
                  >
                    {k}: {v}
                    {getWeatherUnit(k)}
                  </p>
                ) : null
              )}
            </div>
          )}
        </>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            padding: "var(--space-3)",
          }}
        >
          {layout.map((row, rowIndex) => (
            <div
              key={`row-${rowIndex}`}
              style={{
                display: "flex",
                gap: "var(--space-3)",
                width: "100%",
                alignItems: "stretch",
              }}
            >
              {row.map((componentId, indexInRow) => (
                <div
                  key={componentId}
                  style={{
                    width: getComponentWidth(row.length),
                    display: "flex",
                    flexDirection: "column",
                    flex: "1",
                  }}
                >
                  <div
                    style={{
                      backgroundColor: "var(--colour-bg)",
                      border: "1px solid var(--colour-border)",
                      borderRadius: "var(--space-1)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      minHeight: "400px",
                    }}
                  >
                    {renderComponent(componentId)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {showLayoutModal && <LayoutModal />}
        {showNotificationModal && <NotificationModal />}
      </main>
    </>
  );
}
