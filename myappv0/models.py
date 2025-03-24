from django.db import models

class Chapter(models.Model):
    chapter_number = models.IntegerField(db_index=True)
    title = models.CharField(max_length=255)

    class Meta:
        managed = False  # ✅ Prevent Django from creating/migrating myappv0_chapter

class KeyPoint(models.Model):
    chapter = models.ForeignKey(Chapter, on_delete=models.CASCADE, related_name='keypoints')
    header = models.CharField(max_length=255)
    body = models.TextField()
    number_of_correct = models.IntegerField(default=0, db_index=True)
