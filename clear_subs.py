
import asyncio
from app.subscription_manager import subscription_manager
from app.graph_auth import graph_auth

async def main():
    print("🧹 Fetching all active Teams subscriptions...")
    subs = await subscription_manager.list_subscriptions()
    if not subs:
        print("✅ No subscriptions found. You're already clear!")
        return
    
    for sub in subs:
        sub_id = sub['id']
        print(f"🗑️ Deleting subscription: {sub_id} ({sub['notificationUrl']})")
        # Manually set the ID so we can delete it
        subscription_manager._subscription_id = sub_id
        await subscription_manager.delete_subscription()
    
    print("\n✨ All old connections cleared. Please restart your backend now.")

if __name__ == "__main__":
    asyncio.run(main())
