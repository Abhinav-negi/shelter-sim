-- CreateTable
CREATE TABLE "WeatherCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "series" JSONB NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "sourceElevation" REAL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DesignSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shareId" TEXT NOT NULL,
    "request" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME
);

-- CreateTable
CREATE TABLE "SimulationRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestHash" TEXT NOT NULL,
    "kpis" JSONB NOT NULL,
    "meta" JSONB NOT NULL,
    "fullResult" JSONB,
    "engineVersion" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameHi" TEXT,
    "category" TEXT NOT NULL,
    "k" REAL NOT NULL,
    "rho" REAL NOT NULL,
    "c" REAL NOT NULL,
    "alphaSolar" REAL NOT NULL,
    "emissivity" REAL NOT NULL,
    "costPerM3" REAL,
    "locallyAvailableLadakh" BOOLEAN NOT NULL,
    "embodiedCarbon" REAL,
    "source" TEXT NOT NULL,
    "blurb" TEXT
);

-- CreateIndex
CREATE INDEX "WeatherCache_expiresAt_idx" ON "WeatherCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherCache_source_latitude_longitude_startDate_endDate_key" ON "WeatherCache"("source", "latitude", "longitude", "startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "DesignSnapshot_shareId_key" ON "DesignSnapshot"("shareId");

-- CreateIndex
CREATE INDEX "DesignSnapshot_createdAt_idx" ON "DesignSnapshot"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationRun_requestHash_key" ON "SimulationRun"("requestHash");

-- CreateIndex
CREATE INDEX "SimulationRun_computedAt_idx" ON "SimulationRun"("computedAt");

-- CreateIndex
CREATE INDEX "SimulationRun_engineVersion_idx" ON "SimulationRun"("engineVersion");

-- CreateIndex
CREATE INDEX "Material_category_idx" ON "Material"("category");

-- CreateIndex
CREATE INDEX "Material_locallyAvailableLadakh_idx" ON "Material"("locallyAvailableLadakh");
