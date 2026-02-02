import { ModificationStatus } from "@prisma/client";

export type ModificationActor = "BUYER" | "ARCHITECT" | "SYSTEM";

export const canActorChangeStatus = (
  actor: ModificationActor,
  status: ModificationStatus
): boolean => {
  const rules: Record<ModificationStatus, ModificationActor[]> = {
    REQUESTED: ["BUYER"],
    PRICED: ["ARCHITECT"],
    ACCEPTED: ["BUYER"],
    PAID: ["SYSTEM"],
    IN_PROGRESS: ["ARCHITECT"],
    DELIVERED: ["ARCHITECT"],
    COMPLETED: ["BUYER"],
    DECLINED: ["BUYER", "ARCHITECT"]
  };

  return rules[status]?.includes(actor) ?? false;
};