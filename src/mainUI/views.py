from django.shortcuts import render


# Create your views here.
def main(request):
    return render(request, "mainUI/index.html")


def main1(request):
    return render(request, "mainUI/index2.html")


def sidebar(request):
    return render(request, "mainUI/sidebar.html")


def testing(request):
    return render(request, "mainUI/testing.html")
