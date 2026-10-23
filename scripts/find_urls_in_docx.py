import zipfile
import re

with zipfile.ZipFile('竞赛汇报与文档材料包/upload/final.docx') as z:
    for name in z.namelist():
        data = z.read(name).decode('utf-8', errors='ignore')
        # find all http/https links
        links = re.findall(r'https?://[^\s\"<>]+', data)
        valid_links = [l for l in links if 'openxmlformats' not in l and 'microsoft.com' not in l and 'w3.org' not in l]
        if valid_links:
            print(f'Links in {name}: {set(valid_links)}')
