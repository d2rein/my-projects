from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
import json
import logging
import os
from pathlib import Path
import re
import sys
import threading
import time

import requests


ROOT = Path(__file__).resolve().parent
VENDOR = ROOT / "vendor"
if str(VENDOR) not in sys.path:
    sys.path.insert(0, str(VENDOR))

DEVICE_REGISTRY_PATH = ROOT / "data" / "push-devices.json"
FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"
TOKEN_PATTERN = re.compile(r"^[A-Za-z0-9_:.-]{20,4096}$")


class FirebasePushNotifier:
    def __init__(self, env: dict[str, str], logger: logging.Logger):
        self.env = env
        self.logger = logger
        self.lock = threading.RLock()
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="garage-push")
        self.credentials = None
        self.project_id: str | None = None
        self.devices = self._load_devices()
        self.last_confirmed_state: str | None = None
        self.last_successful_state: str | None = None
        self.last_attempt_by_state: dict[str, float] = {}
        self.last_open_push = 0.0
        self.last_success: str | None = None
        self.last_error: str | None = None
        try:
            self._load_credentials()
        except Exception as error:
            self.last_error = str(error) or error.__class__.__name__
            self.logger.error("Push notifications unavailable: %s", self.last_error)

    def _credential_path(self) -> Path:
        configured = self.env.get("FIREBASE_SERVICE_ACCOUNT", "").strip()
        if configured:
            path = Path(configured).expanduser()
            if not path.is_file():
                raise RuntimeError("FIREBASE_SERVICE_ACCOUNT does not point to a file")
            return path
        local = Path(os.environ.get("LOCALAPPDATA", "")) / "GarageDoorMonitor"
        candidates = []
        for path in local.glob("*.json") if local.is_dir() else []:
            try:
                document = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                continue
            if document.get("type") == "service_account" and document.get("project_id"):
                candidates.append(path)
        if len(candidates) != 1:
            raise RuntimeError("Expected exactly one Firebase service-account JSON in the local credential folder")
        return candidates[0]

    def _load_credentials(self) -> None:
        from google.oauth2 import service_account

        path = self._credential_path()
        document = json.loads(path.read_text(encoding="utf-8"))
        self.project_id = str(document["project_id"])
        self.credentials = service_account.Credentials.from_service_account_file(
            str(path), scopes=[FCM_SCOPE],
        )
        self.logger.info("Firebase push credentials loaded for project %s", self.project_id)

    def _load_devices(self) -> dict[str, dict]:
        if not DEVICE_REGISTRY_PATH.exists():
            return {}
        try:
            document = json.loads(DEVICE_REGISTRY_PATH.read_text(encoding="utf-8"))
            devices = document.get("devices", {})
            return devices if isinstance(devices, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_devices(self) -> None:
        DEVICE_REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        temporary = DEVICE_REGISTRY_PATH.with_suffix(".json.tmp")
        temporary.write_text(json.dumps({"devices": self.devices}, indent=2), encoding="utf-8")
        os.replace(temporary, DEVICE_REGISTRY_PATH)

    def register(self, token: str, device: str = "Android phone", app_version: str = "") -> dict:
        token = str(token).strip()
        if not TOKEN_PATTERN.fullmatch(token):
            raise ValueError("Invalid Firebase registration token")
        with self.lock:
            self.devices[token] = {
                "device": str(device).strip()[:100] or "Android phone",
                "appVersion": str(app_version).strip()[:30],
                "registeredAt": datetime.now().astimezone().isoformat(timespec="seconds"),
            }
            self._save_devices()
            return {"ok": True, "registeredDevices": len(self.devices), "pushConfigured": self.configured}

    @property
    def configured(self) -> bool:
        return self.credentials is not None and bool(self.project_id)

    def status(self) -> dict:
        with self.lock:
            return {
                "configured": self.configured,
                "registeredDevices": len(self.devices),
                "lastSuccess": self.last_success,
                "lastError": self.last_error,
            }

    def observe_confirmed_state(self, state: str, confidence: float, occurred_at: str) -> None:
        if state not in ("OPEN", "CLOSED"):
            return
        now = time.monotonic()
        reminder_seconds = max(60, int(self.env.get("FIREBASE_OPEN_REMINDER_SECONDS", "600")))
        with self.lock:
            changed = state != self.last_confirmed_state
            should_remind = state == "OPEN" and now - self.last_open_push >= reminder_seconds
            should_retry = state != self.last_successful_state and now - self.last_attempt_by_state.get(state, 0.0) >= 60
            self.last_confirmed_state = state
            if not changed and not should_remind and not should_retry:
                return
            self.last_attempt_by_state[state] = now
            if state == "OPEN":
                self.last_open_push = now
            reminder = state == "OPEN" and not changed
        self.executor.submit(self._broadcast, state, confidence, occurred_at, reminder)

    def send_test(self) -> dict:
        if not self.configured:
            raise RuntimeError(self.last_error or "Firebase push is not configured")
        with self.lock:
            count = len(self.devices)
        if count == 0:
            raise RuntimeError("No phones have registered for push notifications")
        self.executor.submit(self._broadcast, "TEST", 0.0, datetime.now().astimezone().isoformat(timespec="seconds"), False)
        return {"queued": True, "registeredDevices": count}

    def _access_token(self) -> str:
        from google.auth.transport.requests import Request

        if self.credentials is None:
            raise RuntimeError(self.last_error or "Firebase push is not configured")
        if not self.credentials.valid:
            self.credentials.refresh(Request())
        return str(self.credentials.token)

    def _broadcast(self, state: str, confidence: float, occurred_at: str, reminder: bool) -> None:
        if not self.configured:
            return
        with self.lock:
            tokens = list(self.devices)
        if not tokens:
            return
        try:
            access_token = self._access_token()
            stale = []
            successes = 0
            for token in tokens:
                result = self._send_one(access_token, token, state, confidence, occurred_at, reminder)
                if result == "ok":
                    successes += 1
                elif result == "stale":
                    stale.append(token)
            with self.lock:
                for token in stale:
                    self.devices.pop(token, None)
                if stale:
                    self._save_devices()
                self.last_success = datetime.now().astimezone().isoformat(timespec="seconds") if successes else self.last_success
                self.last_error = None if successes else self.last_error
                if successes:
                    self.last_successful_state = state
            self.logger.info("Firebase %s push delivered to %d phone(s)%s", state, successes, f"; removed {len(stale)} stale token(s)" if stale else "")
        except Exception as error:
            message = str(error) or error.__class__.__name__
            with self.lock:
                self.last_error = message
            self.logger.error("Firebase %s push failed: %s", state, message)

    def _send_one(self, access_token: str, token: str, state: str, confidence: float, occurred_at: str, reminder: bool) -> str:
        url = f"https://fcm.googleapis.com/v1/projects/{self.project_id}/messages:send"
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {access_token}"},
            json={
                "message": {
                    "token": token,
                    "data": {
                        "kind": "garage-door-state",
                        "state": state,
                        "confidence": f"{confidence:.3f}",
                        "occurredAt": occurred_at,
                        "reminder": "true" if reminder else "false",
                    },
                    "android": {
                        "priority": "HIGH",
                        "ttl": "86400s",
                        "collapse_key": "garage-door-state",
                    },
                },
            },
            timeout=15,
        )
        if response.ok:
            return "ok"
        try:
            payload = response.json()
        except ValueError:
            payload = {}
        detail = json.dumps(payload, separators=(",", ":"))[:500]
        if response.status_code in (404, 410) or "UNREGISTERED" in detail:
            return "stale"
        raise RuntimeError(f"FCM HTTP {response.status_code}: {detail or response.reason}")
