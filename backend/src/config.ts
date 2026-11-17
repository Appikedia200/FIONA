import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "8000"),
  jwtSecret: process.env.JWT_SECRET || "fiona-secret",
  databaseUrl: process.env.DATABASE_URL || "",
  mockAuth: process.env.MOCK_AUTH === "true",
  cloudflare: {
    publicIP: process.env.BACKEND_PUBLIC_IP || "",
  },
  urls: {
    backend: process.env.BACKEND_DOMAIN || "localhost:8000",
    webPanel: process.env.WEB_PANEL_URL || "http://localhost:3000",
  },
};
