import urllib.request
import json

req = urllib.request.Request(
    'https://api.github.com/repos/gcandid0/CytoCount/releases',
    headers={'User-Agent': 'CytoCount-Check'}
)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"Total releases: {len(data)}")
        for r in data:
            print(f"Tag: {r['tag_name']} | Name: {r['name']} | ID: {r['id']} | HTML: {r['html_url']}")
            print("Assets:")
            for a in r.get('assets', []):
                print(f"  - {a['name']} ({a['size'] // 1024} KB)")
except Exception as e:
    print(f"Error: {e}")
