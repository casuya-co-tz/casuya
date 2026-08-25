import subprocess, sys, os, time, urllib.request

os.chdir(r"C:\Users\Admin\Desktop\casuya-ecosytems\casuya-platform")

BACKEND_URL = "http://localhost:8765/health"
BACKEND_TIMEOUT = 15  # seconds to wait for backend

print("Starting backend...")
backend = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8765", "--reload"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
)
print(f"Backend PID: {backend.pid}")

print(f"Waiting for backend to be ready (timeout {BACKEND_TIMEOUT}s)...")
deadline = time.time() + BACKEND_TIMEOUT
ready = False
while time.time() < deadline:
    try:
        resp = urllib.request.urlopen(BACKEND_URL, timeout=2)
        if resp.status == 200:
            ready = True
            break
    except Exception:
        pass
    time.sleep(0.5)

if not ready:
    print(f"WARNING: Backend did not respond within {BACKEND_TIMEOUT}s. Starting frontend anyway.")

print("Starting frontend...")
frontend = subprocess.Popen(
    [sys.executable, "-m", "http.server", "5173"],
    cwd=r"C:\Users\Admin\Desktop\casuya-ecosytems\casuya-platform\frontend",
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
)
print(f"Frontend PID: {frontend.pid}")
print(f"\n Backend:  http://localhost:8765")
print(f" Frontend: http://localhost:5173")
