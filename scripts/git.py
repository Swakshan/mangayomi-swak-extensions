import os
from common import readJsonFile, readFile, writeFile, getParentPath, writeJsonFile

main_dir = getParentPath()
scripts_dir = main_dir / "scripts"

def getCommitMsg():
    prev = readJsonFile(scripts_dir/"prev_versions.json")
    new = readJsonFile(scripts_dir/"versions.json")
    
    added = []
    updated = []
    deleted = []
    
    for extType in new:
        new_data = new[extType]
        prev_data = prev[extType]
        for ext in new_data:
            if ext not in prev_data:
                added.append(ext)
                continue
            new_version = new_data[ext]['version']
            prev_version = prev_data[ext]['version']
            if new_version!=prev_version:
                updated.append(ext)
                
    for extType in prev:
        new_data = new[extType]
        prev_data = prev[extType]
        for ext in prev_data:
            if ext not in new_data:
                deleted.append(ext)
                

    commitMsg = ""
    if len(added):
        commitMsg+="➕: "+", ".join(added)+" "
    if len(updated):
        commitMsg+="♻️: "+", ".join(updated)+" "
    if len(deleted):
        commitMsg+="💀: "+", ".join(deleted)+" "
    
    if not len(commitMsg):
        commitMsg+="Updated"
    return f"🤖:: {commitMsg}"

def run(cmd):
    os.system(cmd)


commit_msg = getCommitMsg()

MAIL_ID = "github-actions[bot]@users.noreply.github.com"
NAME = "github-actions[bot]"
run(f'git config --global user.email "{MAIL_ID}"')
run(f'git config --global user.name "{NAME}"')
run("git checkout main")
run(f'git add .')
run(f'git commit -m "{commit_msg}"')
run(f'git push origin main --force')