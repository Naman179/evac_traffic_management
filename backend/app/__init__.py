# EVAC Congestion System — FastAPI Backend

# Monkeypatch platform calls to prevent Windows subprocess/WMI hangs
import platform

platform.system = lambda: "Windows"
platform.machine = lambda: "AMD64"
platform.processor = lambda: "Intel64 Family 6 Model 158 Stepping 10, GenuineIntel"
platform.version = lambda: "10.0.19045"
platform.release = lambda: "10"
platform.platform = lambda *args, **kwargs: "Windows-10-10.0.19045-SP0"
platform.uname = lambda: platform.uname_result(
    "Windows", "localhost", "10", "10.0.19045", "AMD64", "Intel64 Family 6 Model 158 Stepping 10, GenuineIntel"
)
