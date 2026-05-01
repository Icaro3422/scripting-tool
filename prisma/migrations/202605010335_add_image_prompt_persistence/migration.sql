-- AlterTable
ALTER TABLE "Script" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'ai';

-- CreateTable
CREATE TABLE "ImagePromptSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "scriptContentHash" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "styleHash" TEXT NOT NULL,
    "splitConfig" JSONB NOT NULL,
    "splitConfigHash" TEXT NOT NULL,
    "fragmentCount" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagePromptSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImagePrompt" (
    "id" TEXT NOT NULL,
    "promptSetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fragmentId" INTEGER NOT NULL,
    "originalText" TEXT NOT NULL,
    "imagePrompt" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImagePrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImagePromptSet_userId_videoId_idx" ON "ImagePromptSet"("userId", "videoId");

-- CreateIndex
CREATE INDEX "ImagePromptSet_scriptId_idx" ON "ImagePromptSet"("scriptId");

-- CreateIndex
CREATE UNIQUE INDEX "ImagePromptSet_videoId_scriptId_scriptContentHash_styleHash_key" ON "ImagePromptSet"("videoId", "scriptId", "scriptContentHash", "styleHash", "splitConfigHash");

-- CreateIndex
CREATE INDEX "ImagePrompt_userId_idx" ON "ImagePrompt"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ImagePrompt_promptSetId_fragmentId_key" ON "ImagePrompt"("promptSetId", "fragmentId");

-- AddForeignKey
ALTER TABLE "ImagePromptSet" ADD CONSTRAINT "ImagePromptSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePromptSet" ADD CONSTRAINT "ImagePromptSet_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePromptSet" ADD CONSTRAINT "ImagePromptSet_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePrompt" ADD CONSTRAINT "ImagePrompt_promptSetId_fkey" FOREIGN KEY ("promptSetId") REFERENCES "ImagePromptSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImagePrompt" ADD CONSTRAINT "ImagePrompt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
