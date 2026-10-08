import argparse, io, json, sqlite3, threading, webbrowser
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from importer import parse_excel
ROOT=Path(__file__).resolve().parent
DB=ROOT/'data'/'registry.sqlite3'
LOCK=threading.Lock()

def connect():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def initialize():
    DB.parent.mkdir(exist_ok=True)
    with connect() as c:
        c.execute('CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY AUTOINCREMENT, body TEXT NOT NULL)')
        c.execute('CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, body TEXT NOT NULL)')
        if not c.execute("SELECT 1 FROM metadata WHERE key='initialized'").fetchone():
            seed=json.loads((ROOT/'data'/'initial.json').read_text(encoding='utf-8'))
            for r in seed['records']: c.execute('INSERT INTO records(body) VALUES (?)',(json.dumps(r,ensure_ascii=False),))
            c.execute('INSERT INTO metadata VALUES (?,?)',('categories',json.dumps(seed['categories'],ensure_ascii=False)))
            c.execute('INSERT INTO metadata VALUES (?,?)',('initialized','true'))

def validate(r):
    if not isinstance(r,dict) or not str(r.get('name','')).strip(): raise ValueError('กรุณาระบุชื่อผู้ประกอบการ')
    if not isinstance(r.get('history',[]),list): raise ValueError('ประวัติใบอนุญาตไม่ถูกต้อง')
    r=dict(r);r.pop('id',None);return r

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**k): super().__init__(*a,directory=str(ROOT/'dist'),**k)
    def log_message(self,*args): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()
    def reply(self,data,status=200):
        b=json.dumps(data,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def body(self):
        n=int(self.headers.get('Content-Length',0))
        if n>15*1024*1024: raise ValueError('ไฟล์ใหญ่เกิน 15 MB')
        return self.rfile.read(n)
    def do_GET(self):
        if self.path=='/api/records':
            with connect() as c:
                records=[dict(json.loads(r['body']),id=r['id']) for r in c.execute('SELECT * FROM records ORDER BY id DESC')]
                cats=c.execute("SELECT body FROM metadata WHERE key='categories'").fetchone()
            return self.reply({'records':records,'categories':json.loads(cats['body'])})
        if self.path.startswith('/api/'): return self.reply({'error':'ไม่พบรายการ'},404)
        return super().do_GET()
    def do_POST(self): self.mutate('POST')
    def do_PUT(self): self.mutate('PUT')
    def do_DELETE(self): self.mutate('DELETE')
    def mutate(self,method):
        try:
            # Same-origin browser requests only; no cross-origin CORS enabled.
            origin=self.headers.get('Origin')
            if origin and origin!='http://'+self.headers.get('Host',''): return self.reply({'error':'Origin ไม่ถูกต้อง'},403)
            if self.path=='/api/import' and method=='POST':
                parsed=parse_excel(io.BytesIO(self.body()))
                if not parsed['records']: raise ValueError('ไม่พบข้อมูลทะเบียนใน Excel')
                with LOCK,connect() as c:
                    old=json.loads(c.execute("SELECT body FROM metadata WHERE key='categories'").fetchone()[0]); names={x['name'] for x in old}
                    old.extend(x for x in parsed['categories'] if x['name'] not in names)
                    c.execute("UPDATE metadata SET body=? WHERE key='categories'",(json.dumps(old,ensure_ascii=False),))
                    for r in parsed['records']:c.execute('INSERT INTO records(body) VALUES (?)',(json.dumps(r,ensure_ascii=False),))
                return self.reply({'count':len(parsed['records'])})
            if self.path=='/api/restore' and method=='POST':
                payload=json.loads(self.body()); rows=[validate(r) for r in payload['records']]; cats=payload['categories']
                if not isinstance(cats,list) or any(not isinstance(x,dict) or 'name' not in x for x in cats): raise ValueError('หมวดไม่ถูกต้อง')
                with LOCK,connect() as c:
                    c.execute('DELETE FROM records')
                    for r in rows:c.execute('INSERT INTO records(body) VALUES (?)',(json.dumps(r,ensure_ascii=False),))
                    c.execute("UPDATE metadata SET body=? WHERE key='categories'",(json.dumps(cats,ensure_ascii=False),))
                return self.reply({'count':len(rows)})
            with LOCK,connect() as c:
                if self.path=='/api/records' and method=='POST':
                    r=validate(json.loads(self.body()));cur=c.execute('INSERT INTO records(body) VALUES (?)',(json.dumps(r,ensure_ascii=False),));return self.reply({'id':cur.lastrowid},201)
                if self.path.startswith('/api/records/'):
                    rid=int(self.path.rsplit('/',1)[1])
                    if method=='PUT':
                        r=validate(json.loads(self.body()));cur=c.execute('UPDATE records SET body=? WHERE id=?',(json.dumps(r,ensure_ascii=False),rid))
                    elif method=='DELETE':cur=c.execute('DELETE FROM records WHERE id=?',(rid,))
                    else:return self.reply({'error':'ไม่รองรับ'},405)
                    return self.reply({'ok':True} if cur.rowcount else {'error':'ไม่พบรายการ'},200 if cur.rowcount else 404)
            self.reply({'error':'ไม่พบเส้นทาง'},404)
        except (ValueError,KeyError,TypeError) as e:self.reply({'error':str(e)},400)
        except Exception:self.reply({'error':'ดำเนินการไม่สำเร็จ โปรดตรวจรูปแบบไฟล์'},400)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8000);p.add_argument('--no-browser',action='store_true');args=p.parse_args()
    initialize(); url=f'http://127.0.0.1:{args.port}'; print('ทะเบียนคุม: '+url)
    if not args.no_browser:webbrowser.open(url)
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
