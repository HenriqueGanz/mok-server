import express from "express";
import http from "http";
import { Server as ColyseusServer } from "colyseus";
import dotenv from "dotenv";
import { createWebSocketStream } from "ws";
import { MainMapRoom } from "./rooms/MainMapRoom";
import { authRouter } from "./auth/auth";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import Redis from "redis";


dotenv.config();


const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(cors());


// Auth routes (register/login)
app.use("/auth", authRouter(prisma));


const PORT = Number(process.env.PORT || 2567);


// Create HTTP server
const httpServer = http.createServer(app);


// Create Colyseus server instance
const colyseusServer = new ColyseusServer({
  server: httpServer,
});


// Register room
colyseusServer.define("main_map", MainMapRoom, {
  maxPlayers: 200,
});


// Start server
httpServer.listen(PORT, async () => {
  console.log(`HTTP + Colyseus server listening on port ${PORT}`);
  // Connect Prisma to ensure DB available
  await prisma.$connect();
  console.log("Prisma connected to DB");
});


process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});