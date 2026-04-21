# from django.contrib import admin
from django.urls import include, path

# import mainUI.views as views
# urls.py
from django.urls import path
from . import views
from . import api

# from . import authentication as auth

# app_name = 'authentication'

urlpatterns = [
    # Editor URLS
    path("editor/<str:projectId>", views.editor),
    path("editor1", views.main),
    path("testing", views.testing),
    # API Definitions
    path("api/filesFetch/<str:projectID>", api.filesFetch),
    path("api/filesChange", api.filesChange),
    path("api/filesList", api.filesList),
    path("", views.homepage),
]
