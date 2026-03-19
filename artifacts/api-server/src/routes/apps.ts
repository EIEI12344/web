import { Router } from "express";
import { db, appsTable, appLicensesTable } from "@workspace/db";
import { eq, count, sql, and } from "drizzle-orm";
import { requireAuth, generateAppId, generateKey } from "../lib/auth.js";
import { JwtPayload } from "../lib/auth.js";
import { CreateAppBody, GenerateAppLicenseBody } from "@workspace/api-zod";

const router = Router();

router.use(requireAuth);

router.get("/", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const apps = await db.select().from(appsTable).where(eq(appsTable.userId, user.userId)).orderBy(sql`${appsTable.createdAt} DESC`);

    const result = await Promise.all(
      apps.map(async (app) => {
        const [licCountRow] = await db.select({ count: count() }).from(appLicensesTable).where(eq(appLicensesTable.appRecordId, app.id));
        return {
          id: app.id,
          appId: app.appId,
          name: app.name,
          ownerId: app.ownerId,
          licenseCount: licCountRow.count,
          createdAt: app.createdAt.toISOString(),
        };
      })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to list apps" });
  }
});

router.post("/", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const parsed = CreateAppBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "Invalid body" });
      return;
    }
    const { name } = parsed.data;
    const appId = generateAppId();

    const [app] = await db
      .insert(appsTable)
      .values({ appId, name, userId: user.userId, ownerId: user.ownerId })
      .returning();

    res.status(201).json({
      id: app.id,
      appId: app.appId,
      name: app.name,
      ownerId: app.ownerId,
      licenseCount: 0,
      createdAt: app.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to create app" });
  }
});

// NOTE: :appId in the URL refers to app.appId (short string), NOT the UUID id
router.get("/:appId", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }
    const [licCountRow] = await db.select({ count: count() }).from(appLicensesTable).where(eq(appLicensesTable.appRecordId, app.id));
    res.json({
      id: app.id,
      appId: app.appId,
      name: app.name,
      ownerId: app.ownerId,
      licenseCount: licCountRow.count,
      createdAt: app.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get app" });
  }
});

router.get("/:appId/licenses", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }

    const licenses = await db.select().from(appLicensesTable).where(eq(appLicensesTable.appRecordId, app.id)).orderBy(sql`${appLicensesTable.createdAt} DESC`);
    res.json(licenses.map(l => ({
      id: l.id,
      licenseKey: l.licenseKey,
      appId: l.appId,
      duration: l.duration,
      username: l.username ?? null,
      hwid: l.hwid ?? null,
      ownerId: l.ownerId,
      banned: l.banned,
      expiresAt: l.expiresAt ? l.expiresAt.toISOString() : null,
      lastLogin: l.lastLogin ? l.lastLogin.toISOString() : null,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to list licenses" });
  }
});

router.post("/:appId/licenses", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }

    const parsed = GenerateAppLicenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Bad Request", message: "Invalid body" });
      return;
    }
    const { duration } = parsed.data;
    const customDays = (req.body as any).days as number | undefined;

    let expiresAt: Date | null = null;
    if (duration === "1day") {
      expiresAt = new Date(Date.now() + 86400 * 1000);
    } else if (duration === "30days") {
      expiresAt = new Date(Date.now() + 30 * 86400 * 1000);
    } else if (duration === "custom" && customDays && customDays > 0) {
      expiresAt = new Date(Date.now() + customDays * 86400 * 1000);
    }

    const keyFormat = (req.body as any).keyFormat as string | undefined;
    let licenseKey: string;
    if (keyFormat && keyFormat.trim()) {
      const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      licenseKey = keyFormat.trim().replace(/\*/g, () => CHARS[Math.floor(Math.random() * CHARS.length)]);
    } else {
      const prefix = app.name.split(/\s+/)[0].replace(/[^A-Za-z0-9]/g, "").substring(0, 6) || "KEY";
      licenseKey = generateKey(prefix);
    }
    const [license] = await db
      .insert(appLicensesTable)
      .values({
        licenseKey,
        appId: app.appId,
        appRecordId: app.id,
        duration,
        ownerId: user.ownerId,
        banned: false,
        expiresAt: expiresAt ?? undefined,
      })
      .returning();

    res.status(201).json({
      id: license.id,
      licenseKey: license.licenseKey,
      appId: license.appId,
      duration: license.duration,
      username: license.username ?? null,
      hwid: license.hwid ?? null,
      ownerId: license.ownerId,
      banned: license.banned,
      expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
      lastLogin: license.lastLogin ? license.lastLogin.toISOString() : null,
      createdAt: license.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to generate license" });
  }
});

router.post("/:appId/licenses/:licenseId/ban", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }
    await db.update(appLicensesTable).set({ banned: true }).where(and(eq(appLicensesTable.id, req.params.licenseId), eq(appLicensesTable.appRecordId, app.id)));
    res.json({ success: true, message: "License banned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to ban license" });
  }
});

router.post("/:appId/licenses/:licenseId/unban", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }
    await db.update(appLicensesTable).set({ banned: false }).where(and(eq(appLicensesTable.id, req.params.licenseId), eq(appLicensesTable.appRecordId, app.id)));
    res.json({ success: true, message: "License unbanned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to unban license" });
  }
});

// Extend license endpoint (adds 30 days)
router.post("/:appId/licenses/:licenseId/extend", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }
    const [lic] = await db.select().from(appLicensesTable).where(and(eq(appLicensesTable.id, req.params.licenseId), eq(appLicensesTable.appRecordId, app.id)));
    if (!lic) {
      res.status(404).json({ error: "Not Found", message: "License not found" });
      return;
    }
    const base = lic.expiresAt && lic.expiresAt > new Date() ? lic.expiresAt : new Date();
    const newExpiry = new Date(base.getTime() + 30 * 86400 * 1000);
    await db.update(appLicensesTable).set({ expiresAt: newExpiry, duration: "30days" }).where(eq(appLicensesTable.id, lic.id));
    res.json({ success: true, message: "License extended by 30 days", expiresAt: newExpiry.toISOString() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to extend license" });
  }
});

// Delete license endpoint
router.delete("/:appId/licenses/:licenseId", async (req, res) => {
  try {
    const user = (req as any).user as JwtPayload;
    const [app] = await db.select().from(appsTable).where(and(eq(appsTable.appId, req.params.appId), eq(appsTable.userId, user.userId)));
    if (!app) {
      res.status(404).json({ error: "Not Found", message: "App not found" });
      return;
    }
    await db.delete(appLicensesTable).where(and(eq(appLicensesTable.id, req.params.licenseId), eq(appLicensesTable.appRecordId, app.id)));
    res.json({ success: true, message: "License deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to delete license" });
  }
});

export default router;
