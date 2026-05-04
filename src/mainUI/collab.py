from y_py import YDoc, YText
from channels_yroom.consumer import YroomConsumer


import y_py as Y
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ypy_websocket.django_channels_consumer import YjsConsumer
from ypy_websocket.yutils import create_update_message


class CollaborationConsumer(YjsConsumer):
    def make_room_name(self) -> str:
        roomname = self.scope.get("url_route", {}).get("kwargs", {}).get("room_name")
        print(f"Making room with id {roomname}, route is {self.scope}")
        return roomname

    async def make_ydoc(self) -> Y.YDoc:
        doc = Y.YDoc()
        user = self.scope.get("user", None)
        room = self.room_name
        if user is None or user.is_anonymous:
            print("user was none")
            return

        files = user.file_store.get(room, None)
        if files is None:
            print("Files was none")
            return

        for file, value in files["files"].items():
            text = doc.get_text(file)
            if len(text.to_json()) <= 2:
                with doc.begin_transaction() as txn:
                    # Add text contents
                    text.extend(txn, value)
            pass
        for file, value in files["files"].items():
            text = doc.get_text(file)
            print(text.to_json())

        # fill doc with data from DB here
        # doc.observe_after_transaction(self.on_update_event)
        # doc.yText.getText("content")
        return doc

    async def connect(self):
        user = self.scope.get("user", 0)
        # print(dir(user))
        print("User connected", user)
        if user is None or user.is_anonymous:
            await self.close()
            return
        await super().connect()

    # def on_update_event(self, event):
    # process event here
    # ...

    # async def doc_update(self, update_wrapper):
    #     update = update_wrapper["update"]
    #     Y.apply_update(self.ydoc, update)
    #     await self.group_send_message(create_update_message(update))


def send_doc_update(room_name, update):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(room_name, {"type": "doc_update", "update": update})
