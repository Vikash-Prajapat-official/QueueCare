import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { readJson, requireRole, route } from "@/lib/api";
import type { AdminEntity } from "@/lib/admin/entities";

type ItemCtx = { params: Promise<{ id: string }> };

/** GET (list) and POST (create) for one admin entity. ADMIN only, checked before anything else. */
export function collectionHandlers(entity: AdminEntity) {
  return {
    GET: route(async () => {
      await requireRole(["ADMIN"]);
      return NextResponse.json({ items: await entity.list() });
    }),
    POST: route(async (req: Request) => {
      const actor = await requireRole(["ADMIN"]);
      const created = await entity.create(await readJson(req), actor);
      await audit(actor.id, "create", entity.name, created.id, req);
      return NextResponse.json({ item: created }, { status: 201 });
    }),
  };
}

/** PATCH (and DELETE where the entity allows it) for one record. ADMIN only. */
export function itemHandlers(entity: AdminEntity) {
  return {
    PATCH: route(async (req: Request, ctx: ItemCtx) => {
      const actor = await requireRole(["ADMIN"]);
      const { id } = await ctx.params;
      const updated = await entity.update(id, await readJson(req), actor);
      await audit(actor.id, "update", entity.name, id, req);
      return NextResponse.json({ item: updated });
    }),
    DELETE: route(async (req: Request, ctx: ItemCtx) => {
      const actor = await requireRole(["ADMIN"]);
      const { id } = await ctx.params;
      if (!entity.remove) {
        return NextResponse.json(
          { error: { code: "METHOD_NOT_ALLOWED", message: "This record cannot be deleted." } },
          { status: 405 },
        );
      }
      await entity.remove(id);
      await audit(actor.id, "delete", entity.name, id, req);
      return NextResponse.json({ ok: true });
    }),
  };
}
