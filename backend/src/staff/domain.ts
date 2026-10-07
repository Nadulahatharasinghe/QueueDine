export class StaffError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new StaffError(400, `${label} is required (maximum ${max} characters).`);
  }
  return value.trim();
}
export function partyInput(body: Record<string, unknown>) {
  const customerName = text(body.customerName, 'Customer name');
  const mobileNumber = text(body.mobileNumber, 'Mobile number', 30);
  if (!/^\+?[\d\s()-]+$/.test(mobileNumber) || mobileNumber.replace(/\D/g, '').length < 9 || mobileNumber.replace(/\D/g, '').length > 15) throw new StaffError(400, 'Enter a valid mobile number.');
  const partySize = body.partySize;
  if (typeof partySize !== 'number' || !Number.isInteger(partySize) || partySize < 1 || partySize > 30) throw new StaffError(400, 'Party size must be between 1 and 30.');
  if (body.specialRequests !== undefined && typeof body.specialRequests !== 'string') throw new StaffError(400, 'Special requests must be text.');
  const specialRequests = String(body.specialRequests || '').trim();
  if (specialRequests.length > 500) throw new StaffError(400, 'Special requests must be at most 500 characters.');
  return { customerName, mobileNumber, partySize, specialRequests };
}
export function bookingTime(value: unknown): Date {
  const date = new Date(text(value, 'Booking time'));
  if (!Number.isFinite(date.getTime()) || date.getTime() < Date.now() - 60000) throw new StaffError(400, 'Choose a future reservation time.');
  return date;
}
export function waitEstimate(waiting: number, available: number): number {
  return waiting === 0 && available > 0 ? 0 : Math.max(5, Math.ceil((waiting + 1) / Math.max(available, 1)) * 10);
}
export const terminalStatuses: string[] = ['seated', 'cancelled', 'no-show'];
