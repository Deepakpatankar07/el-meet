import express from "express";
import cors from "cors";
import userRouter from "./router/user";
import roomRouter from "./router/room";
import { setupWebSocket } from "./websocket";
import http from "http";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

// Load environment variables
import dotenv from "dotenv";
dotenv.config();

const app = express();

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Apply Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts if needed
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
    },
  },
  xssFilter: true,
  frameguard: { action: "deny" }, // Prevent clickjacking
}));

// Restrict CORS to your frontend domain in production
app.use(cors({
  origin: process.env.PROD_FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json());

app.use("/api/v1/user", userRouter);
app.use("/api/v1/room", roomRouter);

// Basic health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", message: "WS Backend is running" });
});

const server = http.createServer(app);
setupWebSocket(server);

const PORT = process.env.PROD_PORT || 8080;
server.listen(PORT, () => {
  console.log(`http&ws-backend server running on port ${PORT}`);
}).on("error", (err) => {
  console.error("Server startup error:", err);
  process.exit(1);
});

/* import express from "express";
import cors from "cors";
import userRouter from "./router/user";
import roomRouter from "./router/room";
import { setupWebSocket } from "./websocket";
import http from "http";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/v1/user", userRouter);
app.use("/api/v1/room", roomRouter);

const server = http.createServer(app);
setupWebSocket(server);



const PORT = 8080;
server.listen(PORT, () => {
  console.log(`http&ws-backend server running on ${PORT}`);
}); */