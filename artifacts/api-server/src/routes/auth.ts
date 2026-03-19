import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  signToken,
  hashPassword,
  comparePassword,
  generateOwnerId,
  requireAuth,
} from "../lib/auth.js";
import { masterLicensesTable } from "@workspace/db";
import { LoginBody, RegisterBody } from "@workspace/api-zod";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const parsed = LoginBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "Invalid body" });
      return;
    }
    const { username, password } = parsed.data;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (!user) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    if (!comparePassword(password, user.passwordHash)) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid credentials" });
      return;
    }
    if (user.banned) {
      res.status(401).json({ error: "Unauthorized", message: "Account is banned" });
      return;
    }

    const token = signToken({
      userId: user.id,
      username: user.username,
      ownerId: user.ownerId,
      role: user.role,
    });

    res.json({
      user: {
        id: user.id,
        username: user.username,
        ownerId: user.ownerId,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Login failed" });
  }
});

router.post("/register", async (req, res) => {
  try {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "Invalid body" });
      return;
    }
    const { username, password, masterLicenseKey } = parsed.data;

    const [masterLicense] = await db
      .select()
      .from(masterLicensesTable)
      .where(eq(masterLicensesTable.key, masterLicenseKey));

    if (!masterLicense || masterLicense.used) {
      res.status(400).json({ error: "Bad Request", message: "Invalid or already used master license key" });
      return;
    }

    const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));
    if (existing.length > 0) {
      res.status(400).json({ error: "Bad Request", message: "Username already taken" });
      return;
    }

    const ownerId = generateOwnerId();
    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash: hashPassword(password),
        ownerId,
        role: "user",
        banned: false,
      })
      .returning();

    await db
      .update(masterLicensesTable)
      .set({ used: true, usedBy: username })
      .where(eq(masterLicensesTable.key, masterLicenseKey));

    const token = signToken({
      userId: user.id,
      username: user.username,
      ownerId: user.ownerId,
      role: user.role,
    });

    res.status(201).json({
      user: {
        id: user.id,
        username: user.username,
        ownerId: user.ownerId,
        role: user.role,
        banned: user.banned,
        createdAt: user.createdAt.toISOString(),
      },
      token,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Registration failed" });
  }
});

router.post("/logout", (_req, res) => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const { userId } = (req as any).user;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(404).json({ error: "Not Found", message: "User not found" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      ownerId: user.ownerId,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get user" });
  }
});

export default router;
