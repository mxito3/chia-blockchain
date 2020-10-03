import json
from typing import Dict, Any

import asyncio
import websockets

from pathlib import Path

from src.types.sized_bytes import bytes32
from src.util.ws_message import create_payload
from src.util.json_util import dict_to_json_str
from src.util.config import load_config
from src.server.ssl_context import ssl_context_for_client


class DaemonProxy:
    def __init__(self, uri, net_config, root_path):
        self._uri = uri
        self._request_dict: Dict[bytes32, asyncio.Event] = {}
        self.response_dict: Dict[bytes32, Any] = {}
        self.websocket = None
        self.net_config = net_config
        self.root_path = root_path

    def format_request(self, command, data=None):
        request = create_payload(command, data, "client", "daemon", False)
        return request

    async def start(self, auth: bool = False):
        ssl_context = ssl_context_for_client(self.root_path, self.net_config, auth=auth)
        self.websocket = await websockets.connect(
            self._uri, max_size=None, ssl=ssl_context
        )

        async def listener():
            while True:
                try:
                    message = await self.websocket.recv()
                except websockets.exceptions.ConnectionClosedOK:
                    return
                decoded = json.loads(message)
                id = decoded["request_id"]

                if id in self._request_dict:
                    if id in self._request_dict:
                        self.response_dict[id] = decoded
                        self._request_dict[id].set()

        asyncio.create_task(listener())
        await asyncio.sleep(1)

    async def _get(self, request):
        request_id = request["request_id"]
        self._request_dict[request_id] = asyncio.Event()
        string = dict_to_json_str(request)
        asyncio.ensure_future(self.websocket.send(string))

        async def timeout():
            await asyncio.sleep(30)
            if request_id in self._request_dict:
                print("Error, timeout.")
                self._request_dict[request_id].set()

        asyncio.ensure_future(timeout())
        await self._request_dict[request_id].wait()
        if request_id in self.response_dict:
            response = self.response_dict[request_id]
            self.response_dict.pop(request_id)
        else:
            response = None
        self._request_dict.pop(request_id)

        return response

    async def start_service(self, service_name):
        data = {"service": service_name}
        request = self.format_request("start_service", data)
        response = await self._get(request)
        return response

    async def stop_service(self, service_name, delay_before_kill=15):
        data = {"service": service_name}
        request = self.format_request("stop_service", data)
        response = await self._get(request)
        return response

    async def is_running(self, service_name):
        data = {"service": service_name}
        request = self.format_request("is_running", data)
        response = await self._get(request)
        is_running = response["data"]["is_running"]
        return is_running

    async def ping(self):
        request = self.format_request("ping")
        response = await self._get(request)
        return response

    async def close(self):
        await self.websocket.close()

    async def exit(self):
        request = self.format_request("exit", {})
        return await self._get(request)


async def connect_to_daemon(
    self_hostname: str,
    daemon_port: int,
    net_config: Dict,
    root_path: Path,
    auth: bool = False,
):
    """
    Connect to the local daemon.
    """

    client = DaemonProxy(f"wss://{self_hostname}:{daemon_port}", net_config, root_path)
    await client.start(auth=auth)
    return client


async def connect_to_daemon_and_validate(root_path, auth: bool = False):
    """
    Connect to the local daemon and do a ping to ensure that something is really
    there and running.
    """
    try:
        net_config = load_config(root_path, "config.yaml")
        connection = await connect_to_daemon(
            net_config["self_hostname"],
            net_config["daemon_port"],
            net_config,
            root_path,
            auth=auth,
        )
        r = await connection.ping()

        if r["data"]["value"] == "pong":
            return connection
    except Exception as ex:
        # ConnectionRefusedError means that daemon is not yet running
        if not isinstance(ex, ConnectionRefusedError):
            print(f"Exception connecting to daemon: {ex}")
        return None
