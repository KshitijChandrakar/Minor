from django.contrib import admin
from django.urls import include, path

import mainUI.views as views

urlpatterns = [
    path("", views.main),
    path("index", views.main1),
    path("testing", views.testing),
]
