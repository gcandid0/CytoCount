import subprocess

proc = subprocess.Popen(
    ['git', 'credential-manager', 'get'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)
out, err = proc.communicate(input="protocol=https\nhost=github.com\n\n", timeout=5)
lines = out.strip().splitlines()
token = None
user = None
for line in lines:
    if line.startswith("username="):
        user = line.split("=", 1)[1]
    elif line.startswith("password="):
        token = line.split("=", 1)[1]

print("Found user:", user)
print("Found token:", bool(token), f"(length: {len(token)})" if token else "")
