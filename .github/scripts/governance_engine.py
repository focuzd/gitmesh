import os
import yaml
import requests
import shutil
import subprocess
import re
from datetime import datetime, timedelta, timezone

# --- CONFIGURATION ---
# IST Offset (UTC+5:30)
IST = timezone(timedelta(hours=5, minutes=30))

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
REPO = os.getenv("GITHUB_REPOSITORY")  # Format: "owner/repo"
CANONICAL_REPO = "LF-Decentralized-Trust-labs/gitmesh" # Fork protection target

REGISTRY_PATH = "governance/contributors.yaml"
BOTS_PATH = "governance/bots.yaml"
HISTORY_DIR = "governance/history/users/"
HISTORY_BOTS_DIR = "governance/history/bots/"
LEDGER_PATH = "governance/history/ledger.yaml"
BOT_LEDGER_PATH = "governance/history/bot_logs.yaml"
CODEOWNERS_PATH = ".github/CODEOWNERS"

# Hierarchy: Lower index = Lower role
ROLE_HIERARCHY = [
    "Newbie Contributor",
    "Active Contributor",
    "Core Contributor",
    "Principal Contributor",
    "Maintainer"
]

PROTECTED_ROLES = ["CEO", "CTO"]

headers = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def get_authorized_users():
    """Parses .github/CODEOWNERS to find authorized governance approvers."""
    if not os.path.exists(CODEOWNERS_PATH):
        print(f"Warning: {CODEOWNERS_PATH} not found.")
        return []
    
    authorized = set()
    try:
        with open(CODEOWNERS_PATH, 'r') as f:
            for line in f:
                # Look for line starting with governance/contributors.yaml
                if line.strip().startswith("governance/contributors.yaml"):
                    # Extract @mentions
                    parts = line.split()
                    for part in parts:
                        if part.startswith('@'):
                            authorized.add(part.lstrip('@').lower())
    except Exception as e:
        print(f"Error parsing CODEOWNERS: {e}")
    
    return list(authorized)

def validate_role_change(action, current_role, target_role):
    """
    Validates if a role change is a valid promotion or demotion.
    Returns (is_valid, error_message)
    """
    if target_role not in ROLE_HIERARCHY:
        return False, f"Role '{target_role}' is not a valid governance role."
    
    if current_role in PROTECTED_ROLES:
        return False, f"Role '{current_role}' is a protected role and cannot be updated by bot."
    
    # Handle roles outside standard hierarchy (e.g. CEO, CTO)
    if current_role not in ROLE_HIERARCHY:
        # For now, allow promotion FROM non-hierarchy roles if it's the first assignment
        # or if it's a manual override. But logically, we can't 'promote' relative to them.
        current_idx = -1 
    else:
        current_idx = ROLE_HIERARCHY.index(current_role)
    
    target_idx = ROLE_HIERARCHY.index(target_role)

    if action == "promote":
        if target_idx <= current_idx:
            return False, f"Cannot promote to '{target_role}' from '{current_role}' (target is not higher)."
    elif action == "demote":
        if target_idx >= current_idx and current_idx != -1:
            return False, f"Cannot demote to '{target_role}' from '{current_role}' (target is not lower)."
    
    return True, None

def get_now_ist_str():
    """Returns current IST time in ISO format."""
    return datetime.now(IST).strftime("%Y-%m-%dT%H:%M:%S+05:30")

def get_merged_prs(since_date=None, per_page=100):
    """Fetches merged PRs. If since_date is provided, fetches only PRs merged after that date."""
    all_prs = []
    page = 1
    
    since_dt = None
    if since_date:
        try:
            since_dt = datetime.fromisoformat(since_date)
        except ValueError:
            print(f"Warning: Could not parse since_date '{since_date}'. Fetching all.")
            since_dt = None

    print(f"Fetching merged PRs{' since ' + since_date if since_date else ' (ALL)'}...")

    while True:
        # Fetch closed PRs, sorted by updated desc to get recent ones first
        url = f"https://api.github.com/repos/{REPO}/pulls?state=closed&sort=updated&direction=desc&per_page={per_page}&page={page}"
        try:
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            pulls = response.json()
            
            if not pulls:
                break
                
            relevant_prs_in_batch = 0
            
            for pr in pulls:
                if not pr.get('merged_at'):
                    continue
                
                merged_at_str = pr['merged_at']
                merged_at_dt = datetime.fromisoformat(merged_at_str.replace('Z', '+00:00'))
                
                # Filter by date
                if since_dt and merged_at_dt <= since_dt:
                    continue
                
                all_prs.append({
                    'username': pr['user']['login'],
                    'merged_at': pr['merged_at'],
                    'url': pr['html_url'],
                    'title': pr['title'],
                    'number': pr['number']
                })
                relevant_prs_in_batch += 1
            
            print(f"Fetched page {page}: Found {relevant_prs_in_batch} new merged PRs")
            
            if not pulls:
                break
                
            page += 1
            # Limit pages for safety if needed, but for clean start we want all.
            if page > 50 and since_dt: # If incremental, 50 pages (5000 PRs) is plenty to look back
                 print("Reached page limit for incremental sync.")
                 break
            
        except Exception as e:
            print(f"Error fetching PRs page {page}: {e}")
            break
            
    return all_prs

def get_last_activity_date(username):
    """Queries GitHub Events API to find the user's latest public action in this repo."""
    url = f"https://api.github.com/users/{username}/events/public"
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            events = response.json()
            if events and isinstance(events, list):
                for event in events:
                    if event.get('repo', {}).get('name') == REPO:
                        if event['type'] == 'PushEvent':
                             return event['created_at'].split('T')[0]
                        elif event['type'] == 'PullRequestEvent':
                            if event.get('payload', {}).get('action') == 'closed' and \
                               event.get('payload', {}).get('pull_request', {}).get('merged') == True:
                                return event['created_at'].split('T')[0]
    except Exception as e:
        print(f"Error fetching activity for {username}: {e}")
    return None

def update_user_history(username, event_type, details, is_bot=False):
    """Maintains an append-only audit log for each contributor."""
    base_dir = HISTORY_BOTS_DIR if is_bot else HISTORY_DIR
    os.makedirs(base_dir, exist_ok=True)
    
    # Use lowercase filename to avoid case-sensitivity issues on some filesystems
    path = os.path.join(base_dir, f"{username.lower()}.yaml")
    
    data = {"username": username, "events": []}
    if os.path.exists(path):
        with open(path, 'r') as f:
            existing_data = yaml.safe_load(f)
            if existing_data:
                data = existing_data

    # Construct new event
    new_event = {
        "timestamp": get_now_ist_str(),
        "type": event_type,
        "details": details
    }
    
    data['events'].append(new_event)

    with open(path, 'w') as f:
        yaml.dump(data, f, sort_keys=False, default_flow_style=False)

def update_ledger(event_type, username, details, is_bot=False):
    """Maintains a global ledger of all governance events."""
    ledger_file = BOT_LEDGER_PATH if is_bot else LEDGER_PATH
    os.makedirs(os.path.dirname(ledger_file), exist_ok=True)
    
    data = {"events": []}
    if os.path.exists(ledger_file) and os.path.getsize(ledger_file) > 0:
        with open(ledger_file, 'r') as f:
            existing_data = yaml.safe_load(f)
            if existing_data and 'events' in existing_data:
                data = existing_data
    
    data['events'].append({
        "timestamp": get_now_ist_str(),
        "type": event_type,
        "username": username,
        "details": details
    })
    
    with open(ledger_file, 'w') as f:
        yaml.dump(data, f, sort_keys=False, default_flow_style=False)

def post_comment(issue_number, body):
    """Posts a comment to the PR/Issue."""
    url = f"https://api.github.com/repos/{REPO}/issues/{issue_number}/comments"
    try:
        requests.post(url, json={"body": body}, headers=headers).raise_for_status()
    except Exception as e:
        print(f"Failed to post comment: {e}")

def git_commit_push_pr(pr_number, branch_name):
    """Commits changes to the current PR branch."""
    try:
        # Configure Git
        subprocess.run(["git", "config", "--local", "user.name", "github-actions[bot]"], check=True)
        subprocess.run(["git", "config", "--local", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], check=True)
        
        # Add files
        subprocess.run(["git", "add", "governance/"], check=True)
        
        # Check for changes
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True)
        if not status.stdout.strip():
            print("No changes to commit.")
            return

        # Commit
        msg = f"chore(gov): update roles via command in PR #{pr_number} [skip ci]"
        subprocess.run(["git", "commit", "-s", "-m", msg], check=True)
        
        subprocess.run(["git", "pull", "origin", branch_name, "--rebase"], check=True)

        # Push
        subprocess.run(["git", "push", "origin", f"HEAD:{branch_name}"], check=True)
        
    except Exception as e:
        print(f"Git Error: {e}")
        raise e

def load_bots():
    if not os.path.exists(BOTS_PATH):
        return []
    with open(BOTS_PATH, 'r') as f:
        data = yaml.safe_load(f)
        return data.get('bots', []) if data else []

def save_bots(bots_list):
    os.makedirs(os.path.dirname(BOTS_PATH), exist_ok=True)
    data = {'bots': bots_list}
    with open(BOTS_PATH, 'w') as f:
        yaml.dump(data, f, sort_keys=False, default_flow_style=False)

def move_ledger_entries(username, source_path, dest_path):
    """Moves ledger entries for a user from source to destination."""
    if not os.path.exists(source_path):
        return

    # Load Source
    try:
        with open(source_path, 'r') as f:
            src_data = yaml.safe_load(f) or {}
    except Exception as e:
        print(f"Error loading source ledger {source_path}: {e}")
        return
    
    src_events = src_data.get('events', [])
    if not src_events:
        return

    # Load Dest
    dest_data = {'events': []}
    if os.path.exists(dest_path):
        try:
            with open(dest_path, 'r') as f:
                loaded = yaml.safe_load(f)
                if loaded:
                    dest_data = loaded
        except Exception as e:
             print(f"Error loading dest ledger {dest_path}: {e}")
    
    if 'events' not in dest_data:
        dest_data['events'] = []

    # Filter and Move
    events_to_keep = []
    events_to_move = []
    
    username_lower = username.lower()
    
    for event in src_events:
        if event.get('username', '').lower() == username_lower:
            events_to_move.append(event)
        else:
            events_to_keep.append(event)
            
    if not events_to_move:
        return # Nothing to move

    # Update Data
    src_data['events'] = events_to_keep
    
    # Merge and Sort Destination Events
    combined_events = dest_data['events'] + events_to_move
    combined_events.sort(key=lambda x: x.get('timestamp', ''))
    dest_data['events'] = combined_events
    
    # Write files
    try:
        with open(source_path, 'w') as f:
            yaml.dump(src_data, f, sort_keys=False, default_flow_style=False)

        with open(dest_path, 'w') as f:
            yaml.dump(dest_data, f, sort_keys=False, default_flow_style=False)
        print(f"Moved {len(events_to_move)} events from {source_path} to {dest_path}")
    except Exception as e:
        print(f"Error writing ledgers: {e}")

def handle_bot_command(action, target_user, author, pr_number, branch_name):
    print(f"Executing Bot Command: {action} {target_user} by {author}")
    
    # Load registries
    with open(REGISTRY_PATH, 'r') as f:
        registry = yaml.safe_load(f)
    contributors = registry.get('contributors', [])
    
    bots = load_bots()
    target_user_lower = target_user.lower()
    
    if action == "add":
        # Check if already a bot
        if any(b['username'].lower() == target_user_lower for b in bots):
            post_comment(pr_number, f"⚠️ @{target_user} is already in the bot registry.")
            return

        # Check if in contributors (migrate)
        user_entry = next((c for c in contributors if c['username'].lower() == target_user_lower), None)
        if user_entry:
            contributors.remove(user_entry)
            # Update registry file immediately to reflect removal
            with open(REGISTRY_PATH, 'w') as f:
                yaml.dump(registry, f, sort_keys=False, default_flow_style=False)
                
            # Move history
            src = os.path.join(HISTORY_DIR, f"{target_user_lower}.yaml")
            dst = os.path.join(HISTORY_BOTS_DIR, f"{target_user_lower}.yaml")
            if os.path.exists(src):
                os.makedirs(HISTORY_BOTS_DIR, exist_ok=True)
                shutil.move(src, dst)
        
        # Add to bots
        new_bot = {
            "username": target_user,
            "added_at": get_now_ist_str(),
            "added_by": author
        }
        bots.append(new_bot)
        save_bots(bots)
        
        # Migrate Ledger History
        move_ledger_entries(target_user, LEDGER_PATH, BOT_LEDGER_PATH)
        
        # Log this administrative action to the MAIN ledger (humans managing system)
        log_msg = f"Added @{target_user} to bots (migrated from contributors if existed) by @{author}"
        update_ledger("BOT_ADD", target_user, log_msg, is_bot=False) 
        post_comment(pr_number, f"✅ Successfully added @{target_user} to bots registry.")

    elif action == "remove":
        # Check if is a bot
        bot_entry = next((b for b in bots if b['username'].lower() == target_user_lower), None)
        if not bot_entry:
            post_comment(pr_number, f"⚠️ @{target_user} is not in the bot registry.")
            return
            
        bots.remove(bot_entry)
        save_bots(bots)
        
        # Move history back to users
        src = os.path.join(HISTORY_BOTS_DIR, f"{target_user_lower}.yaml")
        dst = os.path.join(HISTORY_DIR, f"{target_user_lower}.yaml")
        if os.path.exists(src):
            os.makedirs(HISTORY_DIR, exist_ok=True)
            shutil.move(src, dst)

        # Migrate Ledger History Back
        move_ledger_entries(target_user, BOT_LEDGER_PATH, LEDGER_PATH)

        # Restore to Contributors Registry
        if not any(c['username'].lower() == target_user_lower for c in contributors):
            new_contributor = {
                "username": target_user,
                "role": "Newbie Contributor", # Reset to default
                "team": "CE",
                "status": "active",
                "assigned_by": author,
                "assigned_at": get_now_ist_str(),
                "last_activity": get_now_ist_str(), 
                "notes": "Migrated back from bots."
            }
            contributors.append(new_contributor)
            with open(REGISTRY_PATH, 'w') as f:
                yaml.dump(registry, f, sort_keys=False, default_flow_style=False)

        # Log to MAIN ledger
        log_msg = f"Removed @{target_user} from bots by @{author}"
        update_ledger("BOT_REMOVE", target_user, log_msg, is_bot=False)
        post_comment(pr_number, f"✅ Successfully removed @{target_user} from bots registry.")
        
    # Commit changes
    try:
        git_commit_push_pr(pr_number, branch_name)
    except Exception as e:
        post_comment(pr_number, f"⚠️ Changes applied but failed to push: {str(e)}")

def run_command_mode(event_path, event_name):
    """Main execution path for interactive commands."""
    import json
    
    if not os.path.exists(event_path):
        print("Event path not found.")
        return

    with open(event_path, 'r') as f:
        event = json.load(f)
    
    # Extract body and author
    if event_name == 'issue_comment':
        comment = event.get('comment', {})
        body = comment.get('body', '')
        author = comment.get('user', {}).get('login')
        pr_number = event.get('issue', {}).get('number')
    else:
        print(f"Unsupported event for commands: {event_name}")
        return

    # Check Authorization
    authorized_users = get_authorized_users()
    if author.lower() not in authorized_users:
        # We only complain if it LOOKS like a command
        if "/gov" in body:
             post_comment(pr_number, f"⛔ **Permission Denied**: @{author} is not a registered code owner for governance.")
        return

    # Determine Branch Name and Checkout
    try:
        if event_name == 'pull_request':
            branch_name = event['pull_request']['head']['ref']
        else:
            # Fetch from API for issue_comment
            pr_url = event['issue']['pull_request']['url']
            pr_data = requests.get(pr_url, headers=headers).json()
            branch_name = pr_data['head']['ref']
            
        print(f"Fetching and checking out branch: {branch_name}")
        subprocess.run(["git", "fetch", "origin", branch_name], check=True)
        subprocess.run(["git", "checkout", branch_name], check=True)
    except Exception as e:
        post_comment(pr_number, f"❌ Failed to resolve or checkout branch: {str(e)}")
        return

    # Regex Patterns
    # 1. Role Change: /gov promote @user "Role Name"
    pattern_role = r'^\s*\/gov\s+(promote|demote)\s+@([a-zA-Z0-9-]+)\s+"([^"]+)"'
    # 2. Bot Mgmt: /gov bot add @user
    pattern_bot = r'^\s*\/gov\s+bot\s+(add|remove)\s+@([a-zA-Z0-9\[\]-]+)'

    match_role = re.search(pattern_role, body, re.MULTILINE)
    match_bot = re.search(pattern_bot, body, re.MULTILINE)

    if match_bot:
        action, target_user = match_bot.groups()
        handle_bot_command(action, target_user, author, pr_number, branch_name)
        return

    if match_role:
        action, target_user, target_role = match_role.groups()
        
        # Check if bot
        bots = load_bots()
        if any(b['username'].lower() == target_user.lower() for b in bots):
             post_comment(pr_number, f"⚠️ User @{target_user} is a bot and bots do not have roles.")
             return

        # Role logic
        with open(REGISTRY_PATH, 'r') as f:
            registry = yaml.safe_load(f)
        
        contributors = registry.get('contributors', [])
        target_entry = next((c for c in contributors if c['username'].lower() == target_user.lower()), None)
        
        if not target_entry:
            post_comment(pr_number, f"❌ User @{target_user} not found in governance registry.")
            return

        current_role = target_entry.get('role', 'Newbie Contributor')
        is_valid, err = validate_role_change(action, current_role, target_role)
        
        if not is_valid:
            post_comment(pr_number, f"❌ {err}")
            return

        # Apply
        target_entry['role'] = target_role
        target_entry['assigned_at'] = get_now_ist_str()
        target_entry['assigned_by'] = author
        
        with open(REGISTRY_PATH, 'w') as f:
            yaml.dump(registry, f, sort_keys=False, default_flow_style=False)
        
        # History
        log_msg = f"Role changed from '{current_role}' to '{target_role}' by @{author} via PR #{pr_number}"
        update_user_history(target_user, "ROLE_CHANGE", log_msg, is_bot=False)
        update_ledger("ROLE_CHANGE", target_user, log_msg, is_bot=False)
        
        # Commit and Push
        try:
            git_commit_push_pr(pr_number, branch_name)
            post_comment(pr_number, f"✅ Successfully {action}d @{target_user} to **{target_role}**.")
        except Exception as e:
            post_comment(pr_number, f"⚠️ Governance updated but failed to push to branch: {str(e)}")

def main():
    event_name = os.getenv("GITHUB_EVENT_NAME")
    event_path = os.getenv("GITHUB_EVENT_PATH")
    
    if event_name == 'issue_comment':
        run_command_mode(event_path, event_name)
        
    elif event_name == 'pull_request':
        import json
        with open(event_path, 'r') as f:
            event = json.load(f)
        if event.get('pull_request', {}).get('merged'):
            run_sync_mode()
    else:
        run_sync_mode()

def run_sync_mode():
    # --- FORK PROTECTION CHECK ---
    if REPO != CANONICAL_REPO:
        print(f"Skipping governance sync: Current repo '{REPO}' is a fork or doesn't match '{CANONICAL_REPO}'.")
        return

    if not os.path.exists(REGISTRY_PATH):
        print(f"Registry not found at {REGISTRY_PATH}")
        return

    with open(REGISTRY_PATH, 'r') as f:
        registry = yaml.safe_load(f)

    contributors = registry.get('contributors', [])
    # Normalize usernames to lowercase for case-insensitive comparison
    existing_usernames = {c['username'].lower() for c in contributors}
    
    # Load Bots
    bots = load_bots()
    bot_usernames = {b['username'].lower() for b in bots}
    
    # Check Metadata for Last Sync
    if 'metadata' not in registry:
        registry['metadata'] = {}
    
    last_sync = registry['metadata'].get('last_sync')
    
    # Determine Mode
    clean_start = False
    if not last_sync:
        clean_start = True
        print("No last_sync found. Performing CLEAN START.")
    elif not os.path.exists(HISTORY_DIR) or not os.listdir(HISTORY_DIR):
        clean_start = True
        print("History directory empty or missing despite last_sync. Forcing CLEAN START.")
    
    # Execute Clean Start Logic
    if clean_start:
        print("Clearing history directories...")
        if os.path.exists(HISTORY_DIR):
            shutil.rmtree(HISTORY_DIR)
        os.makedirs(HISTORY_DIR, exist_ok=True)
        # Clear bots history too for full rebuild (optional but cleaner)
        if os.path.exists(HISTORY_BOTS_DIR):
            shutil.rmtree(HISTORY_BOTS_DIR)
        os.makedirs(HISTORY_BOTS_DIR, exist_ok=True)
        
        if os.path.exists(LEDGER_PATH):
            os.remove(LEDGER_PATH)
        if os.path.exists(BOT_LEDGER_PATH):
            os.remove(BOT_LEDGER_PATH)
            
        # Fetch ALL merged PRs
        prs_to_process = get_merged_prs(since_date=None)
        
        # Re-initialize history for existing contributors (ROLE_ASSIGNMENT)
        for contributor in contributors:
            username = contributor['username']
            update_user_history(
                username, 
                "ROLE_ASSIGNMENT",
                f"Assigned role: {contributor['role']} by {contributor.get('assigned_by', 'unknown')}",
                is_bot=False
            )
            update_ledger(
                "ROLE_ASSIGNMENT",
                username,
                f"Role: {contributor['role']}, Assigned by: {contributor.get('assigned_by', 'unknown')}",
                is_bot=False
            )
        
        # Re-initialize history for bots? (Minimal log)
        for bot in bots:
            username = bot['username']
            update_user_history(
                username,
                "BOT_REGISTRATION",
                f"Bot tracked in registry. Added by: {bot.get('added_by', 'unknown')}",
                is_bot=True
            )

    else:
        print(f"Performing INCREMENTAL SYNC since {last_sync}")
        prs_to_process = get_merged_prs(since_date=last_sync)

    # Process PRs
    print(f"Processing {len(prs_to_process)} PRs...")
    # Sort PRs by merged_at ascending to maintain history order
    prs_to_process.sort(key=lambda x: x['merged_at'])

    for pr in prs_to_process:
        pr_number = pr['number']
        pr_title = pr['title']
        pr_url = pr['url'] # html_url
        
        # 1. Fetch Merge Details (Who merged it?)
        # We need to fetch the single PR endpoint to get 'merged_by'
        try:
            pr_details_resp = requests.get(f"https://api.github.com/repos/{REPO}/pulls/{pr_number}", headers=headers)
            pr_details_resp.raise_for_status()
            pr_details = pr_details_resp.json()
            merged_by_user = pr_details.get('merged_by')
            merged_by_login = merged_by_user['login'] if merged_by_user else None
        except Exception as e:
            print(f"Error fetching PR details for #{pr_number}: {e}")
            merged_by_login = None

        # 2. Fetch Commits (Who committed?)
        commits = []
        try:
            # Pagination for commits? Usually < 100 per PR, but strictly we should page. 
            # For simplicity, assuming < 100 or just taking first page is common in scripts, but let's try to be robust if easy.
            # Using simple 1 page for now as most PRs are small.
            commits_url = f"https://api.github.com/repos/{REPO}/pulls/{pr_number}/commits?per_page=100"
            commits_resp = requests.get(commits_url, headers=headers)
            commits_resp.raise_for_status()
            commits = commits_resp.json()
        except Exception as e:
            print(f"Error fetching commits for #{pr_number}: {e}")

        # 3. Log MERGE Event
        if merged_by_login:
            is_merger_bot = merged_by_login.lower() in bot_usernames
            # If merger is a bot, log to bot ledger? 
            # Or if user wants "merge event in the ledger of the person who did the merge", 
            # and that person is a bot, it goes to bot ledger.
            
            # Check if merger is new contributor?
            if not is_merger_bot and merged_by_login.lower() not in existing_usernames:
                print(f"New contributor (merger) detected: {merged_by_login}")
                onboard_new_contributor(merged_by_login, contributors, existing_usernames, pr['merged_at'], pr_url)
            
            log_msg = f"Merged PR #{pr_number}: {pr_title}"
            update_user_history(merged_by_login, "MERGE", log_msg, is_bot=is_merger_bot)
            update_ledger("MERGE", merged_by_login, log_msg, is_bot=is_merger_bot)

        # 4. Log COMMIT Events
        for commit in commits:
            author = commit.get('author')
            if not author:
                continue # No GitHub user associated
            
            author_login = author['login']
            commit_msg = commit['commit']['message'].split('\n')[0] # First line
            sha_short = commit['sha'][:7]
            
            is_committer_bot = author_login.lower() in bot_usernames
            
            # Check if committer is new contributor?
            if not is_committer_bot and author_login.lower() not in existing_usernames:
                print(f"New contributor (committer) detected: {author_login}")
                onboard_new_contributor(author_login, contributors, existing_usernames, pr['merged_at'], pr_url)

            log_msg = f"Commit {sha_short}: {commit_msg} (PR #{pr_number})"
            update_user_history(author_login, "COMMIT", log_msg, is_bot=is_committer_bot)
            update_ledger("COMMIT", author_login, log_msg, is_bot=is_committer_bot)

    # 3. Update Activity Status (for all contributors)
    print("\nUpdating activity status...")
    for entry in contributors:
        username = entry['username']
        # Double check if bot
        if username.lower() in bot_usernames:
             continue
             
        last_act = get_last_activity_date(username)
        
        if last_act:
            old_activity = entry.get('last_activity')
            entry['last_activity'] = last_act
            
            # Removed ACTIVITY_UPDATE logging
            
            # Inactivity Check (90 days)
            last_act_dt = datetime.strptime(last_act, "%Y-%m-%d")
            now_naive = datetime.now()
            diff = now_naive - last_act_dt
            
            if diff > timedelta(days=90):
                if entry.get('status') != "inactive":
                    entry['status'] = "inactive"
                    # Status change is type of Role Change/Assignment in broad sense
                    update_user_history(username, "STATUS_CHANGE", "Flagged as inactive due to 90 days of no activity.", is_bot=False)
                    update_ledger("STATUS_CHANGE", username, "Marked as inactive (90+ days)", is_bot=False)
            else:
                if entry.get('status') == "inactive":
                    entry['status'] = "active"
                    update_user_history(username, "STATUS_CHANGE", "Reactivated status due to new activity.", is_bot=False)
                    update_ledger("STATUS_CHANGE", username, "Reactivated due to new activity", is_bot=False)
    
def onboard_new_contributor(username, contributors, existing_usernames, timestamp, pr_url):
    new_contributor = {
        "username": username,
        "role": "Newbie Contributor",
        "team": "CE",
        "status": "active",
        "assigned_by": "GitMesh-Steward-bot",
        "assigned_at": timestamp,
        "last_activity": timestamp.split('T')[0],
        "notes": "Automatically onboarded."
    }
    contributors.append(new_contributor)
    existing_usernames.add(username.lower())
    
    update_user_history(username, "ROLE_ASSIGNMENT", f"Assigned Newbie Contributor (via PR {pr_url})", is_bot=False)
    update_ledger("ROLE_ASSIGNMENT", username, f"Onboarded as Newbie Contributor", is_bot=False)

    
    # 4. Update Metadata
    registry['metadata']['last_sync'] = get_now_ist_str()
    registry['metadata']['total_contributors'] = len(contributors)
    registry['metadata']['active_contributors'] = sum(1 for c in contributors if c.get('status') == 'active')

    # Save Registry
    with open(REGISTRY_PATH, 'w') as f:
        yaml.dump(registry, f, sort_keys=False, default_flow_style=False)
    
    print("\nGovernance sync completed successfully.")
    print(f"Total contributors: {len(contributors)}")
    print(f"Active contributors: {registry['metadata']['active_contributors']}")

if __name__ == "__main__":
    main()
