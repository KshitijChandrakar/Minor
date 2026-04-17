# from django.contrib import admin
from django.urls import include, path

# import mainUI.views as views
# urls.py
from django.urls import path
from . import views
from . import api
from . import authentication as auth

# app_name = 'authentication'

urlpatterns = [
    path('register/', auth.register_view, name='register'),
    path('login/', auth.login_view, name='login'),
    path('logout/', auth.logout_view, name='logout'),
    path('dashboard/', auth.dashboard_view, name='dashboard'),
    path('profile/', auth.get_user_profile_view, name='profile'),

    # Editor URLS
    path("editor/<str:projectId>", views.editor),
    path("editor1", views.main),
    path("testing", views.testing),
    

    path("api/filesFetch/<str:projectID>", api.filesFetch),
    path("api/filesChange", api.filesChange),
    path("",views.homepage),


]
