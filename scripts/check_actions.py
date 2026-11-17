import urllib.request
import json

req = urllib.request.Request(
    'https://api.github.com/repos/gcandid0/CytoCount/actions/runs',
    headers={'User-Agent': 'CytoCount-Check'}
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"Total runs: {data.get('total_count')}")
        for r in data.get('workflow_runs', [])[:5]:
            print(f"ID: {r['id']} | Name: {r['name']} | Event: {r['event']} | Status: {r['status']} | Conclusion: {r['conclusion']}")
except Exception as e:
    print(f"Error: {e}")
