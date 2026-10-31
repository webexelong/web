// Notification Sound Service
class NotificationService {
  private audio: HTMLAudioElement | null = null;
  private isEnabled: boolean = true;

  constructor() {
    try {
      const saved = localStorage.getItem('webcafe_sound_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }
    } catch {
      this.isEnabled = true;
    }

    this.audio = new Audio();
    this.audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ8xkNbx0IJqOgstdMjw3qBJEBdjrOvwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ8xkNbx0IJqOgstdMjw3qBJEBdjrOvwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ8xkNbx0IJqOgstdMjw3qBJEBdjrOvwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ8xkNbx0IJqOgstdMjw3qBJEBdjrOvwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ8xkNbx0IJqOgstdMjw3qBJEBdjrOvwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZGQ==';
    this.audio.volume = 0.5;
  }

  playNewOrderSound() {
    if (!this.isEnabled || !this.audio) return;
    try {
      this.audio.currentTime = 0;
      this.audio.play().catch(err => {
        console.warn('Could not play notification sound:', err);
      });
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }

  playStatusChangeSound() {
    if (!this.isEnabled || !this.audio) return;
    try {
      this.audio.volume = 0.3;
      this.audio.currentTime = 0;
      this.audio.play().catch(err => {
        console.warn('Could not play status sound:', err);
      });
      setTimeout(() => {
        if (this.audio) this.audio.volume = 0.5;
      }, 100);
    } catch (error) {
      console.error('Error playing status sound:', error);
    }
  }

  enable() {
    this.isEnabled = true;
    try { localStorage.setItem('webcafe_sound_enabled', 'true'); } catch { }
  }

  disable() {
    this.isEnabled = false;
    try { localStorage.setItem('webcafe_sound_enabled', 'false'); } catch { }
  }

  toggle() {
    this.isEnabled = !this.isEnabled;
    try { localStorage.setItem('webcafe_sound_enabled', String(this.isEnabled)); } catch { }
    return this.isEnabled;
  }

  isNotificationEnabled() {
    return this.isEnabled;
  }
}

export const notificationService = new NotificationService();
