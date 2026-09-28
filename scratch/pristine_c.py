"""Take the pristine Repo C copy and record its identity. Nothing semantic is inspected."""
import hashlib, importlib, io, json, os, shutil, contextlib

DEST = 'benchmarks/repoC/pristine'
NAME = 'pyparsing'
sink = io.StringIO()
with contextlib.redirect_stdout(sink), contextlib.redirect_stderr(sink):
    mod = importlib.import_module(NAME)
root = list(mod.__path__)[0]
version = getattr(mod, '__version__', None)

os.makedirs(os.path.join(DEST, NAME), exist_ok=True)
files = []
for dirpath, _d, names in os.walk(root):
    for f in sorted(names):
        if not f.endswith('.py'):
            continue
        src = os.path.join(dirpath, f)
        rel = os.path.relpath(src, root)
        dst = os.path.join(DEST, NAME, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        # BYTE-FOR-BYTE. Line endings are an OBSERVED FACT, never normalised - normalising would be
        # modifying the artifact before the experiment, a lesson already paid for on the stdlib corpus.
        with open(src, 'rb') as a:
            data = a.read()
        with open(dst, 'wb') as b:
            b.write(data)
        files.append({'path': (NAME + '/' + rel).replace('\\', '/'),
                      'sha256': hashlib.sha256(data).hexdigest(),
                      'bytes': len(data),
                      'crlf': b'\r\n' in data})

manifest_digest = hashlib.sha256(
    '\n'.join(f['path'] + ':' + f['sha256'] for f in sorted(files, key=lambda x: x['path']))
    .encode()).hexdigest()

record = {'repo': 'C', 'distribution': NAME, 'version': version,
          'source_root': root.replace('\\', '/'), 'pristine': DEST + '/' + NAME,
          'files': len(files), 'manifest_sha256': manifest_digest,
          'crlf_files': sum(1 for f in files if f['crlf']), 'file_list': files}
with open('benchmarks/repoC/IDENTITY.json', 'w', encoding='utf-8') as fh:
    json.dump(record, fh, indent=1)
print(NAME + ' ' + str(version))
print('files      : ' + str(len(files)))
print('manifest   : ' + manifest_digest)
print('crlf files : ' + str(record['crlf_files']) + ' of ' + str(len(files)))
