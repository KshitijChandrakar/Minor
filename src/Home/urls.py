# from django.contrib import admin
from django.urls import include, path

# import mainUI.views as views
# urls.py
from django.urls import path
from . import authentication as auth

# app_name = 'authentication'

urlpatterns = [
    path("register/", auth.register_view, name="register"),
    path("login/", auth.login_view, name="login"),
    path("logout/", auth.logout_view, name="logout"),
    path("dashboard/", auth.dashboard_view, name="dashboard"),
    path("", auth.homepage),
]
