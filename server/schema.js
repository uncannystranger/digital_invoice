import { z } from "zod";
const text = (max = 200) => z.string().trim().max(max);
const required = (max = 200) => text(max).min(1, "Fadlan buuxi xogtan.");
const decimal = z
  .union([
    z.string().regex(/^\d{1,10}(\.\d{1,4})?$/),
    z.number().finite().nonnegative().max(1e10),
  ])
  .transform(String);
const email = z.union([z.literal(""), z.email().max(254)]);
const phone = text(30).refine(
  (v) => !v || /^\+?[\d\s()-]{6,25}$/.test(v),
  "Lambarka telefoonka sax ma aha.",
);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().startsWith(v),
    "Taariikhdu sax ma aha.",
  );
export const customerSchema = z.object({
  name: required(120),
  contact: text(120).default(""),
  phone: phone.default(""),
  email: email.default(""),
  address: text(400).default(""),
  city: text(100).default(""),
  notes: text(1000).default(""),
});
export const productSchema = z.object({
  name: required(150),
  description: text(500).default(""),
  price: decimal,
  currency: z.enum(["USD", "SOS"]),
  type: z.enum(["product", "service"]),
});
export const invoiceSchema = z
  .object({
    requestKey: z.uuid().optional(),
    customerId: z.uuid(),
    issue: date,
    due: date,
    currency: z.enum(["USD", "SOS"]),
    discountType: z.enum(["percent", "fixed"]),
    discount: decimal,
    taxType: z.enum(["percent", "fixed"]),
    tax: decimal,
    notes: text(2000).default(""),
    terms: text(2000).default(""),
    signature: text(150).default(""),
    paymentMethods: z.array(required(80)).max(10).default([]),
    items: z
      .array(
        z.object({
          description: required(500),
          quantity: decimal.refine(
            (v) => Number(v) > 0,
            "Tiradu waa inay ka badan tahay eber.",
          ),
          price: decimal,
        }),
      )
      .min(1, "Ku dar ugu yaraan hal shay.")
      .max(100),
    version: z.number().int().optional(),
  })
  .refine((v) => v.due >= v.issue, {
    message:
      "Taariikhda kama dambaysta ah kama horreyn karto taariikhda la sameeyay.",
    path: ["due"],
  })
  .refine((v) => v.discountType !== "percent" || Number(v.discount) <= 100, {
    message: "Dhimistu kama badnaan karto 100%.",
    path: ["discount"],
  })
  .refine((v) => v.taxType !== "percent" || Number(v.tax) <= 100, {
    message: "Canshuurtu kama badnaan karto 100%.",
    path: ["tax"],
  });
export const paymentSchema = z.object({
  amount: decimal.refine(
    (v) => Number(v) > 0,
    "Qiimuhu waa inuu ka badan yahay eber.",
  ),
  date: date.refine(
    (v) => v <= new Date().toISOString().slice(0, 10),
    "Taariikhda lacag-bixintu mustaqbal ma noqon karto.",
  ),
  method: required(80),
  reference: text(150).default(""),
  notes: text(1000).default(""),
  idempotencyKey: z.uuid(),
});
export const settingsSchema = z.object({
  name: required(120),
  phone,
  email,
  website: text(250).refine(
    (v) => !v || /^https?:\/\//i.test(v),
    "Isticmaal https://",
  ),
  address: text(400),
  city: text(100),
  country: text(100),
  registration: text(100),
  taxNumber: text(100),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  style: z.enum(["classic", "minimal"]),
  prefix: z.string().regex(/^[A-Z0-9]{1,10}$/),
  nextSequence: z.coerce.number().int().min(1).max(99999999),
  dueDays: z.coerce.number().int().min(0).max(365),
  currency: z.enum(["USD", "SOS"]),
  notes: text(2000),
  terms: text(2000),
  signature: text(150),
  methods: z
    .array(
      z.object({
        name: z.enum([
          "EVC Plus",
          "Zaad",
          "eDahab",
          "Sahal",
          "Bank Transfer",
          "Cash",
          "Other",
        ]),
        enabled: z.boolean(),
        details: text(600),
      }),
    )
    .length(7)
    .refine((v) => new Set(v.map((x) => x.name)).size === 7),
});
export const authSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  password: z
    .string()
    .min(12, "Furaha sirta ahi ha noqdo ugu yaraan 12 xaraf.")
    .max(128),
  name: required(100).optional(),
  business: required(120).optional(),
  sample: z.boolean().optional(),
});
