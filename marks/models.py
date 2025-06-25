from django.db import models

class Mark(models.Model):
    name = models.CharField(max_length=100)
    dob = models.DateField()
    date = models.DateField()
    subject = models.CharField(max_length=50)
    marks = models.FloatField()
    out_of = models.FloatField()
    r_status = models.CharField(max_length=10, default='pending', choices=[
        ('pending', 'Pending'),
        ('pass', 'Pass'),
        ('fail', 'Fail'),
    ])

    class Meta:
        unique_together = ('name', 'subject')

    def __str__(self):
        return f"{self.name} - {self.subject} ({self.marks}/{self.out_of})"

    @property
    def percentage(self):
        if self.out_of == 0:
            return 0.0
        return (self.marks / self.out_of) * 100

    @property
    def result(self):
        return "Pass" if self.percentage >= 40 else "Fail"