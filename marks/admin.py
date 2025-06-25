from django.contrib import admin
from .models import Mark

@admin.register(Mark)
class MarkAdmin(admin.ModelAdmin):
    """
    Customizes the display of Mark objects in the Django admin interface.
    """
    # Columns to display in the admin list view
    list_display = ('name', 'dob', 'date', 'subject', 'marks', 'out_of', 'percentage', 'result')
    
    # Enable filters for actual model fields only (removed 'result')
    list_filter = ('subject', 'date')
    
    # Enable search functionality
    search_fields = ('name', 'subject')
    
    # Fields to show in the create/edit admin form
    fields = ('name', 'dob', 'date', 'subject', 'marks', 'out_of')
