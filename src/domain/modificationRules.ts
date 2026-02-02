import { ModificationStatus } from "@prisma/client";

export const canTransition = (
  from: ModificationStatus,
  to: ModificationStatus
): boolean => {
  const allowed: Record<ModificationStatus, ModificationStatus[]> = {
    REQUESTED: ["PRICED", "DECLINED"],
    PRICED: ["ACCEPTED", "DECLINED"],
    ACCEPTED: ["PAID"],
    PAID: ["IN_PROGRESS"],
    IN_PROGRESS: ["DELIVERED"],
    DELIVERED: ["COMPLETED"],
    COMPLETED: [],
    DECLINED: []
  };

  return allowed[from]?.includes(to) ?? false;
};