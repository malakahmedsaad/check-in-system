// Purpose: Computes the UTC-safe self check-in window around an appointment.

const CHECKIN_WINDOW_MS = 15 * 60 * 1000;

export type CheckinWindow = {
  windowOpen: Date;
  windowClose: Date;
  isOpen: boolean;
  tooEarly: boolean;
  tooLate: boolean;
};

export function computeCheckinWindow(startTime: Date): CheckinWindow {
  const now = new Date();
  const start = new Date(startTime);
  const windowOpen = new Date(start.getTime() - CHECKIN_WINDOW_MS);
  const windowClose = new Date(start.getTime() + CHECKIN_WINDOW_MS);
  const tooEarly = now < windowOpen;
  const tooLate = now > windowClose;

  return {
    windowOpen,
    windowClose,
    isOpen: !tooEarly && !tooLate,
    tooEarly,
    tooLate,
  };
}
