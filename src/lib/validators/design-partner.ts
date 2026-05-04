import { z } from "zod";

const sanitizeText = (value: string) =>
  value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

const sanitizedString = () =>
  z.string().transform((value) => sanitizeText(value));

export const companyTypeValues = [
  "startup",
  "dev_agency",
  "open_source",
  "other",
] as const;

export const companyTypeLabels: Record<
  (typeof companyTypeValues)[number],
  string
> = {
  startup: "Startup",
  dev_agency: "Dev Agency",
  open_source: "Open Source",
  other: "Other",
};

export const designPartnerSchema = z.object({
  name: sanitizedString().pipe(
    z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters.")
      .max(120, "Name is too long."),
  ),
  workEmail: sanitizedString().pipe(
    z
      .string()
      .trim()
      .email("Enter a valid work email address.")
      .max(200, "Email is too long."),
  ),
  companyName: sanitizedString().pipe(
    z
      .string()
      .trim()
      .min(2, "Company name is required.")
      .max(200, "Company name is too long."),
  ),
  companyType: z.enum(companyTypeValues, {
    message: "Select your company type.",
  }),
  painPoint: sanitizedString().pipe(
    z
      .string()
      .trim()
      .min(20, "Please add at least 20 characters.")
      .max(2000, "Keep this under 2000 characters."),
  ),
});

export type DesignPartnerInput = z.input<typeof designPartnerSchema>;
export type DesignPartnerValues = z.output<typeof designPartnerSchema>;
