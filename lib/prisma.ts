// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Déclare une variable globale pour stocker le client Prisma
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Crée le client Prisma une seule fois ou le réutilise s'il existe déjà
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "info", "warn", "error"] : ["warn", "error"],
  });

// En développement, assigne le client à la variable globale pour le hot-reloading
// Listeners de debug (bruyants) — à réduire après diagnostic
// @ts-ignore
prisma.$on("query", (e: any) => {
  const params = String(e.params ?? "");
  const trimmed = params.length > 500 ? params.slice(0, 500) + "…" : params;
  console.log("[Prisma][query]", { duration: e.duration, query: e.query, params: trimmed });
});
// @ts-ignore
prisma.$on("info", (e: any) => {
  console.log("[Prisma][info]", e);
});
// @ts-ignore
prisma.$on("warn", (e: any) => {
  console.warn("[Prisma][warn]", e);
});
// @ts-ignore
prisma.$on("error", (e: any) => {
  console.error("[Prisma][error]", e);
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
