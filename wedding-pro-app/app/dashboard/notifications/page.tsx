import { fetchUserNotifications } from '@/app/notification-center-actions';
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Fetch all notifications for the user (with a higher limit)
  const notifications = await fetchUserNotifications(50, 0);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Notifications</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y divide-gray-200">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <div 
                key={notification.id} 
                className={`p-4 ${!notification.read ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{notification.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{notification.content}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      {notification.created_at ? (
                        formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })
                      ) : ''}
                      {!notification.read && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          New
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-500">
              No notifications to display
            </div>
          )}
        </div>
      </div>
    </div>
  );
}