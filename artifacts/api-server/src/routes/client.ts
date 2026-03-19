import { Router } from "express";
import { db, appLicensesTable, appsTable, securityAlertsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CheckLicenseQueryParams, HeartbeatBody as HeartbeatBodySchema } from "@workspace/api-zod";

const router = Router();

async function validateLicense(params: {
  ownerid: string;
  username: string;
  license: string;
  hwid: string;
  appid: string;
}): Promise<{ status: "valid" | "invalid"; message: string; username?: string | null; expiresAt?: string | null }> {
  const { ownerid, username, license, hwid, appid } = params;

  const [app] = await db.select().from(appsTable).where(eq(appsTable.appId, appid));
  if (!app) {
    return { status: "invalid", message: "Invalid AppID" };
  }

  if (app.ownerId !== ownerid) {
    await db.insert(securityAlertsTable).values({
      type: "UNAUTHORIZED_ACCESS",
      message: `AppID "${appid}" does not belong to OwnerID "${ownerid}". Possible unauthorized access attempt.`,
      ownerid,
      appId: appid,
      licenseKey: license,
      hwid,
    });
    return { status: "invalid", message: "Unauthorized: AppID does not belong to this OwnerID" };
  }

  const [ownerUser] = await db.select().from(usersTable).where(eq(usersTable.ownerId, ownerid));
  if (!ownerUser || ownerUser.banned) {
    return { status: "invalid", message: "Account is suspended" };
  }

  const [lic] = await db
    .select()
    .from(appLicensesTable)
    .where(and(eq(appLicensesTable.licenseKey, license), eq(appLicensesTable.appId, appid)));

  if (!lic) {
    return { status: "invalid", message: "Invalid license key" };
  }

  if (lic.banned) {
    return { status: "invalid", message: "License is banned" };
  }

  if (lic.expiresAt && lic.expiresAt < new Date()) {
    return { status: "invalid", message: "License has expired" };
  }

  if (!lic.hwid) {
    await db
      .update(appLicensesTable)
      .set({ hwid, username, lastLogin: new Date() })
      .where(eq(appLicensesTable.id, lic.id));
  } else if (lic.hwid !== hwid) {
    return { status: "invalid", message: "HWID mismatch — license is bound to a different machine" };
  } else {
    await db
      .update(appLicensesTable)
      .set({ username, lastLogin: new Date() })
      .where(eq(appLicensesTable.id, lic.id));
  }

  return {
    status: "valid",
    message: "License valid",
    username,
    expiresAt: lic.expiresAt ? lic.expiresAt.toISOString() : null,
  };
}

router.get("/check", async (req, res) => {
  try {
    const parsed = CheckLicenseQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ status: "invalid", message: "Missing required parameters: ownerid, username, license, hwid, appid" });
      return;
    }
    const result = await validateLicense(parsed.data);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "invalid", message: "Internal server error" });
  }
});

router.post("/heartbeat", async (req, res) => {
  try {
    const parsed = HeartbeatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: "invalid", message: "Missing required parameters" });
      return;
    }
    const result = await validateLicense(parsed.data);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "invalid", message: "Internal server error" });
  }
});

export default router;
