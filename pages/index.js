import { useState, useRef, useEffect, useCallback } from "react";
import Head from "next/head";
import moment from "moment";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
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

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(componentOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setComponentOrder(items);
  };

  const groupComponentsIntoRows = (components) => {
    const rows = [];
    for (let i = 0; i < components.length; i += 3) {
      rows.push(components.slice(i, i + 3));
    }
    return rows;
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

  if (!Heartbeat)
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
    if (!TimingData || !CarData) {
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
        <div>
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
    if (!TimingData || !CarData) {
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
        <div>
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
            ...Object.values(RaceControlMessages.Messages),
            ...Object.values(SessionData.StatusSeries),
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

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="main-content">
            {(provided, snapshot) => (
              <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  padding: "var(--space-3)",
                }}
              >
                {groupComponentsIntoRows(componentOrder).map((row, rowIndex) => (
                  <div
                    key={`row-${rowIndex}`}
                    style={{
                      display: "flex",
                      gap: "var(--space-3)",
                      width: "100%",
                      alignItems: "stretch",
                    }}
                  >
                    {row.map((itemId, indexInRow) => {
                      const globalIndex = rowIndex * 3 + indexInRow;
                      const isEmptyPlaceholder = itemId === 'empty-placeholder';
                      
                      return (
                        <Draggable key={itemId} draggableId={itemId} index={globalIndex}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                width: getComponentWidth(row.length),
                                backgroundColor: snapshot.isDragging ? "var(--colour-offset)" : "transparent",
                                borderRadius: "var(--space-1)",
                                padding: snapshot.isDragging ? "var(--space-2)" : "0",
                                border: snapshot.isDragging ? "2px solid var(--colour-border)" : "2px solid transparent",
                                cursor: "grab",
                                transition: "all 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                flex: "1",
                              }}
                            >
                              <div
                                style={{
                                  backgroundColor: isEmptyPlaceholder ? "transparent" : "var(--colour-bg)",
                                  border: isEmptyPlaceholder ? "none" : "1px solid var(--colour-border)",
                                  borderRadius: "var(--space-1)",
                                  overflow: "hidden",
                                  display: "flex",
                                  flexDirection: "column",
                                  height: "100%",
                                  minHeight: isEmptyPlaceholder ? "100px" : "400px",
                                }}
                              >
                                {renderComponent(itemId)}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                  </div>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </main>
    </>
  );
}
