import { LicenseType } from "@prisma/client";

export const assertModificationAllowed = (
  licenseType: LicenseType,
  actor: "BUYER" | "ARCHITECT",
  action: "REQUEST" | "CONTACT"
) => {
  if (licenseType === "STANDARD" && action === "CONTACT") {
    throw new Error("Direct contact is not allowed for standard licenses");
  }

  if (actor === "ARCHITECT" && action === "REQUEST") {
    throw new Error("Architect cannot request modifications");
  }
};