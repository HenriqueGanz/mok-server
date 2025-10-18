import express from "express";
import http from "http";
import { Server as ColyseusServer } from "colyseus"; // Não precisamos mais importar matchMaker diretamente para onAuth
import { WebSocketTransport } from "@colyseus/ws-transport";
import dotenv from "dotenv";
import { MainMapRoom } from "./rooms/MainMapRoom";
import { authRouter } from "./auth/auth";
import { PrismaClient } from "@prisma/client";
import cors from "cors";
import jwt from "jsonwebtoken";

dotenv.config();

const prisma = new PrismaClient();
const app = express();
const PORT = Number(process.env.PORT || 2567);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret"; // Certifique-se de ter um secret forte em .env

const allowedOrigins = [
  "https://sturdy-tribble-jvpjgrx7469f5j4x-5173.app.github.dev", // Domínio do Codespaces client
  "http://localhost:5173", // Ambiente local de desenvolvimento
  // Adicione outras origens se necessário
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS: Origin ${origin} not allowed.`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());
app.use("/auth", authRouter(prisma));

const httpServer = http.createServer(app);

const colyseusServer = new ColyseusServer({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Disponibiliza o prisma e JWT_SECRET globalmente para a MainMapRoom
(global as any).prisma = prisma;
(global as any).JWT_SECRET = JWT_SECRET;

colyseusServer.define("main_map", MainMapRoom, {
  maxPlayers: 200,
});

httpServer.listen(PORT, async () => {
  console.log(`🚀 HTTP + Colyseus server rodando na porta ${PORT}`);
  await prisma.$connect();
  console.log("✅ Prisma conectado ao banco de dados");
});

process.on("SIGINT", async () => {
  console.log("🧹 Encerrando servidor...");
  await colyseusServer.gracefullyShutdown();
  await prisma.$disconnect();
  process.exit(0);
});