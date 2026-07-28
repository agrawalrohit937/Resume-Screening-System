"""Test the live /certificates/issue endpoint with a real auth token."""
import asyncio, sys, json
import urllib.request, urllib.error

sys.path.insert(0, '.')


async def get_token():
    from config.db import connect_db, get_database
    await connect_db()
    db = get_database()
    user_doc = await db.users.find_one({})
    if not user_doc:
        print('No users in DB'); return None
    user_id = str(user_doc['_id'])
    print(f'User: {user_doc.get("email")} (id={user_id})')
    from core.security import create_access_token
    token = create_access_token(data={'sub': user_id})
    return token


token = asyncio.run(get_token())
if not token:
    sys.exit(1)

print(f'Token generated ({len(token)} chars)')

req = urllib.request.Request(
    'http://localhost:8000/api/v1/certificates/issue',
    data=json.dumps({
        'certificate_type': 'assessment',
        'assessment_name': 'Python',
        'score': 90,
        'difficulty': 'Intermediate'
    }).encode(),
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}'
    },
    method='POST'
)
try:
    resp = urllib.request.urlopen(req, timeout=90)
    print('HTTP Status:', resp.status)
    print('Response:', resp.read().decode()[:2000])
except urllib.error.HTTPError as e:
    print(f'HTTP Error: {e.code}')
    print('Body:', e.read().decode()[:3000])
except Exception as ex:
    print('Exception:', ex)
