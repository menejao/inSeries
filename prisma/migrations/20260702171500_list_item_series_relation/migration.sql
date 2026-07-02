-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

