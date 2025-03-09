import express from "express";
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
});