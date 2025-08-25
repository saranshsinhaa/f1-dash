self.addEventListener("fetch", (e) => {});

let activeTimeouts = new Map();

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { sessionName, sessionTime, sessionLocation } = event.data;
    scheduleNotification(sessionName, sessionTime, sessionLocation);
  } else if (event.data && event.data.type === 'CLEAR_NOTIFICATIONS') {
    clearAllScheduledNotifications();
  } else if (event.data && event.data.type === 'TEST_NOTIFICATION') {
    self.registration.showNotification(`🏁 Test Notification`, {
      body: `This is a test notification for your F1-Dash app!`,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'test-notification',
      requireInteraction: false
    });
  }
});

function clearAllScheduledNotifications() {
  activeTimeouts.forEach((timeoutId) => {
    clearTimeout(timeoutId);
  });
  activeTimeouts.clear();
}

function scheduleNotification(sessionName, sessionTime, sessionLocation) {
  const sessionDate = new Date(sessionTime);
  const notificationTime = new Date(sessionDate.getTime() - 30 * 60 * 1000);
  const now = new Date();
  
  if (notificationTime > now) {
    const timeUntilNotification = notificationTime.getTime() - now.getTime();
    
    const sessionKey = `f1-session-${sessionTime}`;
    if (activeTimeouts.has(sessionKey)) {
      clearTimeout(activeTimeouts.get(sessionKey));
    }
    
    const timeoutId = setTimeout(() => {
      self.registration.showNotification(`🏁 F1 Session Starting Soon!`, {
        body: `${sessionName} at ${sessionLocation} starts in 30 minutes`,
        icon: '/icon.png',
        badge: '/icon.png',
        tag: sessionKey,
        requireInteraction: false,
        actions: [
          {
            action: 'view',
            title: 'View Sessions'
          }
        ]
      });
      
      activeTimeouts.delete(sessionKey);
    }, timeUntilNotification);
    
    activeTimeouts.set(sessionKey, timeoutId);
    
    console.log(`Scheduled notification for ${sessionName} in ${Math.round(timeUntilNotification / 1000 / 60)} minutes`);
  }
}
