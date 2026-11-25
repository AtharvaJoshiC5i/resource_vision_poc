"""Sliding-window rate limiter. Clock and sleep are injectable so tests run instantly."""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Callable


class SlidingWindowLimiter:
    """Allows at most ``max_calls`` acquisitions in any ``period`` seconds, blocking otherwise."""

    def __init__(
        self,
        max_calls: int,
        period: float = 60.0,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ):
        if max_calls < 1:
            raise ValueError("max_calls must be at least 1")
        self._max = max_calls
        self._period = period
        self._clock = clock
        self._sleep = sleep
        self._calls: deque[float] = deque()
        self._lock = threading.Lock()

    def acquire(self) -> None:
        with self._lock:
            while True:
                now = self._clock()
                while self._calls and now - self._calls[0] >= self._period:
                    self._calls.popleft()
                if len(self._calls) < self._max:
                    self._calls.append(now)
                    return
                self._sleep(max(self._period - (now - self._calls[0]), 0.001))
