export function filterTimeSlotsForBreakTime(timeSlots: string[], breakTimes: any[]): string[] {
  if (!breakTimes || breakTimes.length === 0) {
    return timeSlots;
  }

  return timeSlots.filter(slot => {
    const [slotHour, slotMinute] = slot.split(':').map(Number);
    const slotTimeInMinutes = slotHour * 60 + slotMinute;

    // Check if slot overlaps with any break time
    for (const breakTime of breakTimes) {
      const [startHour, startMinute] = breakTime.startTime.split(':').map(Number);
      const [endHour, endMinute] = breakTime.endTime.split(':').map(Number);

      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      // If slot falls within break time, exclude it
      if (slotTimeInMinutes >= startTimeInMinutes && slotTimeInMinutes < endTimeInMinutes) {
        return false;
      }
    }

    return true;
  });
} 