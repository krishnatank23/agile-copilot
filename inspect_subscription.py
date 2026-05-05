#!/usr/bin/env python3
"""
Inspect the active subscription details to verify it was created correctly.
"""

import asyncio
import json
from app.config import settings, GRAPH_BASE_URL
from app.graph_auth import graph_auth


async def main():
    print("🔍 Fetching active subscriptions...\n")
    
    headers = await graph_auth.get_headers()
    
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(f"{GRAPH_BASE_URL}/subscriptions", headers=headers)
        resp.raise_for_status()
        data = resp.json()
    
    subs = data.get("value", [])
    print(f"Found {len(subs)} subscription(s)\n")
    
    # Find the one for our chat
    target_resource = f"/chats/{settings.AGILE_CHAT_ID}/messages"
    
    for sub in subs:
        if sub.get("resource") == target_resource:
            print("✅ FOUND MATCHING SUBSCRIPTION:\n")
            print(json.dumps(sub, indent=2))
            print()
            
            # Verify critical fields
            print("🔎 VERIFICATION:")
            print(f"  Resource:          {sub.get('resource')}")
            print(f"  NotificationUrl:   {sub.get('notificationUrl')}")
            print(f"  ChangeType:        {sub.get('changeType')}")
            print(f"  ExpirationDateTime: {sub.get('expirationDateTime')}")
            print()
            
            # Check if notification URL matches expected
            expected_url = settings.WEBHOOK_NOTIFICATION_URL
            if not expected_url.endswith("/api/graph-webhook"):
                expected_url = expected_url.rstrip("/") + "/api/graph-webhook"
            
            actual_url = sub.get("notificationUrl", "")
            
            if actual_url == expected_url:
                print(f"✅ Webhook URL matches expected: {expected_url}")
            else:
                print(f"❌ WEBHOOK URL MISMATCH!")
                print(f"   Expected: {expected_url}")
                print(f"   Actual:   {actual_url}")
            
            return
    
    print("❌ No matching subscription found for your chat!")
    print(f"   Expected resource: {target_resource}")
    print()
    print("All subscriptions:")
    for sub in subs:
        print(f"  - {sub.get('resource')}")


if __name__ == "__main__":
    asyncio.run(main())
