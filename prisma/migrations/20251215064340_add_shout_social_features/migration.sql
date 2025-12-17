-- CreateTable
CREATE TABLE "shouts" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "content" TEXT,
    "category" TEXT,
    "location" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "original_shout_id" TEXT,

    CONSTRAINT "shouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shout_medias" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "duration" INTEGER,
    "shout_id" TEXT NOT NULL,

    CONSTRAINT "shout_medias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shout_likes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "shout_id" TEXT NOT NULL,

    CONSTRAINT "shout_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shout_comments" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shout_id" TEXT NOT NULL,
    "parent_id" TEXT,

    CONSTRAINT "shout_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shout_likes_user_id_shout_id_key" ON "shout_likes"("user_id", "shout_id");

-- AddForeignKey
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shouts" ADD CONSTRAINT "shouts_original_shout_id_fkey" FOREIGN KEY ("original_shout_id") REFERENCES "shouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_medias" ADD CONSTRAINT "shout_medias_shout_id_fkey" FOREIGN KEY ("shout_id") REFERENCES "shouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_likes" ADD CONSTRAINT "shout_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_likes" ADD CONSTRAINT "shout_likes_shout_id_fkey" FOREIGN KEY ("shout_id") REFERENCES "shouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_comments" ADD CONSTRAINT "shout_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_comments" ADD CONSTRAINT "shout_comments_shout_id_fkey" FOREIGN KEY ("shout_id") REFERENCES "shouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_comments" ADD CONSTRAINT "shout_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "shout_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
