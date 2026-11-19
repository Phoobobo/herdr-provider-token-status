#!/usr/bin/env python3
"""Read the signed-in Codex account's rate-limit snapshot via its local app server."""
import json
import subprocess
import sys

process = subprocess.Popen(
    ["codex", "app-server", "--listen", "stdio://"],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    text=True, bufsize=1,
)

def request(request_id, method, params=None):
    payload = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        payload["params"] = params
    process.stdin.write(json.dumps(payload) + "\n")
    process.stdin.flush()
    while True:
        line = process.stdout.readline()
        if not line:
            raise RuntimeError("Codex app server closed without a response")
        message = json.loads(line)
        if message.get("id") == request_id:
            if "error" in message:
                raise RuntimeError(message["error"].get("message", "Codex request failed"))
            return message.get("result")

try:
    request(1, "initialize", {"clientInfo": {"name": "herdr-provider-token-status", "version": "1"}, "capabilities": {}})
    print(json.dumps(request(2, "account/rateLimits/read")))
except Exception as error:
    print(json.dumps({"error": str(error)}))
    sys.exit(1)
finally:
    process.terminate()
    try:
        process.wait(timeout=1)
    except subprocess.TimeoutExpired:
        process.kill()
