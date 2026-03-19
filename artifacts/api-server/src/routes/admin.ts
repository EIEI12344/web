import { Router } from "express";
import { db, usersTable, masterLicensesTable, appsTable, appLicensesTable, securityAlertsTable } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";
import { requireAdmin } from "../lib/auth.js";
import { generateKey } from "../lib/auth.js";

const router = Router();

router.use(requireAdmin);

router.get("/stats", async (_req, res) => {
  try {
    const [totalUsersRow] = await db.select({ count: count() }).from(usersTable).where(eq(usersTable.role, "user"));
    const [totalAppsRow] = await db.select({ count: count() }).from(appsTable);
    const [totalLicensesRow] = await db.select({ count: count() }).from(appLicensesTable);
    const [activeLicensesRow] = await db
      .select({ count: count() })
      .from(appLicensesTable)
      .where(
        sql`(${appLicensesTable.expiresAt} IS NULL OR ${appLicensesTable.expiresAt} > NOW()) AND ${appLicensesTable.banned} = false`
      );
    const [totalMLRow] = await db.select({ count: count() }).from(masterLicensesTable);
    const [usedMLRow] = await db.select({ count: count() }).from(masterLicensesTable).where(eq(masterLicensesTable.used, true));

    res.json({
      totalUsers: totalUsersRow.count,
      totalApps: totalAppsRow.count,
      totalLicenses: totalLicensesRow.count,
      activeLicenses: activeLicensesRow.count,
      totalMasterLicenses: totalMLRow.count,
      usedMasterLicenses: usedMLRow.count,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to get stats" });
  }
});

router.get("/master-licenses", async (_req, res) => {
  try {
    const licenses = await db.select().from(masterLicensesTable).orderBy(sql`${masterLicensesTable.createdAt} DESC`);
    res.json(licenses.map(l => ({
      id: l.id,
      key: l.key,
      used: l.used,
      usedBy: l.usedBy ?? null,
      createdAt: l.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to list master licenses" });
  }
});

router.post("/master-licenses", async (_req, res) => {
  try {
    const key = generateKey("MASTER");
    const [license] = await db
      .insert(masterLicensesTable)
      .values({ key, used: false })
      .returning();

    res.status(201).json({
      id: license.id,
      key: license.key,
      used: license.used,
      usedBy: license.usedBy ?? null,
      createdAt: license.createdAt.toISOString(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to generate master license" });
  }
});

router.get("/users", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.role, "user")).orderBy(sql`${usersTable.createdAt} DESC`);
    const result = await Promise.all(
      users.map(async (u) => {
        const [appCountRow] = await db.select({ count: count() }).from(appsTable).where(eq(appsTable.userId, u.id));
        const [licCountRow] = await db.select({ count: count() }).from(appLicensesTable).where(eq(appLicensesTable.ownerId, u.ownerId));
        return {
          id: u.id,
          username: u.username,
          ownerId: u.ownerId,
          role: u.role,
          banned: u.banned,
          appCount: appCountRow.count,
          licenseCount: licCountRow.count,
          createdAt: u.createdAt.toISOString(),
        };
      })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to list users" });
  }
});

router.post("/users/:userId/ban", async (req, res) => {
  try {
    await db.update(usersTable).set({ banned: true }).where(eq(usersTable.id, req.params.userId));
    res.json({ success: true, message: "User banned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to ban user" });
  }
});

router.post("/users/:userId/unban", async (req, res) => {
  try {
    await db.update(usersTable).set({ banned: false }).where(eq(usersTable.id, req.params.userId));
    res.json({ success: true, message: "User unbanned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to unban user" });
  }
});

router.get("/alerts", async (_req, res) => {
  try {
    const alerts = await db.select().from(securityAlertsTable).orderBy(sql`${securityAlertsTable.createdAt} DESC`).limit(100);
    res.json(alerts.map(a => ({
      id: a.id,
      type: a.type,
      message: a.message,
      ownerid: a.ownerid,
      appId: a.appId,
      licenseKey: a.licenseKey ?? null,
      hwid: a.hwid ?? null,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error", message: "Failed to list alerts" });
  }
});

export default router;
