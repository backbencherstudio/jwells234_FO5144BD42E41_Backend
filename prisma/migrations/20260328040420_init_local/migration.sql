-- CreateIndex
CREATE INDEX "shout_comments_shout_id_idx" ON "shout_comments"("shout_id");

-- CreateIndex
CREATE INDEX "shout_comments_parent_id_idx" ON "shout_comments"("parent_id");
