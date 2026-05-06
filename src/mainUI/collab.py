import asyncio
from y_py import YDoc, YText
from channels_yroom.consumer import YroomConsumer

import y_py as Y
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from ypy_websocket.django_channels_consumer import YjsConsumer
from ypy_websocket.yutils import create_update_message


class CollaborationConsumer(YjsConsumer):
    # ----- YDoc cache per room -----
    _room_docs = {}  # room_name -> Y.YDoc
    _room_docs_lock = None  # lazy-initialized asyncio.Lock

    @classmethod
    async def _get_lock(cls):
        if cls._room_docs_lock is None:
            cls._room_docs_lock = asyncio.Lock()
        return cls._room_docs_lock

    async def make_ydoc(self) -> Y.YDoc:
        room = self.room_name
        lock = await self._get_lock()
        async with lock:
            if room in self._room_docs:
                return self._room_docs[room]

            doc = Y.YDoc()
            user = self.scope.get("user", None)

            if user is None or user.is_anonymous:
                print("user was none")
                self._room_docs[room] = doc
                return doc

            files = user.file_store.get(room, None)
            if files is not None:
                for file, value in files["files"].items():
                    text = doc.get_text(file)
                    current = text.to_json()
                    if not current:  # only write if truly empty
                        with doc.begin_transaction() as txn:
                            text.extend(txn, value)

            self._room_docs[room] = doc
            return doc

    def make_room_name(self) -> str:
        roomname = self.scope.get("url_route", {}).get("kwargs", {}).get("room_name")
        print(f"Making room with id {roomname}, route is {self.scope}")
        return roomname

    async def connect(self):
        user = self.scope.get("user", 0)
        print("User connected", user)
        if user is None or user.is_anonymous:
            await self.close()
            return
        await super().connect()

    # Uncomment and use if you need custom update handling,
    # but the base YjsConsumer already applies updates to self.ydoc.
    # async def doc_update(self, update_wrapper):
    #     update = update_wrapper["update"]
    #     Y.apply_update(self.ydoc, update)
    #     await self.group_send_message(create_update_message(update))


def send_doc_update(room_name, update):
    layer = get_channel_layer()
    async_to_sync(layer.group_send)(room_name, {"type": "doc_update", "update": update})
