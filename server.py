import json, os, sqlite3, sys, urllib.request, urllib.error
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs, unquote

ROOT=Path(__file__).resolve().parent
CONFIG_PATH=ROOT/'config.json'
CONFIG=json.loads(CONFIG_PATH.read_text(encoding='utf-8-sig')) if CONFIG_PATH.exists() else {}
DATA=ROOT/'data'; DATA.mkdir(exist_ok=True)
DIST=ROOT/'dist'
DB=DATA/'soft-exam.db'
GPT_CONFIG=DATA/'gpt-config.json'
ALLOWED={
    'plans','scheduled-plans','timer','wrong','settings','answers','history','courses','progress','drafts',
    'focus-records','focus-module','study-days','week-plan','plan-date','week-key',
    'plan-history','week-history','study-stage','gpt-sets','course-modules',
    'material-folders','added-materials','hidden-materials','removed-material-folders',
    'ai-draft'
}
MATERIAL_ROOTS=[(ROOT/Path(p)).resolve() for p in CONFIG.get('material_roots',['materials'])]
MATERIAL_EXTS={'.pdf','.doc','.docx','.ppt','.pptx','.xls','.xlsx','.txt','.md','.epub'}
MATERIAL_SKIP={'node_modules','.git','dist','ocr工具','ocr-output','ocr_out','packages','models','legacy','__pycache__','_dashboard_staging','_npm_cache','_qa_addressing','_qa_checkcode','_qa_float','docx_render_check'}
MATERIAL_INCLUDE_KEYWORDS=('真题','专项练习','生成题','生成试题','题库','试题')

def load_gpt_config():
    saved={}
    try:
        if GPT_CONFIG.exists(): saved=json.loads(GPT_CONFIG.read_text(encoding='utf-8'))
    except (OSError,json.JSONDecodeError): pass
    return {
        'apiUrl':str(saved.get('apiUrl') or os.getenv('OPENAI_BASE_URL') or 'https://api.openai.com/v1').rstrip('/'),
        'model':str(saved.get('model') or os.getenv('OPENAI_MODEL') or 'gpt-5-mini').strip(),
        'apiKey':str(saved.get('apiKey') or os.getenv('OPENAI_API_KEY') or '').strip()
    }

def save_gpt_config(data):
    current=load_gpt_config()
    api_url=str(data.get('apiUrl') or current['apiUrl']).strip().rstrip('/')
    model=str(data.get('model') or current['model']).strip()
    api_key=str(data.get('apiKey') or current['apiKey']).strip()
    if not api_url.startswith(('https://','http://')): raise ValueError('API 地址必须以 http:// 或 https:// 开头')
    if not model: raise ValueError('模型名称不能为空')
    if not api_key: raise ValueError('请填写 API Key')
    temp=GPT_CONFIG.with_suffix('.tmp')
    temp.write_text(json.dumps({'apiUrl':api_url,'model':model,'apiKey':api_key},ensure_ascii=False,indent=2),encoding='utf-8')
    temp.replace(GPT_CONFIG)
    return {'apiUrl':api_url,'model':model,'configured':True}

def request_openai(config,payload,timeout=60):
    endpoint=config['apiUrl'] if config['apiUrl'].endswith('/responses') else config['apiUrl']+'/responses'
    req=urllib.request.Request(endpoint,json.dumps(payload).encode(),{'Authorization':f"Bearer {config['apiKey']}",'Content-Type':'application/json'},method='POST')
    with urllib.request.urlopen(req,timeout=timeout) as resp:return json.loads(resp.read())

def material_category(path):
    text=str(path)
    if '历年真题' in text or '真题' in text:return '历年真题'
    if '软件设计师' in text:return '软件设计师资料'
    name=path.name
    if '专项练习' in name:return '专项练习'
    if any(word in name for word in ('笔记','知识点','学习资料')):return '知识点笔记'
    parts=[part for part in path.parts if part not in MATERIAL_ROOTS and not part.startswith('_')]
    if len(parts)>1:return parts[0]
    return '学习资料'

def scan_materials():
    found=[]
    for root in MATERIAL_ROOTS:
        if not root.exists(): continue
        for path in root.rglob('*'):
            if not path.is_file() or path.suffix.lower() not in MATERIAL_EXTS: continue
            if any(part.lower() in MATERIAL_SKIP for part in path.parts): continue
            if any(part.lower() in {'源代码','source-code','source_code'} for part in path.parts): continue
            if path.name.lower().startswith('ocr_readme') or path.name.lower() in {'ocr-raw.txt','ocr_raw.txt'}: continue
            if not any(word in str(path) for word in MATERIAL_INCLUDE_KEYWORDS): continue
            try:
                st=path.stat(); found.append((str(path),path.name,path.suffix.lower(),st.st_size,st.st_mtime,material_category(path)))
            except OSError: continue
    with connect() as db:
        before=db.execute('SELECT COUNT(*) FROM materials').fetchone()[0]
        found_paths={row[0] for row in found}
        for old_path, in db.execute('SELECT path FROM materials').fetchall():
            if old_path not in found_paths: db.execute('DELETE FROM materials WHERE path=?',(old_path,))
        db.executemany('INSERT INTO materials(path,name,extension,size,modified,category,indexed_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(path) DO UPDATE SET name=excluded.name,extension=excluded.extension,size=excluded.size,modified=excluded.modified,category=excluded.category,indexed_at=CURRENT_TIMESTAMP',found)
        db.execute("DELETE FROM materials WHERE lower(name) LIKE 'ocr_readme%' OR lower(name) IN ('ocr-raw.txt','ocr_raw.txt') OR lower(path) LIKE '%\\ocr-output\\%' OR lower(path) LIKE '%/ocr-output/%'")
        for skip in MATERIAL_SKIP:
            db.execute('DELETE FROM materials WHERE lower(path) LIKE ?',('%\\'+skip.lower()+'\\%',))
        total=db.execute('SELECT COUNT(*) FROM materials').fetchone()[0]
    return {'scanned':len(found),'total':total,'added_or_updated':len(found)}

def connect():
    db=sqlite3.connect(DB); db.row_factory=sqlite3.Row
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    db.execute('CREATE TABLE IF NOT EXISTS questions (id INTEGER PRIMARY KEY AUTOINCREMENT,topic TEXT NOT NULL,stem TEXT NOT NULL,options TEXT NOT NULL,answer INTEGER NOT NULL,explanation TEXT NOT NULL DEFAULT "",source TEXT NOT NULL DEFAULT "",verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    existing={r[1] for r in db.execute('PRAGMA table_info(questions)')}
    for name,kind in [('year','INTEGER'),('season','TEXT'),('paper_type','TEXT'),('question_no','INTEGER')]:
        if name not in existing:db.execute(f'ALTER TABLE questions ADD COLUMN {name} {kind}')
    db.execute('CREATE TABLE IF NOT EXISTS materials (id INTEGER PRIMARY KEY AUTOINCREMENT,path TEXT NOT NULL UNIQUE,name TEXT NOT NULL,extension TEXT NOT NULL,size INTEGER NOT NULL,modified REAL NOT NULL,category TEXT NOT NULL DEFAULT "其他",text_preview TEXT NOT NULL DEFAULT "",indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    db.commit(); return db

with connect(): pass

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,fmt,*args):
        if sys.stdout:
            print('[软考学习台]',fmt%args)
    def end_headers(self):
        # This is a local, frequently rebuilt application. Prevent the browser
        # from keeping an old index or hashed bundle after an update.
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate')
        self.send_header('Pragma','no-cache')
        self.send_header('Expires','0')
        super().end_headers()
    def send_json(self,status,data):
        raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(status); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store'); self.send_header('Content-Length',len(raw)); self.end_headers(); self.wfile.write(raw)
    def body(self):
        size=int(self.headers.get('Content-Length','0'))
        if size>2_000_000: raise ValueError('请求内容过大')
        return json.loads(self.rfile.read(size) or b'{}')
    def do_GET(self):
        url=urlparse(self.path)
        if url.path=='/api/health': return self.send_json(200,{'ok':True,'database':'sqlite','gptConfigured':bool(load_gpt_config()['apiKey']),'time':datetime.now(timezone.utc).isoformat()})
        if url.path=='/api/gpt/config':
            config=load_gpt_config()
            return self.send_json(200,{'apiUrl':config['apiUrl'],'model':config['model'],'configured':bool(config['apiKey'])})
        if url.path=='/api/backup':
            with connect() as db:
                state={r['key']:json.loads(r['value']) for r in db.execute('SELECT key,value FROM app_state')}
                questions=[dict(r) for r in db.execute('SELECT * FROM questions ORDER BY id')]
            for q in questions: q['options']=json.loads(q['options']);q['verified']=bool(q['verified'])
            return self.send_json(200,{'version':1,'exportedAt':datetime.now(timezone.utc).isoformat(),'state':state,'questions':questions})
        if url.path=='/api/materials/stats':
            with connect() as db:
                total=db.execute('SELECT COUNT(*) FROM materials').fetchone()[0]
                size=db.execute('SELECT COALESCE(SUM(size),0) FROM materials').fetchone()[0]
                types=[dict(r) for r in db.execute('SELECT extension,COUNT(*) AS count FROM materials GROUP BY extension ORDER BY count DESC')]
                categories=[dict(r) for r in db.execute('SELECT category,COUNT(*) AS count FROM materials GROUP BY category ORDER BY count DESC')]
            return self.send_json(200,{'total':total,'bytes':size,'types':types,'categories':categories})
        if url.path=='/api/materials':
            limit=min(int(parse_qs(url.query).get('limit',['100'])[0]),500)
            with connect() as db:rows=[dict(r) for r in db.execute('SELECT * FROM materials ORDER BY modified DESC LIMIT ?',(limit,))]
            return self.send_json(200,rows)
        if url.path.startswith('/api/state/'):
            key=unquote(url.path[11:])
            if key not in ALLOWED:return self.send_json(404,{'error':'未知数据类型'})
            with connect() as db: row=db.execute('SELECT value FROM app_state WHERE key=?',(key,)).fetchone()
            return self.send_json(200,{'key':key,'value':json.loads(row['value']) if row else None})
        if url.path=='/api/questions':
            topic=parse_qs(url.query).get('topic',[None])[0]
            with connect() as db: rows=db.execute('SELECT * FROM questions'+(' WHERE topic=?' if topic else '')+' ORDER BY id',((topic,) if topic else ())).fetchall()
            out=[dict(r) for r in rows]
            for q in out:q['options']=json.loads(q['options']);q['verified']=bool(q['verified'])
            return self.send_json(200,out)
        if url.path.startswith('/api/'): return self.send_json(404,{'error':'接口不存在'})
        target=(DIST/(url.path.lstrip('/') or 'index.html')).resolve()
        if not target.is_relative_to(DIST.resolve()):return self.send_error(403)
        if not target.exists() or target.is_dir():target=DIST/'index.html'
        self.path='/'+str(target.relative_to(DIST)).replace('\\','/');return super().do_GET()
    def do_PUT(self):
        url=urlparse(self.path)
        if not url.path.startswith('/api/state/'):return self.send_json(404,{'error':'接口不存在'})
        key=unquote(url.path[11:])
        if key not in ALLOWED:return self.send_json(404,{'error':'未知数据类型'})
        data=self.body()
        with connect() as db:db.execute('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP',(key,json.dumps(data.get('value'),ensure_ascii=False)))
        return self.send_json(200,{'ok':True,'key':key})
    def do_DELETE(self):
        url=urlparse(self.path)
        if not url.path.startswith('/api/questions/'):
            return self.send_json(404,{'error':'接口不存在'})
        try:
            question_id=int(url.path.rsplit('/',1)[-1])
        except ValueError:
            return self.send_json(400,{'error':'题目 ID 无效'})
        with connect() as db:
            row=db.execute('SELECT id,question_no,stem FROM questions WHERE id=?',(question_id,)).fetchone()
            if not row:return self.send_json(404,{'error':'题目不存在或已被删除'})
            db.execute('DELETE FROM questions WHERE id=?',(question_id,))
        return self.send_json(200,{'ok':True,'id':question_id})
    def do_POST(self):
        url=urlparse(self.path); data=self.body()
        if url.path=='/api/gpt/config':
            try:return self.send_json(200,save_gpt_config(data))
            except (OSError,ValueError) as e:return self.send_json(400,{'error':str(e)})
        if url.path=='/api/gpt/test':
            config=load_gpt_config()
            if not config['apiKey']:return self.send_json(503,{'error':'尚未配置 API Key'})
            payload={'model':config['model'],'store':False,'max_output_tokens':30,'input':'只回复“连接成功”。'}
            try:
                result=request_openai(config,payload,30)
                return self.send_json(200,{'ok':True,'model':result.get('model') or config['model']})
            except urllib.error.HTTPError as e:return self.send_json(e.code,{'error':json.loads(e.read()).get('error',{}).get('message','OpenAI 请求失败')})
            except (urllib.error.URLError,TimeoutError) as e:return self.send_json(502,{'error':f'连接 OpenAI 失败：{e}'})
        if url.path=='/api/video-title':
            target=data.get('url','')
            if not target.startswith('https://www.bilibili.com/video/'): return self.send_json(400,{'error':'请输入 B 站视频链接'})
            try:
                req=urllib.request.Request(target,headers={'User-Agent':'Mozilla/5.0'})
                with urllib.request.urlopen(req,timeout=12) as resp: html=resp.read(800000).decode('utf-8','ignore')
                import re
                match=re.search(r'<title[^>]*>(.*?)</title>',html,re.S|re.I)
                title=re.sub(r'\s+',' ',re.sub('<.*?>','',match.group(1))).strip() if match else ''
                title=title.replace('_哔哩哔哩_bilibili','').strip(' -_')
                if not title:return self.send_json(502,{'error':'未能提取标题，请手动填写'})
                return self.send_json(200,{'title':title})
            except Exception:return self.send_json(502,{'error':'未能提取标题，请手动填写'})
        if url.path=='/api/materials/scan':
            try:return self.send_json(200,scan_materials())
            except Exception as e:return self.send_json(500,{'error':f'扫描失败：{e}'})
        if url.path=='/api/materials/open':
            raw_path=str(data.get('path','')).strip()
            if not raw_path:return self.send_json(400,{'error':'缺少文件路径'})
            try:
                target=Path(raw_path).resolve()
                allowed=any(target==root.resolve() or root.resolve() in target.parents for root in MATERIAL_ROOTS)
                if not allowed:return self.send_json(403,{'error':'只能打开学习资料目录中的文件'})
                if not target.is_file():return self.send_json(404,{'error':'文件不存在'})
                if hasattr(os,'startfile'):os.startfile(str(target))
                else:return self.send_json(501,{'error':'当前系统不支持调用默认程序'})
                return self.send_json(200,{'ok':True})
            except OSError as e:return self.send_json(500,{'error':f'打开文件失败：{e}'})
        if url.path=='/api/questions':
            options=data.get('options')
            if (not str(data.get('topic','')).strip() or not str(data.get('stem','')).strip()
                or not isinstance(options,list) or len(options)!=4 or any(not str(x).strip() for x in options)
                or not isinstance(data.get('answer'),int) or data['answer'] not in range(4)
                or not isinstance(data.get('year'),int) or not 2000<=data['year']<=2100
                or data.get('season') not in ('上半年','下半年')
                or data.get('paper_type') not in ('上午题','下午题','专项练习')
                or not isinstance(data.get('question_no'),int) or data['question_no']<1):
                return self.send_json(400,{'error':'题目字段不完整或格式无效'})
            with connect() as db:cur=db.execute('INSERT INTO questions(topic,stem,options,answer,explanation,source,verified,year,season,paper_type,question_no) VALUES(?,?,?,?,?,?,?,?,?,?,?)',(data['topic'].strip(),data['stem'].strip(),json.dumps([str(x).strip() for x in options],ensure_ascii=False),data['answer'],data.get('explanation',''),data.get('source','用户手动添加'),1 if data.get('verified') else 0,data['year'],data['season'],data['paper_type'],data['question_no']))
            return self.send_json(201,{'ok':True,'id':cur.lastrowid})
        if url.path=='/api/gpt/explain':
            config=load_gpt_config()
            if not config['apiKey']:return self.send_json(503,{'error':'尚未在设置页配置 API Key'})
            payload={'model':config['model'],'store':False,'instructions':'你是软件设计师中级考试辅导老师。用简洁中文说明考点、答案依据和易错点。','input':f"题目：{data.get('question','')}\n学生答案：{data.get('userAnswer','未提供')}\n正确答案：{data.get('correctAnswer','未提供')}"}
            try:
                result=request_openai(config,payload)
                text=result.get('output_text','')
                if not text:
                    text=next((c.get('text','') for o in result.get('output',[]) for c in o.get('content',[]) if c.get('type')=='output_text'),'')
                return self.send_json(200,{'text':text,'responseId':result.get('id')})
            except urllib.error.HTTPError as e:return self.send_json(e.code,{'error':json.loads(e.read()).get('error',{}).get('message','OpenAI 请求失败')})
            except (urllib.error.URLError,TimeoutError) as e:return self.send_json(502,{'error':f'连接 OpenAI 失败：{e}'})
        return self.send_json(404,{'error':'接口不存在'})

    def translate_path(self,path):return str(DIST/path.lstrip('/'))

if __name__=='__main__':
    host=str(os.getenv('HOST',CONFIG.get('host','127.0.0.1'))).strip()
    port=int(os.getenv('PORT',str(CONFIG.get('port',4183))))
    if not (DIST/'index.html').is_file():
        raise SystemExit('Please run npm install and npm run build before starting.')
    print(f'Study desk: http://{host}:{port}',flush=True)
    ThreadingHTTPServer((host,port),Handler).serve_forever()
