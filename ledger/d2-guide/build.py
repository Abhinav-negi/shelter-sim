import json, re, datetime
d1 = open('d1-diagrams.html').read()
def sec(i): return re.search(r'<section id="%s">(.*?)</section>' % i, d1, re.S).group(1)
def fig(i): return re.search(r'<figure>.*?</figure>', sec(i), re.S).group(0)
C = json.load(open('client.json')); S = json.load(open('server.json')); P = json.load(open('packages.json'))
# corrections verified by grep (session 6)
P['summary'] = P['summary'].replace(" (apps/studio + apps/studio-server, outside this survey's scope)", " (apps/studio + apps/studio-server)")
for p in P['packages']:
    if p['name'] == '@shelter/engine': p['usedBy'] = ['apps/studio-server (runs it)', 'apps/studio (types only)', 'apps/server', 'apps/client (types only)', 'apps/web', '@shelter/data', '@shelter/optimise']
    if p['name'] == '@shelter/data': p['usedBy'] = ['apps/studio-server', 'apps/server', 'apps/web', 'scripts/ci-energy-balance.mjs']
    if p['name'] == '@shelter/optimise': p['usedBy'] = ['nothing yet (a ready design-space sweep, not wired into any app)']
t = open('template.html').read()
t = t.replace('<!--DIAGRAM:system-->', fig('system'))
t = t.replace('<!--DIAGRAM:client-->', fig('client'))
t = t.replace('<!--DIAGRAM:sequences-->', fig('sequences'))
t = t.replace('<!--DIAGRAM:weather-->', fig('weather'))
t = t.replace('<!--DIAGRAM:shapes-->', fig('shapes') + re.search(r'<ol class="steps">.*?</ol>', sec('shapes'), re.S).group(0))
t = t.replace('<!--AUTH-->', '<h3>How login works</h3>' + re.search(r'<ol class="steps">.*?</ol>', sec('auth'), re.S).group(0))
t = t.replace('<!--SECTION:change-->', '<section id="change">' + sec('change') + '</section>')
t = t.replace('<!--SECTION:run-->', '<section id="run">' + sec('run') + '</section>')
t = t.replace('__DATE__', datetime.date.today().isoformat())
data = json.dumps({'client': C, 'server': S, 'packages': P}, ensure_ascii=False).replace('</', '<\\/')
t = t.replace('/*DATA*/', data)
open('guide.html', 'w').write(t)
print(len(t)//1024, 'KB', t.count('<figure>'), 'figures')
