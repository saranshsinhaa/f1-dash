const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const ws = require("ws");
const zlib = require("zlib");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const signalrUrl = "livetiming.formula1.com/signalr";
const signalrHub = "Streaming";

const socketFreq = 1000;
const retryFreq = 10000;

let state = {};
let messageCount = 0;
let emptyMessageCount = 0;
let lastMessageTime = 0;
let isStreamConnected = false;

const deepObjectMerge = (original = {}, modifier) => {
  if (!modifier) return original;
  const copy = { ...original };
  for (const [key, value] of Object.entries(modifier)) {
    const valueIsObject =
      typeof value === "object" && !Array.isArray(value) && value !== null;
    if (valueIsObject && !!Object.keys(value).length) {
      copy[key] = deepObjectMerge(copy[key], value);
    } else {
      copy[key] = value;
    }
  }
  return copy;
};

const parseCompressed = (data) =>
  JSON.parse(zlib.inflateRawSync(Buffer.from(data, "base64")).toString());

const updateState = (data) => {
  try {
    const parsed = JSON.parse(data.toString());

    if (!Object.keys(parsed).length) {
      emptyMessageCount++;
    } else {
      emptyMessageCount = 0;
      lastMessageTime = Date.now();
    }

    if (emptyMessageCount > 5 && !dev) {
      state = {};
      messageCount = 0;
      lastMessageTime = 0;
    }

    if (Array.isArray(parsed.M)) {
      for (const message of parsed.M) {
        if (message.M === "feed") {
          let [field, value] = message.A;

          if (field !== "Heartbeat") {
            messageCount++;
          }
          lastMessageTime = Date.now();

          if (field === "CarData.z" || field === "Position.z") {
            const [parsedField] = field.split(".");
            field = parsedField;
            value = parseCompressed(value);
          }

          state = deepObjectMerge(state, { [field]: value });
        }
      }
    } else if (Object.keys(parsed.R ?? {}).length && parsed.I === "1") {
      messageCount++;
      lastMessageTime = Date.now();

      if (parsed.R["CarData.z"])
        parsed.R["CarData"] = parseCompressed(parsed.R["CarData.z"]);

      if (parsed.R["Position.z"])
        parsed.R["Position"] = parseCompressed(parsed.R["Position.z"]);

      state = deepObjectMerge(state, parsed.R);
    }
  } catch (e) {
    console.error(`could not update data: ${e}`);
  }
};

const setupStream = async (wss) => {
  if (dev) console.log(`[${signalrUrl}] Connecting to live timing stream`);

  const hub = encodeURIComponent(JSON.stringify([{ name: signalrHub }]));
  const negotiation = await fetch(
    `https://${signalrUrl}/negotiate?connectionData=${hub}&clientProtocol=1.5`
  );
  const cookie =
    negotiation.headers.get("Set-Cookie") ??
    negotiation.headers.get("set-cookie");
  const { ConnectionToken } = await negotiation.json();

  if (cookie && ConnectionToken) {
    if (dev) console.log(`[${signalrUrl}] HTTP negotiation complete`);

    const socket = new ws(
      `wss://${signalrUrl}/connect?clientProtocol=1.5&transport=webSockets&connectionToken=${encodeURIComponent(
        ConnectionToken
      )}&connectionData=${hub}`,
      [],
      {
        headers: {
          "User-Agent": "BestHTTP",
          "Accept-Encoding": "gzip,identity",
          Cookie: cookie,
        },
      }
    );

    socket.on("open", () => {
      if (dev) console.log(`[${signalrUrl}] WebSocket open`);

      state = {};
      messageCount = 0;
      emptyMessageCount = 0;
      lastMessageTime = Date.now();
      isStreamConnected = true;

      socket.send(
        JSON.stringify({
          H: signalrHub,
          M: "Subscribe",
          A: [
            [
              "Heartbeat",
              "CarData.z",
              "Position.z",
              "ExtrapolatedClock",
              "TimingStats",
              "TimingAppData",
              "WeatherData",
              "TrackStatus",
              "DriverList",
              "RaceControlMessages",
              "SessionInfo",
              "SessionData",
              "SessionStatus",
              "LapCount",
              "TimingData",
              "TeamRadio",
              "ChampionshipPrediction",
            ],
          ],
          I: 1,
        })
      );
    });

    socket.on("message", (data) => {
      updateState(data);
    });

    socket.on("error", () => {
      if (dev) console.log("socket error");
      socket.close();
    });

    socket.on("close", () => {
      if (dev) console.log("socket close");
      state = {};
      messageCount = 0;
      emptyMessageCount = 0;
      lastMessageTime = 0;
      isStreamConnected = false;

      setTimeout(() => {
        setupStream(wss);
      }, retryFreq);
    });
  } else {
    if (dev) console.log(
      `[${signalrUrl}] HTTP negotiation failed. Is there a live session?`
    );
    state = {};
    messageCount = 0;
    lastMessageTime = 0;
    isStreamConnected = false;

    setTimeout(() => {
      setupStream(wss);
    }, retryFreq);
  }
};

app.prepare().then(async () => {
  const wss = new ws.WebSocketServer({ noServer: true });

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else if (pathname === "/_next/webpack-hmr") {
      // Don't destroy, needed for HMR
    } else {
      socket.destroy();
    }
  });

  server.once("error", (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`Monaco server ready on http://${hostname}:${port}`);
  });

      setInterval(() => {
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    
    const hasRecentData = timeSinceLastMessage < 30000;
    const hasMinimumMessages = messageCount > 3;
    const hasHeartbeat = !!state.Heartbeat;
    const hasSessionInfo = !!state.SessionInfo;
    const hasSessionData = !!state.SessionData;
    const hasSessionStatus = !!state.SessionStatus;
    const hasTimingData = !!state.TimingData;
    const hasCarData = !!state.CarData;
    const hasPosition = !!state.Position;
    const hasDriverList = !!state.DriverList;
    const hasTrackStatus = !!state.TrackStatus;
    
    const sessionStatusActive = state.SessionStatus?.Status === 'Started' || state.SessionStatus?.Status === 'Live' || state.SessionStatus?.Status === 'Active';
    
    const hasActiveTimingData = hasTimingData && Object.keys(state.TimingData || {}).length > 0;
    
    const isActiveSession = isStreamConnected && hasRecentData && hasMinimumMessages && hasHeartbeat && (hasSessionInfo || hasSessionData) &&(sessionStatusActive || hasActiveTimingData || hasCarData || hasPosition);

    const shouldSendState = isActiveSession || (dev && Object.keys(state).length > 0);
    
    if (dev && !isActiveSession && messageCount > 0) {
      console.log(`[DEBUG] SessionStatus:`, state.SessionStatus);
      console.log(`[DEBUG] TimingData keys:`, Object.keys(state.TimingData || {}));
      console.log(`[DEBUG] Available state keys:`, Object.keys(state));
    }

    wss.clients.forEach((s) => {
      if (s.readyState === ws.OPEN) {
        s.send(shouldSendState ? JSON.stringify(state) : "{}", {
          binary: false,
        });
      }
    });
  }, socketFreq);

  await setupStream(wss);
});
