-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('INDIVIDUAL', 'COMPANY');

-- CreateEnum
CREATE TYPE "PayoutSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterTable
ALTER TABLE "Architect" ADD COLUMN     "accountDeletionRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "accountType" "AccountType",
ADD COLUMN     "allowPaidModifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "businessRegistrationNumber" TEXT,
ADD COLUMN     "company" TEXT,
ADD COLUMN     "companyVisibility" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "copyrightDisplayName" TEXT,
ADD COLUMN     "currencyPreference" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "dataExportRequested" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "defaultLicenseType" "LicenseType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "emailNotifications" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "legalName" TEXT,
ADD COLUMN     "modificationPricingStrategy" TEXT,
ADD COLUMN     "payoutCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "payoutSchedule" "PayoutSchedule" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "professionalTitle" TEXT,
ADD COLUMN     "publicProfileVisibility" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "searchEngineIndexing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "taxCountry" TEXT,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vatTaxId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "profilePhotoUrl" TEXT,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';
