-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterReset" (
    "id" TEXT NOT NULL,
    "semesterId" TEXT NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetBy" TEXT NOT NULL,
    "resetByName" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "SemesterReset_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SemesterReset" ADD CONSTRAINT "SemesterReset_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
