/**
 * Utility to play a professional notification sound using Web Audio API.
 * This avoids external asset dependencies and works reliably in modern browsers.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    
    // Resume context if suspended (standard browser security policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Use a 'sine' wave for a clean, professional "ping"
    oscillator.type = 'sine';
    
    // Start at a higher pitch and drop slightly for a "notification" feel
    // A5 (880Hz) to E5 (659Hz)
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(659.25, audioContext.currentTime + 0.3);

    // Envelope: Quick attack, smooth decay to prevent clicking sounds
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (e) {
    // Silently fail if audio context is blocked by browser policy before first interaction
    console.debug("Audio notification suppressed: awaiting user interaction.");
  }
}
