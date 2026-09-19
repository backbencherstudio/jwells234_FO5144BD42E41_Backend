-- CreateTable
CREATE TABLE "shout_comment_likes" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "shout_comment_id" TEXT NOT NULL,

    CONSTRAINT "shout_comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shout_comment_likes_user_id_shout_comment_id_key" ON "shout_comment_likes"("user_id", "shout_comment_id");

-- AddForeignKey
ALTER TABLE "shout_comment_likes" ADD CONSTRAINT "shout_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shout_comment_likes" ADD CONSTRAINT "shout_comment_likes_shout_comment_id_fkey" FOREIGN KEY ("shout_comment_id") REFERENCES "shout_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
