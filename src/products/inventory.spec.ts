import { hasCapacity, peakOccupancy, rentalInterval } from "./inventory";

const day = (dayNumber: number) =>
  new Date(`2026-10-${String(dayNumber).padStart(2, "0")}T00:00:00.000Z`);

describe("listing inventory", () => {
  it("allows another booking while one of two units remains free", () => {
    const existing = [{ start: day(1), end: day(5) }];
    expect(hasCapacity(existing, { start: day(2), end: day(4) }, 2)).toBe(true);
    expect(hasCapacity(existing, { start: day(2), end: day(4) }, 1)).toBe(
      false,
    );
  });

  it("reuses stock after a booking ends and measures simultaneous occupancy", () => {
    const existing = [
      { start: day(1), end: day(3) },
      { start: day(3), end: day(5) },
    ];
    expect(peakOccupancy(existing)).toBe(1);
    expect(hasCapacity(existing, { start: day(2), end: day(4) }, 2)).toBe(true);
    expect(hasCapacity(existing, { start: day(2), end: day(4) }, 1)).toBe(
      false,
    );
  });

  it("rejects a third booking during the shared overlap", () => {
    const existing = [
      { start: day(1), end: day(4) },
      { start: day(2), end: day(5) },
    ];
    expect(hasCapacity(existing, { start: day(3), end: day(6) }, 2)).toBe(
      false,
    );
  });

  it("keeps the turnaround buffer for an hourly rental", () => {
    const occupied = rentalInterval({
      startDate: day(1),
      endDate: day(1),
      rentalMode: "hour",
      pickupTime: "10:00",
      returnTime: "11:00",
    });
    expect(
      hasCapacity(
        [occupied],
        {
          start: new Date("2026-10-01T11:00:00Z"),
          end: new Date("2026-10-01T12:00:00Z"),
        },
        1,
      ),
    ).toBe(false);
    expect(
      hasCapacity(
        [occupied],
        {
          start: new Date("2026-10-01T12:00:00Z"),
          end: new Date("2026-10-01T13:00:00Z"),
        },
        1,
      ),
    ).toBe(true);
  });

  it("treats existing same-day rentals as one occupied day", () => {
    const occupied = rentalInterval({
      startDate: day(1),
      endDate: day(1),
      rentalMode: "day",
      pickupTime: "10:00",
      returnTime: "18:00",
    });
    expect(occupied.end).toEqual(day(2));
    expect(hasCapacity([occupied], { start: day(1), end: day(2) }, 1)).toBe(
      false,
    );
  });
});
