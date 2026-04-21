# forms.py
import re

from django import forms
from django.contrib.auth.forms import AuthenticationForm, PasswordChangeForm
from django.core.exceptions import ValidationError

from mainUI.models import User


class UserRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, min_length=8)
    confirm_password = forms.CharField(widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = [
            "email",
            "name",
        ]

    def clean_email(self):
        email = self.cleaned_data.get("email")
        if User.objects.filter(email=email).exists():
            raise ValidationError("Email already registered")
        return email

    def clean_name(self):
        name = self.cleaned_data.get("name")
        if not name.strip():
            raise ValidationError("Name is required")
        return name.strip()

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirm_password = cleaned_data.get("confirm_password")

        if password and confirm_password and password != confirm_password:
            raise ValidationError("Passwords do not match")

        # Optional: Add password strength validation
        if password:
            if len(password) < 8:
                raise ValidationError("Password must be at least 8 characters")
            if not re.search(r"[A-Z]", password):
                raise ValidationError(
                    "Password must contain at least one uppercase letter"
                )
            if not re.search(r"[0-9]", password):
                raise ValidationError("Password must contain at least one number")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data["password"])
        # Initialize file_store as empty dict
        user.file_store = {}
        if commit:
            user.save()
        return user


class UserLoginForm(AuthenticationForm):
    username = forms.EmailField(
        widget=forms.EmailInput(attrs={"class": "form-control"})
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={"class": "form-control"})
    )
