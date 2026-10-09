import { z } from "zod";

// Contract area ids: [a-z0-9-], 1 to 64 characters.
const AreaId = z.string().regex(/^[a-z0-9-]{1,64}$/);
const Name = z.string().min(1);
const Ring = z.array(z.tuple([z.number(), z.number()], z.number()));

const Geometry = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: z.array(Ring) }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(z.array(Ring)) }),
]);

// Unknown properties (ac_no, pc_no, category, eci_state) are stripped on parse.
const AssemblySeat = z.object({ id: AreaId, name: Name, pc_id: AreaId });
const LokSabhaSeat = z.object({ id: AreaId, name: Name, state: Name, status: z.enum(["current", "outdated"]) });

export const AssemblyCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.object({ geometry: Geometry, properties: AssemblySeat })),
});

export const LokSabhaCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(z.object({ geometry: Geometry, properties: LokSabhaSeat })),
});

export const LocalBodyRows = z.array(
  z.object({ id: AreaId, name: Name, head_office: Name, state: Name, towns: z.array(Name) }),
);

export const RepresentativeRows = z.array(
  z.object({
    office: z.enum(["councillor", "mla", "mp"]),
    seat_id: AreaId,
    as_of: z.iso.date(),
    source: z.url(),
  }),
);
