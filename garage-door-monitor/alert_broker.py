from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import logging
import threading
import time

import requests


class AlertBrokerClient:
    """Optional generic-alert publisher with automatic retry on later observations."""

    def __init__(self, env: dict[str, str], logger: logging.Logger):
        self.url = env.get("ALERT_BROKER_URL", "").strip().rstrip("/")
        self.key = env.get("ALERT_GARAGE_KEY", "").strip()
        self.logger = logger
        self.executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="garage-alert-broker")
        self.lock = threading.RLock()
        self.last_successful_state: str | None = None
        self.last_attempt_by_state: dict[str, float] = {}

    @property
    def configured(self) -> bool:
        return bool(self.url and self.key)

    def observe_confirmed_state(self, state: str, confidence: float, occurred_at: str) -> None:
        if not self.configured or state not in {"OPEN", "CLOSED"}:
            return
        now = time.monotonic()
        with self.lock:
            if state == self.last_successful_state:
                return
            if now - self.last_attempt_by_state.get(state, 0.0) < 60:
                return
            self.last_attempt_by_state[state] = now
        self.executor.submit(self._publish, state, confidence, occurred_at)

    def _publish(self, state: str, confidence: float, occurred_at: str) -> None:
        try:
            response = requests.post(
                f"{self.url}/api/alerts",
                headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
                json={
                    "id": "garage:main",
                    "category": "garage",
                    "action": "upsert" if state == "OPEN" else "resolve",
                    "title": "GARAGE DOOR OPEN" if state == "OPEN" else "Garage door closed",
                    "body": "The garage monitor reports that the door is open" if state == "OPEN" else "The garage monitor reports that the door is closed",
                    "priority": "high",
                    "sticky": state == "OPEN",
                    "data": {"state": state, "confidence": confidence, "occurredAt": occurred_at},
                },
                timeout=15,
            )
            response.raise_for_status()
            with self.lock:
                self.last_successful_state = state
            self.logger.info("Published %s state to personal alert broker", state)
        except Exception as error:
            self.logger.error("Personal alert broker %s publish failed: %s", state, str(error) or error.__class__.__name__)
