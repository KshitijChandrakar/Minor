from django.shortcuts import render


# Create your views here.
def main(request):
    return render(request, "mainUI/index.html")


def editor(request, projectId):
    return render(request, "mainUI/index.html")


def homepage(request):
    return render(request, "mainUI/homepage.html")


def sidebar(request):
    return render(request, "mainUI/sidebar.html")


def testing(request, name):
    return render(request, f"mainUI/{name}.html")
