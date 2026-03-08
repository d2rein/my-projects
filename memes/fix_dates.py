import json
import os
from datetime import datetime

with open("memes.json","r",encoding="utf-8") as f:
    memes=json.load(f)

for m in memes:
    path=m["file"]

    if os.path.exists(path):
        m["created"]=datetime.fromtimestamp(os.path.getctime(path)).isoformat()
        m["modified"]=datetime.fromtimestamp(os.path.getmtime(path)).isoformat()

with open("memes.json","w",encoding="utf-8") as f:
    json.dump(memes,f,ensure_ascii=False,separators=(",",":"))

print("dates updated:",len(memes))