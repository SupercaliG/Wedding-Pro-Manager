import { fetchUserNotifications, getUnreadNotificationCount } from '@/app/notification-center-actions';
import { NotificationCenter } from './notification-center';

export async function NotificationCenterWrapper() {
  // Fetch initial notifications and unread count
  const initialNotifications = await fetchUserNotifications();
  const initialUnreadCount = await getUnreadNotificationCount();
  
  return (
    <NotificationCenter 
      initialNotifications={initialNotifications}
      initialUnreadCount={initialUnreadCount}
    />
  );
}