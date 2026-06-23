"""
EVAC — Structured Logging Configuration
"""

import logging
import sys


def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configure application-wide structured logging."""
    logger = logging.getLogger("evac")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
