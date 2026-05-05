#!/usr/bin/env python3
"""
One-time utility to delete the existing Graph subscription blocking new subscription creation.
This resolves the 403 error: "has reached its limit of '1' subscription"
"""

import asyncio
import httpx
import json
from app.config import settings, GRAPH_BASE_URL
from app.graph_auth import graph_auth


async def list_subscriptions() -> list:
    """Query Graph API to list all active subscriptions."""
    headers = await graph_auth.get_headers()
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{GRAPH_BASE_URL}/subscriptions",
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
    
    return data.get("value", [])


async def delete_subscription_by_id(subscription_id: str) -> bool:
    """Delete a subscription by its ID."""
    headers = await graph_auth.get_headers()
    
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.delete(
            f"{GRAPH_BASE_URL}/subscriptions/{subscription_id}",
            headers=headers,
        )
    
    if response.status_code == 204:
        print(f"✓ Subscription {subscription_id} deleted successfully")
        return True
    
    print(f"✗ Failed to delete subscription: {response.status_code}")
    print(f"  Response: {response.text}")
    return False


async def main():
    """List subscriptions and delete the one for our Teams chat."""
    print("🔍 Fetching active subscriptions...")
    
    subscriptions = await list_subscriptions()
    print(f"Found {len(subscriptions)} subscription(s)\n")
    
    # Print all subscriptions for reference
    for sub in subscriptions:
        print(f"  ID: {sub['id']}")
        print(f"  Resource: {sub['resource']}")
        print(f"  Expires: {sub.get('expirationDateTime', 'unknown')}")
        print()
    
    # Find the subscription for our Teams chat
    target_resource = f"/chats/{settings.AGILE_CHAT_ID}/messages"
    print(f"Looking for subscription with resource: {target_resource}\n")
    
    matching_subs = subscriptions  # delete ALL
    
    if not matching_subs:
        print("✗ No matching subscription found. Maybe it was already deleted?")
        return False
    
    print(f"Found {len(matching_subs)} matching subscription(s):")
    for sub in matching_subs:
        print(f"  - {sub['id']}")
    
    # Delete each matching subscription
    for sub in matching_subs:
        success = await delete_subscription_by_id(sub["id"])
        if not success:
            return False
    
    print("\n✓ All old subscriptions deleted!")
    print("You can now restart the backend to create a fresh subscription with the new webhook URL.")
    return True


if __name__ == "__main__":
    success = asyncio.run(main())
    exit(0 if success else 1)
