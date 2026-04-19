import { Router } from "express";
import { db } from "@workspace/db";
import { apiKeysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

router.get("/keys/stats", async (req, res) => {
  try {
    const keys = await db.select().from(apiKeysTable);
    const active = keys.filter((k) => k.isActive).length;
    const inactive = keys.length - active;

    const providerMap: Record<string, number> = {};
    for (const k of keys) {
      const p = k.provider ?? "Unknown";
      providerMap[p] = (providerMap[p] ?? 0) + 1;
    }
    const providers = Object.entries(providerMap).map(([provider, count]) => ({ provider, count }));

    res.json({ total: keys.length, active, inactive, providers });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/keys", async (req, res) => {
  try {
    const keys = await db.select().from(apiKeysTable).orderBy(sql`${apiKeysTable.createdAt} DESC`);
    res.json(
      keys.map((k) => ({
        ...k,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString(),
      }))
    );
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

const createKeySchema = z.object({
  name: z.string().min(1),
  key: z.string().min(1),
  provider: z.string().optional(),
  note: z.string().optional(),
});

router.post("/keys", async (req, res) => {
  try {
    const parsed = createKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const { name, key, provider, note } = parsed.data;
    const [created] = await db
      .insert(apiKeysTable)
      .values({ name, key, provider: provider ?? null, note: note ?? null })
      .returning();
    res.status(201).json({
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

const importKeysSchema = z.object({
  keys: z.array(
    z.object({
      name: z.string().optional(),
      key: z.string().min(1),
      provider: z.string().optional(),
      note: z.string().optional(),
    })
  ),
});

router.post("/keys/import", async (req, res) => {
  try {
    const parsed = importKeysSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }

    const existingKeys = await db.select({ key: apiKeysTable.key }).from(apiKeysTable);
    const existingSet = new Set(existingKeys.map((k) => k.key));

    const toInsert = parsed.data.keys.filter((k) => !existingSet.has(k.key));
    const skipped = parsed.data.keys.length - toInsert.length;

    if (toInsert.length === 0) {
      res.status(201).json({ imported: 0, skipped, keys: [] });
      return;
    }

    const created = await db
      .insert(apiKeysTable)
      .values(
        toInsert.map((k, i) => ({
          name: k.name ?? `Imported Key ${i + 1}`,
          key: k.key,
          provider: k.provider ?? null,
          note: k.note ?? null,
        }))
      )
      .returning();

    res.status(201).json({
      imported: created.length,
      skipped,
      keys: created.map((k) => ({
        ...k,
        createdAt: k.createdAt.toISOString(),
        updatedAt: k.updatedAt.toISOString(),
      })),
    });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/keys/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [key] = await db.select().from(apiKeysTable).where(eq(apiKeysTable.id, id));
    if (!key) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    res.json({ ...key, createdAt: key.createdAt.toISOString(), updatedAt: key.updatedAt.toISOString() });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

const updateKeySchema = z.object({
  name: z.string().optional(),
  key: z.string().optional(),
  provider: z.string().optional(),
  note: z.string().optional(),
  isActive: z.boolean().optional(),
});

router.patch("/keys/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const parsed = updateKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request body" });
      return;
    }
    const [updated] = await db
      .update(apiKeysTable)
      .set(parsed.data)
      .where(eq(apiKeysTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    res.json({ ...updated, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() });
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/keys/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db.delete(apiKeysTable).where(eq(apiKeysTable.id, id)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Key not found" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    req.log.error(e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
