import { LicenseType } from "@prisma/client";

type ContactContext = {
  licenseType: LicenseType;
  exclusivePaid: boolean;
};

export const canAccessDirectContact = ({
  licenseType,
  exclusivePaid
}: ContactContext): boolean => {
  return licenseType === "EXCLUSIVE" && exclusivePaid === true;
};