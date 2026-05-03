# mainUI/routing.py
from django.urls import re_path

from channels_yroom.consumer import YroomConsumer  # if using option A

# OR
# from pycrdt_websocket.django_channels import YpyConsumer  # if using option B

websocket_urlpatterns = [
    # Matches ws://.../ws/collab/<room_name>/
    re_path(
        r"ws/collab/(?P<room_name>[^/]+)/$", YroomConsumer.as_asgi()
    ),  # or YpyConsumer
]
