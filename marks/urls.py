from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('api/marks/', views.manage_marks, name='manage_marks'),
    path('api/update/', views.update_R_status, name='status'),
    path('api/reset-status/', views.reset_status, name='reset_status'),
    path('scorecard/<str:name>/', views.scorecard, name='scorecard'),

]
