import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { Model, Types } from "mongoose";
import { ProductDocument } from "./schemas/product.schema";
import { RentalOrder } from "../rental-orders/schemas/rental-order.schema";

export type OccupiedInterval = { start: Date; end: Date };

export function rentalInterval(
  order: Pick<
    RentalOrder,
    "startDate" | "endDate" | "rentalMode" | "pickupTime" | "returnTime"
  >,
): OccupiedInterval {
  if (order.rentalMode !== "hour") {
    return {
      start: order.startDate,
      end:
        order.endDate <= order.startDate
          ? new Date(order.startDate.getTime() + 24 * 60 * 60 * 1000)
          : order.endDate,
    };
  }
  const withTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        hours,
        minutes,
      ),
    );
  };
  return {
    start: withTime(order.startDate, order.pickupTime),
    end: new Date(
      withTime(order.endDate, order.returnTime).getTime() + 60 * 60 * 1000,
    ),
  };
}

// End points are exclusive. A new unit is needed at a start point after any
// reservations ending at that same instant have been released.
export function peakOccupancy(intervals: OccupiedInterval[]): number {
  const events = intervals.flatMap(({ start, end }) => [
    { at: start.getTime(), delta: 1 },
    { at: end.getTime(), delta: -1 },
  ]);
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let current = 0;
  let peak = 0;
  for (const event of events) {
    current += event.delta;
    peak = Math.max(peak, current);
  }
  return peak;
}

export function hasCapacity(
  intervals: OccupiedInterval[],
  requested: OccupiedInterval,
  stock: number,
): boolean {
  const overlapping = intervals.filter(
    (item) => item.start < requested.end && item.end > requested.start,
  );
  return peakOccupancy([...overlapping, requested]) <= stock;
}

// Serializes writes for one listing across API processes. The lease also lets
// a crashed process release the listing automatically.
export async function withInventoryLock<T>(
  productModel: Model<ProductDocument>,
  productId: Types.ObjectId,
  work: () => Promise<T>,
): Promise<T> {
  const token = randomUUID();
  let acquired = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const now = new Date();
    const locked = await productModel
      .findOneAndUpdate(
        {
          _id: productId,
          $or: [
            { inventoryLockUntil: { $exists: false } },
            { inventoryLockUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            inventoryLockToken: token,
            inventoryLockUntil: new Date(now.getTime() + 30_000),
          },
        },
      )
      .exec();
    if (locked) {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!acquired) {
    throw new ConflictException("Anuntul este actualizat. Incearca din nou.");
  }
  try {
    return await work();
  } finally {
    await productModel
      .updateOne(
        { _id: productId, inventoryLockToken: token },
        { $unset: { inventoryLockToken: "", inventoryLockUntil: "" } },
      )
      .exec();
  }
}
