"""Integration checks on a temporary database; does not alter user records."""
import json,tempfile,threading,urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
import server

def request(base,path,method='GET',body=None):
    payload=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(base+path,data=payload,method=method,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req) as res:return json.load(res)

with tempfile.TemporaryDirectory() as tmp:
    server.DB=Path(tmp)/'test.sqlite3';server.initialize()
    http=ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
    thread=threading.Thread(target=http.serve_forever,daemon=True);thread.start()
    base=f'http://127.0.0.1:{http.server_port}'
    try:
        original=request(base,'/api/records');assert len(original['records'])==388
        row={'name':'ผู้ทดสอบ','category':'ทดสอบ','history':[{'year':'2569','number':'001/69','renewed':'01/10/2569','expires':'30/09/2570'}]}
        rid=request(base,'/api/records','POST',row)['id']
        row['name']='แก้ไขแล้ว';request(base,f'/api/records/{rid}','PUT',row)
        assert any(r['name']=='แก้ไขแล้ว' for r in request(base,'/api/records')['records'])
        request(base,f'/api/records/{rid}','DELETE');assert len(request(base,'/api/records')['records'])==388
        request(base,'/api/restore','POST',{'records':[],'categories':[]});assert not request(base,'/api/records')['records']
        server.initialize();assert not request(base,'/api/records')['records'], 'Empty databases must not reseed'
        request(base,'/api/restore','POST',original);assert len(request(base,'/api/records')['records'])==388
        with urllib.request.urlopen(base+'/') as res:assert 'ทะเบียนคุม' in res.read().decode()
        print('PASS: seed, create, update, delete, backup restore, empty persistence, HTML')
    finally:http.shutdown();http.server_close()
