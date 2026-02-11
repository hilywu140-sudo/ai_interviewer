from typing import Dict, List
from fastapi import WebSocket
import json


class ConnectionManager:
    """WebSocket 连接管理器"""

    def __init__(self):
        # session_id -> List[WebSocket]
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        """建立 WebSocket 连接"""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
        self.active_connections[session_id].append(websocket)
        print(f"WebSocket connected: session={session_id}, total={len(self.active_connections[session_id])}")

    def disconnect(self, websocket: WebSocket, session_id: str):
        """断开 WebSocket 连接"""
        if session_id in self.active_connections:
            self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
        print(f"WebSocket disconnected: session={session_id}")

    async def send_message(self, session_id: str, message: dict):
        """发送消息到指定会话的所有连接"""
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error sending message: {e}")

    async def broadcast(self, message: dict):
        """广播消息到所有连接"""
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting message: {e}")


# 全局连接管理器实例
manager = ConnectionManager()
