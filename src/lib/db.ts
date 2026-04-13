import { PrismaClient } from "@prisma/client";

declare global {
  var __owPartnersPrisma__: PrismaClient | undefined;
}

export const db = global.__owPartnersPrisma__ ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__owPartnersPrisma__ = db;
}
